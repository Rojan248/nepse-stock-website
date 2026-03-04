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
        ma180: null,
        priceVsMa20: null,   // percentage: (price - ma20) / ma20 * 100
        priceVsMa50: null,
        priceVsMa180: null,
        goldenCross: false,  // MA50 crosses above MA180
        deathCross: false,   // MA50 crosses below MA180
        trend: 'neutral'     // 'bullish' | 'bearish' | 'neutral'
    };

    if (!history || history.length === 0) return result;

    // Filter zero-volume days for MA calculations
    const tradingDays = filterTradingDays(history);
    const prices = tradingDays.map(h => h.closePrice).filter(p => p != null && p > 0);

    if (prices.length === 0) return result;

    const currentPrice = currentStock?.lastTradedPrice || prices[0];

    // Compute MAs
    result.ma20 = calcSMA(prices, 20);
    result.ma50 = calcSMA(prices, 50);
    result.ma180 = calcSMA(prices, 180);

    // Price vs MA percentages
    if (result.ma20) result.priceVsMa20 = ((currentPrice - result.ma20) / result.ma20) * 100;
    if (result.ma50) result.priceVsMa50 = ((currentPrice - result.ma50) / result.ma50) * 100;
    if (result.ma180) result.priceVsMa180 = ((currentPrice - result.ma180) / result.ma180) * 100;

    // Golden Cross / Death Cross detection
    // Need at least 2 periods of MA50 and MA180 to detect crossover
    if (prices.length >= 181) {
        const prevPrices = prices.slice(1); // shift by one day
        const prevMa50 = calcSMA(prevPrices, 50);
        const prevMa180 = calcSMA(prevPrices, 180);

        if (result.ma50 && result.ma180 && prevMa50 && prevMa180) {
            // Golden cross: MA50 was below MA180 yesterday, now above
            if (prevMa50 < prevMa180 && result.ma50 > result.ma180) {
                result.goldenCross = true;
            }
            // Death cross: MA50 was above MA180 yesterday, now below
            if (prevMa50 > prevMa180 && result.ma50 < result.ma180) {
                result.deathCross = true;
            }
        }
    }

    // Determine trend
    if (result.ma20 && result.ma50) {
        if (currentPrice > result.ma20 && result.ma20 > result.ma50) {
            result.trend = 'bullish';
        } else if (currentPrice < result.ma20 && result.ma20 < result.ma50) {
            result.trend = 'bearish';
        }
    }

    return result;
}

module.exports = { compute, filterTradingDays, calcSMA };
