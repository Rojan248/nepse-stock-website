const logger = require('../utils/logger');
const { getAiSummaryConfig } = require('./aiSummaryConfig');
const { createAiProvider } = require('./providerFactory');
const { buildStockSummaryPayload } = require('./summaryPayloadBuilder');
const repository = require('./summaryRepository');
const { acquireAiLock, releaseAiLock } = require('./aiSummaryLock');
const { getHourlyPeriod } = require('./tradingCalendar');

const chunk = (items, size) => {
    const batches = [];
    for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
    return batches;
};

const toResultMap = (items = []) => new Map(items.map((item) => [item.symbol, item]));
const USAGE_FIELDS = ['promptTokens', 'completionTokens', 'promptCacheHitTokens', 'promptCacheMissTokens'];
const responseUsageValue = (response, field) => response.usage?.[field] || 0;
const emptyTotals = () => ({
    promptTokens: 0,
    completionTokens: 0,
    promptCacheHitTokens: 0,
    promptCacheMissTokens: 0,
    estimatedCostUsd: 0
});

const addUsageTotals = (totals, response = {}) => {
    for (const field of USAGE_FIELDS) {
        totals[field] += responseUsageValue(response, field);
    }
    totals.estimatedCostUsd += response.estimatedCostUsd || 0;
};

function normalizeProviderItem(stock, item = {}) {
    const providerItem = item || {};
    return {
        symbol: stock.symbol,
        summary: providerItem.summary || `${stock.symbol} has no generated summary for this period.`,
        sentiment: providerItem.sentiment || 'neutral',
        confidence: providerItem.confidence ?? null,
        drivers: Array.isArray(providerItem.drivers) ? providerItem.drivers.slice(0, 5) : [],
        risks: Array.isArray(providerItem.risks) ? providerItem.risks.slice(0, 5) : []
    };
}

function resolveRunContext(options = {}) {
    const config = options.config || getAiSummaryConfig();
    const provider = options.provider || createAiProvider(config);
    const periodType = options.periodType || 'HOURLY';
    const periodStart = options.periodStart || getHourlyPeriod();
    const periodEnd = options.periodEnd || new Date(periodStart.getTime() + 60 * 60 * 1000);
    return { config, provider, periodType, periodStart, periodEnd, force: options.force };
}

function skipReason(context) {
    if (!context.config.enabled && !context.force) return 'disabled';
    if (!context.provider) return 'provider-not-configured';
    return null;
}

async function reuseExistingSummary(stock, context, run) {
    const { config, periodType, periodStart, periodEnd } = context;
    if (!config.reuseUnchangedSummaries) return false;

    const reusable = await repository.findReusableStockSummary(stock.symbol, stock.inputHash);
    if (!reusable) return false;

    await repository.upsertStockSummary({
        symbol: stock.symbol,
        periodType,
        periodStart,
        periodEnd,
        summary: reusable.summary,
        sentiment: reusable.sentiment,
        confidence: reusable.confidence,
        drivers: JSON.parse(reusable.driversJson || '[]'),
        risks: JSON.parse(reusable.risksJson || '[]'),
        inputHash: stock.inputHash,
        reusedFromId: reusable.id,
        runId: run.id,
        model: reusable.model
    });
    return true;
}

async function createStockRun(payload, context) {
    return repository.createRun({
        jobType: 'STOCK_SUMMARY',
        periodType: context.periodType,
        periodStart: context.periodStart,
        periodEnd: context.periodEnd,
        provider: context.provider.name,
        model: context.provider.model,
        requestedStocks: payload.stocks.length
    });
}

async function splitReusableStocks(payload, context, run) {
    const stocksToGenerate = [];
    let reusedStocks = 0;

    for (const stock of payload.stocks) {
        const reused = await reuseExistingSummary(stock, context, run);
        if (reused) reusedStocks += 1;
        else stocksToGenerate.push(stock);
    }

    return { stocksToGenerate, reusedStocks };
}

async function persistGeneratedBatch({ batch, response, context, run }) {
    const resultMap = toResultMap(response.data?.items || []);
    const perSummaryCost = batch.length > 0 ? (response.estimatedCostUsd || 0) / batch.length : 0;

    for (const stock of batch) {
        const item = normalizeProviderItem(stock, resultMap.get(stock.symbol));
        await repository.upsertStockSummary({
            ...item,
            periodType: context.periodType,
            periodStart: context.periodStart,
            periodEnd: context.periodEnd,
            inputHash: stock.inputHash,
            runId: run.id,
            model: context.provider.model,
            estimatedCostUsd: perSummaryCost
        });
    }
}

async function generateStockBatches(stocksToGenerate, context, payload, run) {
    const totals = emptyTotals();

    for (const batch of chunk(stocksToGenerate, context.config.stockBatchSize)) {
        const response = await context.provider.generateStockSummaries({
            periodType: context.periodType,
            periodStart: context.periodStart,
            periodEnd: context.periodEnd,
            market: payload.market,
            stocks: batch
        });

        await persistGeneratedBatch({ batch, response, context, run });
        addUsageTotals(totals, response);
    }

    return totals;
}

async function finishSuccessfulRun({ run, payload, stocksToGenerate, reusedStocks, totals }) {
    await repository.finishRun(run.id, {
        status: 'COMPLETED',
        generatedStocks: stocksToGenerate.length,
        reusedStocks,
        ...totals
    });

    return {
        success: true,
        requestedStocks: payload.stocks.length,
        generatedStocks: stocksToGenerate.length,
        reusedStocks,
        estimatedCostUsd: Number(totals.estimatedCostUsd.toFixed(8))
    };
}

async function markRunFailed(run, error) {
    logger.error(`[StockSummaryWorker] Failed: ${error.message}`);
    if (run) {
        await repository.finishRun(run.id, { status: 'FAILED', error: error.message });
    }
}

async function runStockSummaries(options = {}) {
    const context = resolveRunContext(options);
    const reason = skipReason(context);
    if (reason) return { skipped: true, reason };

    const lockOwner = `stock_${context.periodType}`;
    if (!(await acquireAiLock(lockOwner))) return { skipped: true, reason: 'locked' };

    let run;
    try {
        const payload = await buildStockSummaryPayload(context);
        run = await createStockRun(payload, context);
        const { stocksToGenerate, reusedStocks } = await splitReusableStocks(payload, context, run);
        const totals = await generateStockBatches(stocksToGenerate, context, payload, run);
        return finishSuccessfulRun({ run, payload, stocksToGenerate, reusedStocks, totals });
    } catch (error) {
        await markRunFailed(run, error);
        return { success: false, error: error.message };
    } finally {
        await releaseAiLock(lockOwner);
    }
}

module.exports = {
    runStockSummaries,
    normalizeProviderItem,
    chunk,
    resolveRunContext
};
