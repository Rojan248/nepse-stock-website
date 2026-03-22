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
const { computeCumulativeStockMetrics } = require('./cumulativeMetrics');

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

async function fetchMetricsDependencies(symbol) {
    const stock = await prisma.stock.findUnique({
        where: { symbol: symbol.toUpperCase() }
    });

    const isValid = stock?.lastTradedPrice > 0;
    if (!isValid) return null;

    const history = await prisma.marketHistory.findMany({
        where: { symbol: symbol.toUpperCase() },
        orderBy: { date: 'desc' },
        take: 250
    });

    return { stock, history };
}

async function generateMetricsObject(history, stock, allStocks) {
    const metricsData = {
        priceM: priceMetrics.compute(history, stock),
        trendM: movingAverages.compute(history, stock),
        momentumM: momentum.compute(history),
        liquidityM: liquidity.compute(history, stock),
        relativeM: await relative.compute(stock, allStocks),
        fundM: fundamentals.compute(stock)
    };
    
    metricsData.patternsM = patterns.compute(
        metricsData.priceM, metricsData.trendM, metricsData.momentumM, 
        metricsData.liquidityM, metricsData.relativeM, metricsData.fundM
    );
    
    metricsData.signals = patterns.buildSignals(
        metricsData.patternsM, metricsData.priceM, metricsData.trendM, 
        metricsData.momentumM, metricsData.liquidityM
    );
    
    return metricsData;
}

/**
 * Compute all metrics for a single stock
 * @param {string} symbol - Stock symbol
 * @param {Array|null} allStocks - All stocks for relative comparison (optional)
 * @returns {Object|null} Computed metrics or null on error
 */
async function computeForSymbol(symbol, allStocks = null) {
    try {
        const deps = await fetchMetricsDependencies(symbol);
        if (!deps) return null;
        
        const metricsData = await generateMetricsObject(deps.history, deps.stock, allStocks);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        await prisma.stockMetrics.upsert(createMetricsUpsertConfig(symbol, today, metricsData));

        return { symbol: symbol.toUpperCase(), ...metricsData };
    } catch (error) {
        logger.error(`Metrics computation failed for ${symbol}: ${error.message}`);
        return null;
    }
}



const processStockBatch = (allStocks) => 
    allStocks.reduce(async (accPromise, stock) => {
        const acc = await accPromise;
        const result = await computeForSymbol(stock.symbol, allStocks);
        return {
            computed: acc.computed + (result ? 1 : 0),
            failed: acc.failed + (result ? 0 : 1)
        };
    }, Promise.resolve({ computed: 0, failed: 0 }));

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

        const { computed, failed } = await processStockBatch(allStocks);

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
