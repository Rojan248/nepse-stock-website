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

/**
 * Find the closest history record to a target date.
 * Searches both before and after the target, returning the one with the smallest gap.
 * History must be sorted by date DESC.
 */
function findClosestRecord(symHistory, targetMs) {
    let closest = null;
    let closestGap = Infinity;

    for (const h of symHistory) {
        if (!h.closePrice || h.closePrice <= 0) continue;
        const gap = Math.abs(new Date(h.date).getTime() - targetMs);
        if (gap < closestGap) {
            closestGap = gap;
            closest = h;
        }
    }

    return { record: closest, gapMs: closestGap };
}

/** Tolerance windows in ms */
const TOLERANCE_1W_MS = 7 * 24 * 60 * 60 * 1000;   // ±7 days for weekly
const TOLERANCE_1M_MS = 14 * 24 * 60 * 60 * 1000;   // ±14 days for monthly

function getHistoricalChange(currentPrice, targetDate, symHistory, toleranceMs) {
    if (!symHistory || symHistory.length === 0) return null;
    if (!currentPrice || currentPrice <= 0) return null;
    
    const targetMs = targetDate.getTime();

    const { record, gapMs } = findClosestRecord(symHistory, targetMs);
    if (!record) return null;

    // Reject if the closest record is outside the tolerance window
    if (gapMs > toleranceMs) return null;

    // Don't compare with a record from the same date as current data
    // (that would give 0% change which isn't meaningful)
    const nowDate = new Date();
    nowDate.setHours(0, 0, 0, 0);
    const recordDate = new Date(record.date);
    recordDate.setHours(0, 0, 0, 0);
    if (recordDate.getTime() === nowDate.getTime()) return null;

    return Number((((currentPrice - record.closePrice) / record.closePrice) * 100).toFixed(2));
}

/** Individual snapshot calculator */
function calculateCumulativeForSymbol(stock, symHistory, target7d, target30d) {
    if (!symHistory || symHistory.length === 0) return { pct1W: null, pct1M: null };
    const pct1W = getHistoricalChange(stock.lastTradedPrice, target7d, symHistory, TOLERANCE_1W_MS);
    const pct1M = getHistoricalChange(stock.lastTradedPrice, target30d, symHistory, TOLERANCE_1M_MS);
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
    findClosestRecord,
    getHistoricalChange,
    calculateCumulativeForSymbol
};
