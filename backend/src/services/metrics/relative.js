/**
 * Relative Metrics Module
 * Compares stock performance against sector average and full market
 */

const { prisma } = require('../database/connection');

/**
 * Compute relative metrics for a stock
 * @param {Object} currentStock - Current stock data with sector
 * @param {Array} allStocks - All stocks for ranking (optional, fetched if null)
 * @returns {Object} relativeMetrics
 */
async function compute(currentStock, allStocks = null) {
    const result = {
        vsSectorAvg: null,      // % difference from sector average change
        sectorRank: null,       // rank within sector (1 = best)
        sectorTotal: null,      // total stocks in sector
        marketRank: null,       // rank in entire market
        marketTotal: null,      // total stocks in market
        sectorAvgChange: null   // sector average % change
    };

    if (!currentStock || !currentStock.sector) return result;

    try {
        // Fetch all stocks if not provided
        if (!allStocks) {
            allStocks = await prisma.stock.findMany({
                where: { lastTradedPrice: { gt: 0 } },
                select: {
                    symbol: true,
                    sector: true,
                    percentageChange: true,
                    lastTradedPrice: true
                }
            });
        }

        if (allStocks.length === 0) return result;

        const stockChange = currentStock.percentageChange || 0;

        // Sector metrics
        const sectorStocks = allStocks
            .filter(s => s.sector === currentStock.sector && s.lastTradedPrice > 0);

        if (sectorStocks.length > 0) {
            // Sector average change
            const sectorChanges = sectorStocks
                .map(s => s.percentageChange || 0);
            result.sectorAvgChange = sectorChanges.reduce((a, b) => a + b, 0) / sectorChanges.length;
            result.vsSectorAvg = stockChange - result.sectorAvgChange;

            // Sector rank (sort by % change descending)
            const sectorSorted = [...sectorStocks].sort(
                (a, b) => (b.percentageChange || 0) - (a.percentageChange || 0)
            );
            result.sectorRank = sectorSorted.findIndex(s => s.symbol === currentStock.symbol) + 1;
            result.sectorTotal = sectorStocks.length;
        }

        // Market rank
        const marketSorted = [...allStocks]
            .filter(s => s.lastTradedPrice > 0)
            .sort((a, b) => (b.percentageChange || 0) - (a.percentageChange || 0));
        result.marketRank = marketSorted.findIndex(s => s.symbol === currentStock.symbol) + 1;
        result.marketTotal = marketSorted.length;

    } catch (error) {
        // Fail gracefully — relative metrics are non-critical
        console.error(`Relative metrics error for ${currentStock.symbol}: ${error.message}`);
    }

    return result;
}

module.exports = { compute };
