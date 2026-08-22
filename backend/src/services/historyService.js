const logger = require('./utils/logger');
const { prisma } = require('./database/connection');

/**
 * Get historical price data for a symbol combined with trend metrics.
 * @param {string} symbol - Stock symbol
 * @param {number} days - Number of days of history
 * @returns {Promise<Array>} Combined OHLCV + moving-average rows (oldest first)
 */
async function getStockHistoryWithMetrics(symbol, days) {
    const startTime = performance.now();

    const historyDesc = await prisma.marketHistory.findMany({
        where: { symbol },
        orderBy: { date: 'desc' },
        take: days
    });
    const history = historyDesc.reverse();

    if (history.length === 0) {
        return [];
    }

    const historyDates = history.map((entry) => entry.date);
    const metrics = await prisma.stockMetrics.findMany({
        where: {
            symbol,
            date: { in: historyDates }
        },
        orderBy: { date: 'asc' }
    });

    // Create a map for O(1) metrics lookup
    const metricsMap = new Map(metrics.map(m => [m.date.toISOString().split('T')[0], m]));

    const combinedData = history.map(h => {
        const dateStr = h.date.toISOString().split('T')[0];
        const m = metricsMap.get(dateStr);
        const trend = m ? JSON.parse(m.trendMetrics || '{}') : {};

        return {
            date: dateStr, // lightweight-charts accepts "YYYY-MM-DD"
            open: parseFloat(h.openPrice),
            high: parseFloat(h.highPrice),
            low: parseFloat(h.lowPrice),
            close: parseFloat(h.closePrice),
            volume: parseFloat(h.volume || 0),
            ma20: trend.ma20 || null,
            ma50: trend.ma50 || null
        };
    });

    const endTime = performance.now();
    logger.info(`GET /api/stocks/${symbol}/history execution time: ${(endTime - startTime).toFixed(2)}ms`);

    return combinedData;
}

module.exports = {
    getStockHistoryWithMetrics
};
