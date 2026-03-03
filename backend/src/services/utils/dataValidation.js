/**
 * Data Validation Utilities
 * Validate data structures and values
 */

/**
 * Check if a transaction count is valid
 * @param {number} count - Transaction count to validate
 * @returns {boolean} True if valid
 */
const isValidTransactionCount = (count) => {
    return !Number.isNaN(count) && count > 100;
};

/**
 * Check if data has a valid stocks array
 */
const hasValidStocksData = (data) => {
    if (!Array.isArray(data.stocks) || data.stocks.length === 0) return false;
    const firstStock = data.stocks[0];
    return typeof firstStock.symbol === 'string';
};

/**
 * Check if data has a valid market summary
 */
const hasValidMarketSummaryData = (data) => {
    if (!data.marketSummary || typeof data.marketSummary !== 'object') return false;
    const summary = data.marketSummary;
    const hasIndex = typeof summary.indexValue === 'number';
    const hasTransactions = typeof summary.totalTransactions === 'number';
    return hasIndex || hasTransactions;
};

/**
 * Check if market data object is valid and has meaningful content
 * @param {Object} data - Data object to validate
 * @returns {boolean} True if data is valid
 */
const isValidMarketData = (data) => {
    if (!data || typeof data !== 'object') return false;

    const validStocks = hasValidStocksData(data);
    const validSummary = hasValidMarketSummaryData(data);

    return validStocks || validSummary;
};

/**
 * Validate market metadata (transactions, turnover, volume)
 * @param {Object} meta - Metadata object
 * @returns {boolean} True if has at least one valid field
 */
const isValidMarketMeta = (meta) => {
    if (!meta || typeof meta !== 'object') return false;

    const hasTransactions = typeof meta.totalTransactions === 'number' && meta.totalTransactions > 0;
    const hasTurnover = typeof meta.totalTurnover === 'number' && meta.totalTurnover > 0;
    const hasVolume = typeof meta.totalVolume === 'number' && meta.totalVolume > 0;

    return hasTransactions || hasTurnover || hasVolume;
};

/**
 * Validate stock object structure
 * @param {Object} stock - Stock object to validate
 * @returns {boolean} True if valid
 */
const isValidStock = (stock) => {
    if (!stock || typeof stock !== 'object') return false;

    return (
        typeof stock.symbol === 'string' &&
        stock.symbol.length > 0 &&
        (typeof stock.ltp === 'number' || typeof stock.lastTradedPrice === 'number')
    );
};

module.exports = {
    isValidTransactionCount,
    isValidMarketData,
    isValidMarketMeta,
    isValidStock
};
