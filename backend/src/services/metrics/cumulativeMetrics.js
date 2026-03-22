/**
 * Cumulative Metrics Calculation
 * Extracted from metricsOrchestrator.js to reduce file complexity.
 * Handles the pre-calculation of 1W and 1M changes for all stocks.
 */

const { prisma } = require('../database/connection');
const logger = require('../utils/logger');

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

module.exports = {
    computeCumulativeStockMetrics,
    // Explicitly exporting helpers for ease of testing if needed
    buildHistoryMap,
    getHistoricalChange,
    calculateCumulativeForSymbol
};
