const logger = require('../utils/logger');
const { getAiSummaryConfig } = require('./aiSummaryConfig');
const { createAiProvider } = require('./providerFactory');
const { buildMarketSummaryPayload } = require('./summaryPayloadBuilder');
const repository = require('./summaryRepository');
const { acquireAiLock, releaseAiLock } = require('./aiSummaryLock');
const { getDayPeriod } = require('./tradingCalendar');

const fallbackArray = (value) => Array.isArray(value) ? value : [];
const defaultBreadth = (market = {}) => ({
    advances: market.advancedCompanies || 0,
    declines: market.declinedCompanies || 0,
    unchanged: market.unchangedCompanies || 0
});

const defaultTopMovers = (payload) => ({
    gainers: fallbackArray(payload.topGainers),
    losers: fallbackArray(payload.topLosers),
    turnover: fallbackArray(payload.mostTraded)
});
const USAGE_FIELDS = ['promptTokens', 'completionTokens', 'promptCacheHitTokens', 'promptCacheMissTokens'];
const responseUsageValue = (response, field) => response.usage?.[field] || 0;

function normalizeMarketResult(payload, data = {}) {
    return {
        summary: data.summary || 'No market summary was generated for this period.',
        sentiment: data.sentiment || 'neutral',
        confidence: data.confidence ?? null,
        breadth: data.breadth || defaultBreadth(payload.market),
        topMovers: data.topMovers || defaultTopMovers(payload),
        sectors: data.sectors || fallbackArray(payload.sectorBreadth)
    };
}

function resolveMarketContext(options = {}) {
    const config = options.config || getAiSummaryConfig();
    const provider = options.provider || createAiProvider(config);
    const periodType = options.periodType || 'DAILY';
    const dayPeriod = getDayPeriod(options.periodStart || new Date());
    const periodStart = options.periodStart || dayPeriod.start;
    const periodEnd = options.periodEnd || dayPeriod.end;
    return { config, provider, periodType, periodStart, periodEnd, force: options.force };
}

function skipReason(context) {
    if (!context.config.enabled && !context.force) return 'disabled';
    if (!context.provider) return 'provider-not-configured';
    return null;
}

async function createMarketRun(payload, context) {
    return repository.createRun({
        jobType: 'MARKET_SUMMARY',
        periodType: context.periodType,
        periodStart: context.periodStart,
        periodEnd: context.periodEnd,
        provider: context.provider.name,
        model: context.provider.model
    });
}

function runUsageData(response = {}) {
    const usage = Object.fromEntries(USAGE_FIELDS.map((field) => [field, responseUsageValue(response, field)]));
    return { ...usage, estimatedCostUsd: response.estimatedCostUsd || 0 };
}

async function persistMarketSummary(payload, response, context, run) {
    const result = normalizeMarketResult(payload, response.data);
    const usage = runUsageData(response);

    await repository.upsertMarketSummary({
        ...result,
        periodType: context.periodType,
        periodStart: context.periodStart,
        periodEnd: context.periodEnd,
        inputHash: payload.inputHash,
        runId: run.id,
        model: context.provider.model,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        estimatedCostUsd: usage.estimatedCostUsd
    });

    return usage;
}

async function markRunFailed(run, error) {
    logger.error(`[MarketSummaryWorker] Failed: ${error.message}`);
    if (run) {
        await repository.finishRun(run.id, { status: 'FAILED', error: error.message });
    }
}

async function runMarketSummary(options = {}) {
    const context = resolveMarketContext(options);
    const reason = skipReason(context);
    if (reason) return { skipped: true, reason };

    const lockOwner = `market_${context.periodType}`;
    if (!(await acquireAiLock(lockOwner))) return { skipped: true, reason: 'locked' };

    let run;
    try {
        const payload = await buildMarketSummaryPayload(context);
        run = await createMarketRun(payload, context);
        const response = await context.provider.generateMarketSummary(payload);
        const usage = await persistMarketSummary(payload, response, context, run);

        await repository.finishRun(run.id, { status: 'COMPLETED', ...usage });
        return {
            success: true,
            periodType: context.periodType,
            estimatedCostUsd: usage.estimatedCostUsd
        };
    } catch (error) {
        await markRunFailed(run, error);
        return { success: false, error: error.message };
    } finally {
        await releaseAiLock(lockOwner);
    }
}

module.exports = {
    runMarketSummary,
    normalizeMarketResult,
    resolveMarketContext
};
