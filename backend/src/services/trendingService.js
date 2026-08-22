const analytics = require('./analytics');
const stockOperations = require('./database/stockOperations');

/** Enrich a single trending item with current stock data */
function enrichTrendingItem(item, stock) {
    const prices = stock.prices || {};
    return {
        symbol: item.symbol,
        name: stock.companyName || stock.symbol,
        score: item.score,
        change: prices.changePercent ?? stock.changePercent ?? 0,
        ltp: prices.ltp ?? stock.ltp ?? 0
    };
}

/**
 * Get trending stocks enriched with current stock data.
 * @param {number} limit - Maximum number of trending items
 * @returns {Promise<Array>} Trending items with live price data
 */
async function getTrendingStocks(limit) {
    // Get trending stocks from analytics
    const trending = analytics.getTrending(limit);

    // Extract symbols
    const symbols = trending.map(t => t.symbol);

    // Batch fetch stock data
    const stocks = await stockOperations.getStocksBySymbols(symbols);

    // Create a map for O(1) lookup
    const stockMap = new Map(stocks.map(s => [s.symbol, s]));

    // Enrich with current stock data, skipping unknown symbols
    return trending.flatMap((item) => {
        const stock = stockMap.get(item.symbol.toUpperCase());
        if (!stock) return [];
        return enrichTrendingItem(item, stock);
    });
}

module.exports = {
    getTrendingStocks,
    enrichTrendingItem
};
