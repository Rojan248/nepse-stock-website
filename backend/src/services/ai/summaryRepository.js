const { prisma } = require('../database/connection');

const parseJson = (value, fallback) => {
    if (!value) return fallback;
    try {
        return JSON.parse(value);
    } catch (_) {
        return fallback;
    }
};

function mapStockSummary(row) {
    if (!row) return null;
    return {
        ...row,
        drivers: parseJson(row.driversJson, []),
        risks: parseJson(row.risksJson, [])
    };
}

function mapMarketSummary(row) {
    if (!row) return null;
    return {
        ...row,
        breadth: parseJson(row.breadthJson, null),
        topMovers: parseJson(row.topMoversJson, null),
        sectors: parseJson(row.sectorJson, null)
    };
}

async function createRun(data) {
    return prisma.aiRun.create({
        data: {
            jobType: data.jobType,
            periodType: data.periodType,
            periodStart: data.periodStart,
            periodEnd: data.periodEnd,
            status: data.status || 'RUNNING',
            model: data.model,
            provider: data.provider,
            requestedStocks: data.requestedStocks || 0
        }
    });
}

async function finishRun(id, data) {
    return prisma.aiRun.update({
        where: { id },
        data: {
            ...data,
            finishedAt: new Date()
        }
    });
}

async function findReusableStockSummary(symbol, inputHash) {
    return prisma.stockAiSummary.findFirst({
        where: { symbol, inputHash },
        orderBy: { createdAt: 'desc' }
    });
}

const jsonString = (value, fallback) => JSON.stringify(value || fallback);
const nullable = (value) => value ?? null;
const commonSummaryData = (summary) => ({
    summary: summary.summary,
    sentiment: summary.sentiment || null,
    confidence: nullable(summary.confidence),
    inputHash: summary.inputHash,
    runId: summary.runId || null,
    model: summary.model || null,
    promptTokens: summary.promptTokens || 0,
    completionTokens: summary.completionTokens || 0,
    estimatedCostUsd: nullable(summary.estimatedCostUsd)
});

const stockSummaryData = (summary) => ({
    ...commonSummaryData(summary),
    driversJson: jsonString(summary.drivers, []),
    risksJson: jsonString(summary.risks, []),
    reusedFromId: summary.reusedFromId || null
});

const marketSummaryData = (summary) => ({
    ...commonSummaryData(summary),
    breadthJson: jsonString(summary.breadth, null),
    topMoversJson: jsonString(summary.topMovers, null),
    sectorJson: jsonString(summary.sectors, null)
});

const stockSummaryKey = (summary) => ({
    symbol_periodType_periodStart: {
        symbol: summary.symbol,
        periodType: summary.periodType,
        periodStart: summary.periodStart
    }
});

const marketSummaryKey = (summary) => ({
    periodType_periodStart: {
        periodType: summary.periodType,
        periodStart: summary.periodStart
    }
});

const stockSummaryCreateData = (summary, data) => ({
    symbol: summary.symbol,
    periodType: summary.periodType,
    periodStart: summary.periodStart,
    periodEnd: summary.periodEnd || null,
    ...data
});

const marketSummaryCreateData = (summary, data) => ({
    periodType: summary.periodType,
    periodStart: summary.periodStart,
    periodEnd: summary.periodEnd,
    ...data
});

async function upsertStockSummary(summary) {
    const data = stockSummaryData(summary);

    return prisma.stockAiSummary.upsert({
        where: stockSummaryKey(summary),
        update: { ...data, periodEnd: summary.periodEnd || null },
        create: stockSummaryCreateData(summary, data)
    });
}

async function upsertMarketSummary(summary) {
    const data = marketSummaryData(summary);

    return prisma.marketAiSummary.upsert({
        where: marketSummaryKey(summary),
        update: { ...data, periodEnd: summary.periodEnd },
        create: marketSummaryCreateData(summary, data)
    });
}

async function getStockSummaries(symbol, { periodType = 'HOURLY', limit = 24 } = {}) {
    const rows = await prisma.stockAiSummary.findMany({
        where: { symbol: symbol.toUpperCase(), periodType },
        orderBy: { periodStart: 'desc' },
        take: limit
    });
    return rows.map(mapStockSummary);
}

async function getLatestStockSummary(symbol, periodType = 'HOURLY') {
    const row = await prisma.stockAiSummary.findFirst({
        where: { symbol: symbol.toUpperCase(), periodType },
        orderBy: { periodStart: 'desc' }
    });
    return mapStockSummary(row);
}

async function getMarketSummaries({ periodType = 'DAILY', limit = 20 } = {}) {
    const rows = await prisma.marketAiSummary.findMany({
        where: { periodType },
        orderBy: { periodStart: 'desc' },
        take: limit
    });
    return rows.map(mapMarketSummary);
}

async function getAiSummaryStatus() {
    const [lastRun, stockSummaryCount, marketSummaryCount] = await Promise.all([
        prisma.aiRun.findFirst({ orderBy: { startedAt: 'desc' } }),
        prisma.stockAiSummary.count(),
        prisma.marketAiSummary.count()
    ]);

    return {
        lastRun,
        stockSummaryCount,
        marketSummaryCount
    };
}

async function getEstimatedCostSince(startedAt) {
    const rows = await prisma.aiRun.findMany({
        where: {
            startedAt: { gte: startedAt },
            estimatedCostUsd: { not: null }
        },
        select: { estimatedCostUsd: true }
    });

    return rows.reduce((sum, row) => sum + Number(row.estimatedCostUsd || 0), 0);
}

module.exports = {
    createRun,
    finishRun,
    findReusableStockSummary,
    upsertStockSummary,
    upsertMarketSummary,
    getStockSummaries,
    getLatestStockSummary,
    getMarketSummaries,
    getAiSummaryStatus,
    getEstimatedCostSince,
    mapStockSummary,
    mapMarketSummary
};
