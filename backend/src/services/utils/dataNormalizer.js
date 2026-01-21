/**
 * Data Normalizer Service
 * Centralizes logic for normalizing stock data from various sources (scrapers, API responses)
 * so that database operations receive a consistent format.
 */

/**
 * Normalize stock input for database storage
 * Handles various input structures (flat, nested prices, nested trading)
 * @param {Object} stock - Raw stock object
 * @returns {Object} Normalized stock object ready for DB
 */
const normalizeStockInput = (stock) => {
    if (!stock) return null;

    // Extract base fields
    const symbol = (stock.symbol || '').toUpperCase();
    const companyName = stock.companyName || stock.name || symbol;
    const sector = stock.sector || null;

    // Prices can be top-level or in a 'prices' object
    const p = stock.prices || {};
    const lastTradedPrice = stock.lastTradedPrice ?? stock.ltp ?? stock.close ?? p.ltp ?? p.close ?? null;
    const previousClose = stock.previousClose ?? stock.previousClosingPrice ?? p.previousClose ?? null;
    const openPrice = stock.openPrice ?? p.open ?? null;
    const highPrice = stock.highPrice ?? p.high ?? null;
    const lowPrice = stock.lowPrice ?? p.low ?? null;

    // Trading data can be top-level or in a 'trading' object
    const t = stock.trading || {};
    const volume = stock.volume ?? t.volume ?? stock.totalTradedQuantity ?? null;
    const totalTrades = stock.totalTrades ?? t.totalTrades ?? stock.totalTradedTransactions ?? null;
    const turnover = stock.turnover ?? t.turnover ?? stock.totalTradedValue ?? null;

    // Change data
    const change = stock.change ?? p.change ?? stock.pointChange ?? null;
    const percentageChange = stock.percentageChange ?? stock.changePercent ?? p.changePercent ?? null;

    return {
        symbol,
        companyName,
        sector,
        lastTradedPrice: parseFloat(lastTradedPrice) || 0,
        previousClose: parseFloat(previousClose) || 0,
        openPrice: parseFloat(openPrice) || 0,
        highPrice: parseFloat(highPrice) || 0,
        lowPrice: parseFloat(lowPrice) || 0,
        volume: parseInt(volume) || 0,
        totalTrades: parseInt(totalTrades) || 0,
        turnover: parseFloat(turnover) || 0,
        change: parseFloat(change) || 0,
        percentageChange: parseFloat(percentageChange) || 0,
        updatedAt: new Date()
    };
};

/**
 * Map database output to API response format
 * @param {Object} stock - Database stock entity
 * @returns {Object} Standardized API response object
 */
const mapStockOutput = (stock) => {
    if (!stock) return null;
    const ltp = stock.lastTradedPrice ?? 0;
    const changePercent = stock.percentageChange ?? stock.changePercent ?? null;

    return {
        symbol: stock.symbol,
        companyName: stock.companyName,
        sector: stock.sector,
        ltp,
        lastTradedPrice: stock.lastTradedPrice,
        previousClose: stock.previousClose,
        openPrice: stock.openPrice,
        highPrice: stock.highPrice,
        lowPrice: stock.lowPrice,
        volume: stock.volume,
        totalTrades: stock.totalTrades,
        turnover: stock.turnover,
        change: stock.change,
        changePercent,
        percentageChange: changePercent,
        prices: {
            ltp,
            change: stock.change,
            changePercent
        },
        trading: {
            volume: stock.volume,
            turnover: stock.turnover,
            totalTrades: stock.totalTrades
        },
        updatedAt: stock.updatedAt ? stock.updatedAt.toISOString() : undefined,
        timestamp: stock.updatedAt ? stock.updatedAt.toISOString() : undefined
    };
};

module.exports = {
    normalizeStockInput,
    mapStockOutput
};
