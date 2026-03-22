/**
 * Metrics Orchestrator
 * Coordinates all 7 metrics modules to compute comprehensive stock metrics
 * Saves results to StockMetrics table via Prisma
 */

const { prisma } = require('../database/connection');
const logger = require('../utils/logger');
const priceMetrics = require('./priceMetrics');
const movingAverages = require('./movingAverages');
const momentum = require('./momentum');
const liquidity = require('./liquidity');
const relative = require('./relative');
const fundamentals = require('./fundamentals');
const patterns = require('./patterns');

function createMetricsUpsertConfig(symbol, today, metricsData) {
    const { priceM, trendM, momentumM, liquidityM, relativeM, fundM, patternsM, signals } = metricsData;
    const stringified = {
        priceMetrics: JSON.stringify(priceM),
        trendMetrics: JSON.stringify(trendM),
        momentumMetrics: JSON.stringify(momentumM),
        liquidityMetrics: JSON.stringify(liquidityM),
        relativeMetrics: JSON.stringify(relativeM),
        fundamentals: JSON.stringify(fundM),
        patterns: JSON.stringify(patternsM),
        signals: JSON.stringify(signals)
    };

    return {
        where: { symbol_date: { symbol: symbol.toUpperCase(), date: today } },
        update: { ...stringified, computedAt: new Date() },
        create: { symbol: symbol.toUpperCase(), date: today, ...stringified }
    };
}

/**
 * Compute all metrics for a single stock
 * @param {string} symbol - Stock symbol
 * @param {Array|null} allStocks - All stocks for relative comparison (optional)
 * @returns {Object|null} Computed metrics or null on error
 */
async function computeForSymbol(symbol, allStocks = null) {
    try {
        const stock = await prisma.stock.findUnique({
            where: { symbol: symbol.toUpperCase() }
        });

        const ltp = stock?.lastTradedPrice;
        if (!ltp || ltp <= 0) {
            return null;
        }

        const history = await prisma.marketHistory.findMany({
            where: { symbol: symbol.toUpperCase() },
            orderBy: { date: 'desc' },
            take: 250
        });

        const metricsData = {
            priceM: priceMetrics.compute(history, stock),
            trendM: movingAverages.compute(history, stock),
            momentumM: momentum.compute(history),
            liquidityM: liquidity.compute(history, stock),
            relativeM: await relative.compute(stock, allStocks),
            fundM: fundamentals.compute(stock)
        };
        metricsData.patternsM = patterns.compute(metricsData.priceM, metricsData.trendM, metricsData.momentumM, metricsData.liquidityM, metricsData.relativeM, metricsData.fundM);
        metricsData.signals = patterns.buildSignals(metricsData.patternsM, metricsData.priceM, metricsData.trendM, metricsData.momentumM, metricsData.liquidityM);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        await prisma.stockMetrics.upsert(createMetricsUpsertConfig(symbol, today, metricsData));

        return {
            symbol: symbol.toUpperCase(),
            ...metricsData
        };
    } catch (error) {
        logger.error(`Metrics computation failed for ${symbol}: ${error.message}`);
        return null;
    }
}

/** History mapper helper */
function buildHistoryMap(allHistory) {
    const historyMap = {};
    for (const record of allHistory) {
        if (!historyMap[record.symbol]) historyMap[record.symbol] = [];
        historyMap[record.symbol].push(record);
    }
    return historyMap;
}

function getHistoricalChange(currentPrice, targetDate, symHistory) {
    if (!symHistory || symHistory.length === 0) return null;
    const target = symHistory.find(h => new Date(h.date) <= targetDate) || symHistory[symHistory.length - 1];
    if (target?.closePrice > 0) {
        return Number((((currentPrice - target.closePrice) / target.closePrice) * 100).toFixed(2));
    }
    return null;
}

/** Individual snapshot calculator */
function calculateCumulativeForSymbol(stock, symHistory, target7d, target30d) {
    if (!symHistory || symHistory.length === 0) return { pct1W: null, pct1M: null };
    const pct1W = getHistoricalChange(stock.lastTradedPrice, target7d, symHistory);
    const pct1M = getHistoricalChange(stock.lastTradedPrice, target30d, symHistory);
    return { pct1W, pct1M };
}

/**
 * Pre-calculate 1W and 1M changes sequentially for all stocks
 */
async function computeCumulativeStockMetrics(allStocks) {
    logger.info('Computing 1W and 1M cumulative metrics for all stocks...');
    try {
        const now = Date.now();
        const target7d = new Date(now - 7 * 24 * 60 * 60 * 1000);
        const target30d = new Date(now - 30 * 24 * 60 * 60 * 1000);

        const allHistory = await prisma.marketHistory.findMany({
            orderBy: { date: 'desc' }
        });

        const historyMap = buildHistoryMap(allHistory);
        const updates = [];
        
        for (const stock of allStocks) {
            const symHistory = historyMap[stock.symbol];
            const { pct1W, pct1M } = calculateCumulativeForSymbol(stock, symHistory, target7d, target30d);
            
            const hasNoData = pct1W === null && pct1M === null && !symHistory;
            if (hasNoData) continue;

            updates.push(prisma.stock.update({
                where: { symbol: stock.symbol },
                data: {
                    percentageChange1W: pct1W,
                    percentageChange1M: pct1M
                }
            }));
        }

        if (updates.length > 0) {
            // Batch transact updates
            await prisma.$transaction(updates);
            logger.info(`Updated cumulative metrics for ${updates.length} stocks.`);
        }
    } catch (error) {
        logger.error(`Error computing cumulative stock metrics: ${error.message}`);
    }
}

/**
 * Compute metrics for all active stocks
 * @returns {Object} { computed: number, failed: number, total: number }
 */
async function computeAll() {
    const startTime = Date.now();
    logger.info('Starting metrics computation for all stocks...');

    try {
        // Fetch all active stocks for relative metrics
        const allStocks = await prisma.stock.findMany({
            where: { lastTradedPrice: { gt: 0 } },
            select: {
                symbol: true,
                sector: true,
                percentageChange: true,
                lastTradedPrice: true
            }
        });

        // Compute and pre-cache 1W and 1M changes inline!
        await computeCumulativeStockMetrics(allStocks);

        let computed = 0;
        let failed = 0;

        for (const stock of allStocks) {
            const result = await computeForSymbol(stock.symbol, allStocks);
            if (result) {
                computed++;
            } else {
                failed++;
            }
        }

        const duration = Date.now() - startTime;
        logger.info(`Metrics computation completed: ${computed} computed, ${failed} failed out of ${allStocks.length} stocks in ${duration}ms`);

        return { computed, failed, total: allStocks.length, duration };
    } catch (error) {
        logger.error(`Metrics computeAll failed: ${error.message}`);
        return { computed: 0, failed: 0, total: 0, error: error.message };
    }
}

// ── Re-export read-only queries from metricsReader ────────────────────────────
const { getMetrics, getMarketMetrics } = require('./metricsReader');

module.exports = {
    computeForSymbol,
    computeAll,
    getMetrics,
    getMarketMetrics
};
