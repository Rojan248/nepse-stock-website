/**
 * Metrics Reader
 * Read-only queries for stock and market metrics.
 * Extracted from metricsOrchestrator.js to reduce per-file complexity.
 */

const { prisma } = require('../database/connection');
const logger = require('../utils/logger');

function safeJsonParse(str) {
    if (!str) return null;
    try { return JSON.parse(str); } catch { return null; }
}

function buildCurrentDay(stock) {
    return {
        price: stock.lastTradedPrice,
        previousClose: stock.previousClose,
        open: stock.openPrice,
        high: stock.highPrice,
        low: stock.lowPrice,
        change: stock.change,
        changePercent: stock.percentageChange,
        volume: stock.volume,
        turnover: stock.turnover,
        totalTrades: stock.totalTrades,
        sector: stock.sector,
        companyName: stock.companyName,
        updatedAt: stock.updatedAt
    };
}

function buildDataDepth(historyCount) {
    let message = null;
    if (historyCount < 14) {
        message = `Accumulating data (${historyCount}/14 days for basic indicators)`;
    } else if (historyCount < 50) {
        message = `Building history (${historyCount}/50 days for full analysis)`;
    }
    return {
        historicalDays: historyCount,
        hasEnoughForMA20: historyCount >= 20,
        hasEnoughForMA50: historyCount >= 50,
        hasEnoughForRSI: historyCount >= 14,
        hasEnoughFor52w: historyCount >= 200,
        message
    };
}

function attachComputedMetrics(result, metrics) {
    result.date = metrics.date;
    result.computedAt = metrics.computedAt;
    result.priceMetrics = safeJsonParse(metrics.priceMetrics);
    result.trendMetrics = safeJsonParse(metrics.trendMetrics);
    result.momentumMetrics = safeJsonParse(metrics.momentumMetrics);
    result.liquidityMetrics = safeJsonParse(metrics.liquidityMetrics);
    result.relativeMetrics = safeJsonParse(metrics.relativeMetrics);
    result.fundamentals = safeJsonParse(metrics.fundamentals);
    result.patterns = safeJsonParse(metrics.patterns);
    result.signals = safeJsonParse(metrics.signals);
}

/**
 * Get latest metrics for a symbol
 */
async function getMetrics(symbol) {
    try {
        const upperSymbol = symbol.toUpperCase();
        const stock = await prisma.stock.findUnique({ where: { symbol: upperSymbol } });
        if (!stock) return null;

        const metrics = await prisma.stockMetrics.findFirst({
            where: { symbol: upperSymbol },
            orderBy: { date: 'desc' }
        });

        const historyCount = await prisma.marketHistory.count({ where: { symbol: upperSymbol } });

        const result = {
            symbol: upperSymbol,
            currentDay: buildCurrentDay(stock),
            dataDepth: buildDataDepth(historyCount)
        };

        if (metrics) attachComputedMetrics(result, metrics);
        return result;
    } catch (error) {
        logger.error(`Failed to get metrics for ${symbol}: ${error.message}`);
        return null;
    }
}

function calculateSectorMetrics(allStocks) {
    const sectorMap = {};
    for (const stock of allStocks) {
        const sector = stock.sector || 'Others';
        if (!sectorMap[sector]) {
            sectorMap[sector] = { count: 0, advancing: 0, declining: 0, totalChange: 0 };
        }
        sectorMap[sector].count++;

        const pctChg = stock.percentageChange;
        if (pctChg != null) sectorMap[sector].totalChange += pctChg;

        const chg = stock.change;
        if (chg > 0) sectorMap[sector].advancing++;
        if (chg < 0) sectorMap[sector].declining++;
    }

    return Object.entries(sectorMap).map(([name, data]) => ({
        name,
        ...data,
        avgChange: data.count > 0 ? data.totalChange / data.count : 0
    })).sort((a, b) => b.avgChange - a.avgChange);
}

function categorizeStocks(allStocks) {
    const advancing = allStocks.filter(s => (s.change || 0) > 0).length;
    const declining = allStocks.filter(s => (s.change || 0) < 0).length;
    const unchanged = allStocks.filter(s => (s.change || 0) === 0).length;
    return { advancing, declining, unchanged };
}

/**
 * Get aggregate market metrics
 */
async function getMarketMetrics() {
    try {
        const allStocks = await prisma.stock.findMany({
            where: { lastTradedPrice: { gt: 0 } }
        });

        const { advancing, declining, unchanged } = categorizeStocks(allStocks);
        const totalVolume = allStocks.reduce((sum, s) => sum + (s.volume || 0), 0);
        const totalTurnover = allStocks.reduce((sum, s) => sum + (s.turnover || 0), 0);
        const sectors = calculateSectorMetrics(allStocks);

        return {
            totalStocks: allStocks.length,
            advancing,
            declining,
            unchanged,
            breadthRatio: allStocks.length > 0 ? advancing / allStocks.length : 0,
            totalVolume,
            totalTurnover,
            sectors
        };
    } catch (error) {
        logger.error(`Market metrics computation failed: ${error.message}`);
        return null;
    }
}

module.exports = { getMetrics, getMarketMetrics };
