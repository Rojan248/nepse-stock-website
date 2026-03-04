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

/**
 * Compute all metrics for a single stock
 * @param {string} symbol - Stock symbol
 * @param {Array|null} allStocks - All stocks for relative comparison (optional)
 * @returns {Object|null} Computed metrics or null on error
 */
async function computeForSymbol(symbol, allStocks = null) {
    try {
        // Fetch current stock data
        const stock = await prisma.stock.findUnique({
            where: { symbol: symbol.toUpperCase() }
        });

        if (!stock || !stock.lastTradedPrice || stock.lastTradedPrice <= 0) {
            return null;
        }

        // Fetch historical data (up to 235 trading days for 52w calculations)
        const history = await prisma.marketHistory.findMany({
            where: { symbol: symbol.toUpperCase() },
            orderBy: { date: 'desc' },
            take: 250
        });

        // Compute all metric modules
        const priceM = priceMetrics.compute(history, stock);
        const trendM = movingAverages.compute(history, stock);
        const momentumM = momentum.compute(history);
        const liquidityM = liquidity.compute(history, stock);
        const relativeM = await relative.compute(stock, allStocks);
        const fundM = fundamentals.compute(stock);
        const patternsM = patterns.compute(priceM, trendM, momentumM, liquidityM, relativeM, fundM);
        const signals = patterns.buildSignals(patternsM, priceM, trendM, momentumM, liquidityM);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Upsert metrics to database
        await prisma.stockMetrics.upsert({
            where: {
                symbol_date: {
                    symbol: symbol.toUpperCase(),
                    date: today
                }
            },
            update: {
                priceMetrics: JSON.stringify(priceM),
                trendMetrics: JSON.stringify(trendM),
                momentumMetrics: JSON.stringify(momentumM),
                liquidityMetrics: JSON.stringify(liquidityM),
                relativeMetrics: JSON.stringify(relativeM),
                fundamentals: JSON.stringify(fundM),
                patterns: JSON.stringify(patternsM),
                signals: JSON.stringify(signals),
                computedAt: new Date()
            },
            create: {
                symbol: symbol.toUpperCase(),
                date: today,
                priceMetrics: JSON.stringify(priceM),
                trendMetrics: JSON.stringify(trendM),
                momentumMetrics: JSON.stringify(momentumM),
                liquidityMetrics: JSON.stringify(liquidityM),
                relativeMetrics: JSON.stringify(relativeM),
                fundamentals: JSON.stringify(fundM),
                patterns: JSON.stringify(patternsM),
                signals: JSON.stringify(signals)
            }
        });

        return {
            symbol: symbol.toUpperCase(),
            priceMetrics: priceM,
            trendMetrics: trendM,
            momentumMetrics: momentumM,
            liquidityMetrics: liquidityM,
            relativeMetrics: relativeM,
            fundamentals: fundM,
            patterns: patternsM,
            signals
        };
    } catch (error) {
        logger.error(`Metrics computation failed for ${symbol}: ${error.message}`);
        return null;
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

/**
 * Get latest metrics for a symbol
 * @param {string} symbol - Stock symbol
 * @returns {Object|null} Parsed metrics or null
 */
async function getMetrics(symbol) {
    try {
        const upperSymbol = symbol.toUpperCase();

        // Always fetch current stock data for "today" metrics
        const stock = await prisma.stock.findUnique({
            where: { symbol: upperSymbol }
        });

        if (!stock) return null;

        // Build current-day data that's always available
        const currentDay = {
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

        // Fetch computed advanced metrics (may be sparse initially)
        const metrics = await prisma.stockMetrics.findFirst({
            where: { symbol: upperSymbol },
            orderBy: { date: 'desc' }
        });

        // Check historical depth for data-readiness info
        const historyCount = await prisma.marketHistory.count({
            where: { symbol: upperSymbol }
        });

        const result = {
            symbol: upperSymbol,
            currentDay,
            dataDepth: {
                historicalDays: historyCount,
                hasEnoughForMA20: historyCount >= 20,
                hasEnoughForMA50: historyCount >= 50,
                hasEnoughForRSI: historyCount >= 14,
                hasEnoughFor52w: historyCount >= 200,
                message: historyCount < 14
                    ? `Accumulating data (${historyCount}/14 days for basic indicators)`
                    : historyCount < 50
                    ? `Building history (${historyCount}/50 days for full analysis)`
                    : null
            }
        };

        if (metrics) {
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

        return result;
    } catch (error) {
        logger.error(`Failed to get metrics for ${symbol}: ${error.message}`);
        return null;
    }
}

/**
 * Get aggregate market metrics
 * @returns {Object} Aggregate market-level metrics
 */
async function getMarketMetrics() {
    try {
        const allStocks = await prisma.stock.findMany({
            where: { lastTradedPrice: { gt: 0 } }
        });

        const advancing = allStocks.filter(s => (s.change || 0) > 0).length;
        const declining = allStocks.filter(s => (s.change || 0) < 0).length;
        const unchanged = allStocks.filter(s => (s.change || 0) === 0).length;

        const totalVolume = allStocks.reduce((sum, s) => sum + (s.volume || 0), 0);
        const totalTurnover = allStocks.reduce((sum, s) => sum + (s.turnover || 0), 0);

        // Sector breakdown
        const sectorMap = {};
        for (const stock of allStocks) {
            const sector = stock.sector || 'Others';
            if (!sectorMap[sector]) {
                sectorMap[sector] = { count: 0, advancing: 0, declining: 0, totalChange: 0 };
            }
            sectorMap[sector].count++;
            sectorMap[sector].totalChange += (stock.percentageChange || 0);
            if ((stock.change || 0) > 0) sectorMap[sector].advancing++;
            if ((stock.change || 0) < 0) sectorMap[sector].declining++;
        }

        const sectors = Object.entries(sectorMap).map(([name, data]) => ({
            name,
            ...data,
            avgChange: data.count > 0 ? data.totalChange / data.count : 0
        })).sort((a, b) => b.avgChange - a.avgChange);

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

/**
 * Safe JSON parse helper
 */
function safeJsonParse(str) {
    if (!str) return null;
    try {
        return JSON.parse(str);
    } catch {
        return null;
    }
}

module.exports = {
    computeForSymbol,
    computeAll,
    getMetrics,
    getMarketMetrics
};
