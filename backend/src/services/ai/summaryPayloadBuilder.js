const { prisma } = require('../database/connection');
const { getStockInfo, isKnownSymbol } = require('../dataEnricher');
const { createInputHash } = require('./stableHash');

const numberOrNull = (value) => {
    if (value === null || value === undefined) return null;
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
};

const parseJson = (value, fallback = {}) => {
    if (!value) return fallback;
    try {
        return JSON.parse(value);
    } catch (_) {
        return fallback;
    }
};

const compactMarketSummary = (summary) => {
    if (!summary) return null;
    return {
        indexValue: numberOrNull(summary.indexValue),
        indexChange: numberOrNull(summary.indexChange),
        indexChangePercent: numberOrNull(summary.indexChangePercent),
        totalTurnover: numberOrNull(summary.totalTurnover),
        totalVolume: numberOrNull(summary.totalVolume),
        totalTransactions: numberOrNull(summary.totalTransactions),
        activeCompanies: summary.activeCompanies,
        advancedCompanies: summary.advancedCompanies,
        declinedCompanies: summary.declinedCompanies,
        unchangedCompanies: summary.unchangedCompanies,
        timestamp: summary.timestamp
    };
};

const safeArray = (value) => Array.isArray(value) ? value : [];
const PROMPT_LABEL_SAFE_CHARS = /[^a-zA-Z0-9 .,&()/%+-]/g;
const ALLOWED_SIGNAL_TYPES = new Set(['circuit', 'cross', 'rsi', 'volume', 'streak', '52w', 'breakout', 'adjustment', 'sector']);
const ALLOWED_SIGNAL_SENTIMENTS = new Set(['bullish', 'bearish', 'caution', 'opportunity', 'info', 'neutral']);

function sanitizePromptLabel(value, maxLength = 80) {
    if (value === null || value === undefined) return null;
    const label = String(value)
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(PROMPT_LABEL_SAFE_CHARS, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!label) return null;
    return label.slice(0, maxLength);
}

const staticSectorForSymbol = (symbol) => sanitizePromptLabel(getStockInfo(symbol)?.sector, 60);
const normalizeSignalEnum = (value, allowedValues) => {
    const normalized = sanitizePromptLabel(value, 24)?.toLowerCase();
    return normalized && allowedValues.has(normalized) ? normalized : null;
};

function compactSignal(signal) {
    if (!signal || typeof signal !== 'object') return null;
    const type = normalizeSignalEnum(signal.type, ALLOWED_SIGNAL_TYPES);
    const sentiment = normalizeSignalEnum(signal.sentiment, ALLOWED_SIGNAL_SENTIMENTS);
    if (!type && !sentiment) return null;
    return {
        type: type || 'signal',
        sentiment: sentiment || 'neutral'
    };
}

const compactPriceSnapshot = (stock) => ({
    ltp: numberOrNull(stock.lastTradedPrice),
    previousClose: numberOrNull(stock.previousClose),
    change: numberOrNull(stock.change),
    changePercent: numberOrNull(stock.percentageChange),
    weekChangePercent: numberOrNull(stock.percentageChange1W),
    monthChangePercent: numberOrNull(stock.percentageChange1M)
});

const compactTradingSnapshot = (stock) => ({
    volume: numberOrNull(stock.volume),
    turnover: numberOrNull(stock.turnover),
    totalTrades: stock.totalTrades
});

const metricNumber = (metrics, field) => numberOrNull(metrics?.[field]);
const rangedMetricNumber = (stock, metrics, field) => numberOrNull(metrics?.[field] ?? stock[field]);
const parsedMetricJson = (metrics, field, fallback) => parseJson(metrics?.[field], fallback);

const compactMetricSnapshot = (stock, metrics = {}) => {
    const liquidity = parsedMetricJson(metrics, 'liquidityMetrics');
    const relative = parsedMetricJson(metrics, 'relativeMetrics');
    const signals = parsedMetricJson(metrics, 'signals', []);

    return {
        ma20: metricNumber(metrics, 'ma20'),
        ma50: metricNumber(metrics, 'ma50'),
        ma180: metricNumber(metrics, 'ma180'),
        rsi14: metricNumber(metrics, 'rsi14'),
        high52w: rangedMetricNumber(stock, metrics, 'high52w'),
        low52w: rangedMetricNumber(stock, metrics, 'low52w'),
        volumeRatio: numberOrNull(liquidity.volumeRatio),
        sectorRank: relative.sectorRank ?? null,
        marketRank: relative.marketRank ?? null,
        signals: safeArray(signals).map(compactSignal).filter(Boolean).slice(0, 4)
    };
};

