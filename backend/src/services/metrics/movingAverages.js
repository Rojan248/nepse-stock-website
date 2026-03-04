/**
 * Moving Averages Module
 * Computes MA20, MA50, MA180 — excludes zero-volume days
 * Detects golden cross and death cross patterns
 */

/**
 * Filter out zero-volume days from history
 * @param {Array} history - MarketHistory records
 * @returns {Array} Filtered records with volume > 0
 */
function filterTradingDays(history) {
    return history.filter(h => h.volume != null && h.volume > 0);
}

/**
 * Compute simple moving average from close prices
 * @param {Array} prices - Array of close prices
 * @param {number} period - MA period
 * @returns {number|null} MA value or null if insufficient data
 */
function calcSMA(prices, period) {
    if (prices.length < period) return null;
    const slice = prices.slice(0, period);
    const sum = slice.reduce((a, b) => a + b, 0);
    return sum / period;
}

/**
 * Compute moving average metrics
 * @param {Array} history - MarketHistory records sorted by date DESC
 * @param {Object} currentStock - Current stock data
 * @returns {Object} trendMetrics
 */
function compute(history, currentStock) {
    const result = {
        ma20: null,
        ma50: null,
        ma120: null,   // 120-day MA (from MeroLagani when history insufficient)
        ma180: null,
        priceVsMa20: null,   // percentage: (price - ma20) / ma20 * 100
        priceVsMa50: null,
        priceVsMa120: null,
        priceVsMa180: null,
        goldenCross: false,  // MA50 crosses above MA180
        deathCross: false,   // MA50 crosses below MA180
        trend: 'neutral'     // 'bullish' | 'bearish' | 'neutral'
    };

    const currentPrice = currentStock?.lastTradedPrice || null;

    if (!history || history.length === 0) {
        // No local history — apply MeroLagani external fallbacks
        _applyExtFallbacks(result, currentStock, currentPrice, 0);
        return result;
    }

    // Filter zero-volume days for MA calculations
    const tradingDays = filterTradingDays(history);
    const prices = tradingDays.map(h => h.closePrice).filter(p => p != null && p > 0);

    if (prices.length === 0) {
        _applyExtFallbacks(result, currentStock, currentPrice, 0);
        return result;
    }

    const price = currentPrice || prices[0];

    // Compute MAs from local history
    result.ma20  = calcSMA(prices, 20);
    result.ma50  = calcSMA(prices, 50);
    result.ma120 = calcSMA(prices, 120);
    result.ma180 = calcSMA(prices, 180);

    // Price vs MA percentages
    if (result.ma20)  result.priceVsMa20  = ((price - result.ma20)  / result.ma20)  * 100;
    if (result.ma50)  result.priceVsMa50  = ((price - result.ma50)  / result.ma50)  * 100;
    if (result.ma120) result.priceVsMa120 = ((price - result.ma120) / result.ma120) * 100;
    if (result.ma180) result.priceVsMa180 = ((price - result.ma180) / result.ma180) * 100;

    // Golden Cross / Death Cross detection
    if (prices.length >= 181) {
        const prevPrices = prices.slice(1); // shift by one day
        const prevMa50  = calcSMA(prevPrices, 50);
        const prevMa180 = calcSMA(prevPrices, 180);

        if (result.ma50 && result.ma180 && prevMa50 && prevMa180) {
            if (prevMa50 < prevMa180 && result.ma50 > result.ma180) result.goldenCross = true;
            if (prevMa50 > prevMa180 && result.ma50 < result.ma180) result.deathCross  = true;
        }
    }

    // Apply MeroLagani fallbacks for any MAs still null after local computation
    _applyExtFallbacks(result, currentStock, price, prices.length);

    // Determine trend
    if (result.ma20 && result.ma50) {
        // Primary: computed from local history
        if      (price > result.ma20 && result.ma20 > result.ma50) result.trend = 'bullish';
        else if (price < result.ma20 && result.ma20 < result.ma50) result.trend = 'bearish';
    } else if (result.ma120 && result.ma180) {
        // Fallback trend signal: MA120 vs MA180 relationship (uses MeroLagani data)
        // MA120 > MA180 means near-term avg above long-term avg → upward momentum
        if      (result.ma120 > result.ma180 && price > result.ma180) result.trend = 'bullish';
        else if (result.ma120 < result.ma180 && price < result.ma180) result.trend = 'bearish';
    } else if (result.ma180 && price) {
        // Minimal fallback: price vs MA180 only
        if      (price > result.ma180 * 1.03) result.trend = 'bullish';
        else if (price < result.ma180 * 0.97) result.trend = 'bearish';
    }

    return result;
}

/**
 * Apply MeroLagani-sourced external fallbacks for any MA fields still null.
 * Marks applied fields with a `source_*` sibling for debugging.
 */
function _applyExtFallbacks(result, currentStock, currentPrice, localDays) {
    const ext180 = currentStock?.ma180Ext;
    const ext120 = currentStock?.ma120Ext;

    if (!result.ma180 && ext180 != null && ext180 !== 0) {
        result.ma180 = ext180;
        result.source_ma180 = 'merolagani';
        if (currentPrice && ext180 !== 0) result.priceVsMa180 = ((currentPrice - ext180) / ext180) * 100;
    }
    if (!result.ma120 && ext120 != null && ext120 !== 0) {
        result.ma120 = ext120;
        result.source_ma120 = 'merolagani';
        if (currentPrice && ext120 !== 0) result.priceVsMa120 = ((currentPrice - ext120) / ext120) * 100;
    }
}

module.exports = { compute, filterTradingDays, calcSMA };
