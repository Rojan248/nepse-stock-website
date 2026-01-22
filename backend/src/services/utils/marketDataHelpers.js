/**
 * Market Data Helpers
 * Pure functions for market data processing logic
 */

/**
 * Determine if market data should be updated
 * @param {Object|null} latest - Latest cached market summary
 * @param {Object} merged - New merged data
 * @param {boolean} isMarketOpen - Whether market is currently open
 * @returns {Object} { shouldUpdate: boolean, reason: string }
 */
const shouldUpdateMarketData = (latest, merged, isMarketOpen) => {
    // Always update if we have no cached data
    if (!latest) {
        return { shouldUpdate: true, reason: 'no-cached-data' };
    }

    // Check if data has changed
    const hasChanged =
        merged.totalTransactions !== latest.totalTransactions ||
        merged.totalTurnover !== latest.totalTurnover ||
        merged.totalVolume !== latest.totalVolume;

    // Market closed but data changed (Final Closing Report)
    if (!isMarketOpen && hasChanged) {
        return { shouldUpdate: true, reason: 'closing-report-detected' };
    }

    // Market closed and data unchanged
    if (!isMarketOpen && !hasChanged) {
        return { shouldUpdate: false, reason: 'market-closed-unchanged' };
    }

    // Market open - always update
    return { shouldUpdate: true, reason: 'market-open' };
};

/**
 * Merge API data with cached data using nullish coalescing
 * @param {Object} apiData - Fresh data from API
 * @param {Object|null} cachedData - Cached data from database
 * @returns {Object} Merged market summary object
 */
const mergeMarketSummaryData = (apiData, cachedData = null) => {
    return {
        indexValue: apiData.indexValue ?? cachedData?.indexValue ?? null,
        indexChange: apiData.indexChange ?? cachedData?.indexChange ?? null,
        indexChangePercent: apiData.indexChangePercent ?? cachedData?.indexChangePercent ?? null,
        totalTransactions: apiData.totalTransactions ?? cachedData?.totalTransactions ?? null,
        totalTurnover: apiData.totalTurnover ?? cachedData?.totalTurnover ?? null,
        totalVolume: apiData.totalVolume ?? cachedData?.totalVolume ?? null,
        activeCompanies: apiData.activeCompanies ?? cachedData?.activeCompanies ?? null,
        advancedCompanies: apiData.advancedCompanies ?? cachedData?.advancedCompanies ?? null,
        declinedCompanies: apiData.declinedCompanies ?? cachedData?.declinedCompanies ?? null,
        unchangedCompanies: apiData.unchangedCompanies ?? cachedData?.unchangedCompanies ?? null,
        timestamp: new Date()
    };
};

/**
 * Check if market breadth data is missing/empty
 * @param {Object} summary - Market summary object
 * @returns {boolean} True if breadth data is missing
 */
const isBreadthMissing = (summary) => {
    return (
        (summary.advancedCompanies ?? 0) === 0 &&
        (summary.declinedCompanies ?? 0) === 0 &&
        (summary.unchangedCompanies ?? 0) >= 0
    );
};

/**
 * Apply breadth fallback data to summary
 * @param {Object} summary - Market summary
 * @param {Object} breadth - Breadth data { advanced, declined, unchanged }
 * @returns {Object} Updated summary with breadth
 */
const applyBreadthFallback = (summary, breadth) => {
    return {
        ...summary,
        advancedCompanies: breadth.advanced,
        declinedCompanies: breadth.declined,
        unchangedCompanies: breadth.unchanged
    };
};

/**
 * Check if we have valid market meta response
 * Encapsulates complex conditional logic for readability
 * @param {number|null} totalTransactions
 * @param {number|null} totalTurnover
 * @param {number|null} totalVolume
 * @returns {boolean} True if any value is valid
 */
const hasValidMarketMeta = (totalTransactions, totalTurnover, totalVolume) => {
    return totalTransactions !== null || totalTurnover !== null || totalVolume !== null;
};

/**
 * Extract market meta from API response
 * Single responsibility: parse response data
 * @param {Object} resp - Axios response object
 * @returns {Object} { totalTransactions, totalTurnover, totalVolume }
 */
const parseMarketMetaResponse = (resp) => {
    const body = resp.data || {};
    const totalTransactions = parseInt(body.totalTransaction || body.totalTransactions || body.totalTrades || 0) || null;
    const totalTurnover = body.totalTurnover ? parseFloat(body.totalTurnover) : null;
    const totalVolume = body.totalVolume ? parseFloat(body.totalVolume) : null;

    return { totalTransactions, totalTurnover, totalVolume };
};

/**
 * Extract transaction count from HTML with fallback patterns
 * Handles both Merolagani and NepseAlpha formats
 * @param {string} html - HTML content to parse
 * @param {Function} logFn - Logger function for debugging
 * @returns {Object|null} { totalTransactions, totalTurnover, totalVolume } or null
 */
const extractTransactionFromHTML = (html, logFn = () => { }) => {
    const match = html.match(/Total\s+Transactions[^0-9]*([0-9,]+)/i) ||
        html.match(/Transactions[^0-9]*([0-9,]+)/i);
    if (match && match[1]) {
        const raw = match[1].replace(/,/g, '');
        const count = parseInt(raw, 10);
        if (!Number.isNaN(count) && count > 0) {
            logFn(`Transaction Match Found: ${count}`);
            return { totalTransactions: count, totalTurnover: null, totalVolume: null };
        }
    }
    return null;
};

module.exports = {
    shouldUpdateMarketData,
    mergeMarketSummaryData,
    isBreadthMissing,
    applyBreadthFallback,
    hasValidMarketMeta,
    parseMarketMetaResponse,
    extractTransactionFromHTML
};