const compactStock = (stock, metrics) => {
    return {
        symbol: stock.symbol,
        sector: staticSectorForSymbol(stock.symbol),
        ...compactPriceSnapshot(stock),
        ...compactTradingSnapshot(stock),
        ...compactMetricSnapshot(stock, metrics),
        updatedAt: stock.updatedAt
    };
};

async function getLatestMetricsBySymbol(symbols) {
    if (symbols.length === 0) return new Map();

    const rows = await prisma.stockMetrics.findMany({
        where: { symbol: { in: symbols } },
        orderBy: [{ date: 'desc' }, { computedAt: 'desc' }]
    });

    const metricsMap = new Map();
    for (const row of rows) {
        if (!metricsMap.has(row.symbol)) metricsMap.set(row.symbol, row);
    }
    return metricsMap;
}

async function buildStockSummaryPayload({ periodType, periodStart, periodEnd, limit = 500 } = {}) {
    const stocks = await prisma.stock.findMany({
        where: { lastTradedPrice: { gt: 0 } },
        orderBy: { symbol: 'asc' },
        take: limit
    });

    const ordinaryStocks = stocks.filter((stock) => isKnownSymbol(stock.symbol));
    const symbols = ordinaryStocks.map((stock) => stock.symbol);
    const [marketSummary, metricsMap] = await Promise.all([
        prisma.marketSummary.findFirst({ orderBy: { timestamp: 'desc' } }),
        getLatestMetricsBySymbol(symbols)
    ]);

    const market = compactMarketSummary(marketSummary);
    const items = ordinaryStocks.map((stock) => {
        const snapshot = compactStock(stock, metricsMap.get(stock.symbol));
        return {
            ...snapshot,
            inputHash: createInputHash({ periodType, market, stock: snapshot })
        };
    });

    return {
        periodType,
        periodStart,
        periodEnd,
        market,
        stocks: items
    };
}

const compactMarketStock = (stock) => ({
    symbol: stock.symbol,
    sector: staticSectorForSymbol(stock.symbol),
    ltp: numberOrNull(stock.lastTradedPrice),
    changePercent: numberOrNull(stock.percentageChange),
    volume: numberOrNull(stock.volume),
    turnover: numberOrNull(stock.turnover),
    weekChangePercent: numberOrNull(stock.percentageChange1W),
    monthChangePercent: numberOrNull(stock.percentageChange1M)
});

const isGainer = (stock) => (stock.changePercent || 0) > 0;
const isLoser = (stock) => (stock.changePercent || 0) < 0;
const byTurnoverDesc = (a, b) => (b.turnover || 0) - (a.turnover || 0);

async function buildMarketSummaryPayload({ periodType, periodStart, periodEnd } = {}) {
    const [marketSummary, stocks] = await Promise.all([
        prisma.marketSummary.findFirst({ orderBy: { timestamp: 'desc' } }),
        prisma.stock.findMany({
            where: { lastTradedPrice: { gt: 0 } },
            orderBy: [{ percentageChange: 'desc' }, { turnover: 'desc' }],
            take: 500
        })
    ]);

    const ordinaryStocks = stocks.filter((stock) => isKnownSymbol(stock.symbol));
    const compactStocks = ordinaryStocks.map(compactMarketStock);

    const payload = {
        periodType,
        periodStart,
        periodEnd,
        market: compactMarketSummary(marketSummary),
        topGainers: compactStocks.filter(isGainer).slice(0, 12),
        topLosers: compactStocks.filter(isLoser).slice(-12).reverse(),
        mostTraded: [...compactStocks].sort(byTurnoverDesc).slice(0, 12),
        sectorBreadth: summarizeSectors(compactStocks)
    };

    return {
        ...payload,
        inputHash: createInputHash(payload)
    };
}

const emptySectorBucket = (sector) => ({ sector, count: 0, adv: 0, dec: 0, unchanged: 0, turnover: 0 });
const movementBucket = (stock) => {
    const change = stock.changePercent || 0;
    if (change > 0) return 'adv';
    if (change < 0) return 'dec';
    return 'unchanged';
};

function updateSectorBucket(bucket, stock) {
    bucket.count += 1;
    bucket.turnover += stock.turnover || 0;
    bucket[movementBucket(stock)] += 1;
}

function summarizeSectors(stocks) {
    const sectors = new Map();
    for (const stock of stocks) {
        const key = stock.sector || 'Unknown';
        const current = sectors.get(key) || emptySectorBucket(key);
        updateSectorBucket(current, stock);
        sectors.set(key, current);
    }
    return [...sectors.values()].sort((a, b) => b.turnover - a.turnover);
}

module.exports = {
    buildStockSummaryPayload,
    buildMarketSummaryPayload,
    compactMarketSummary,
    compactStock,
    sanitizePromptLabel,
    compactSignal,
    summarizeSectors,
    numberOrNull
};
