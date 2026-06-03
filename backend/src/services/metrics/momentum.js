/**
 * Momentum Module
 * Computes RSI (14-day, 7-day) using Wilder smoothing,
 * Rate of Change (10d, 30d)
 * Excludes zero-volume days from RSI calculation
 */

/**
 * Compute RSI using Wilder's smoothing method
 * @param {Array} prices - Close prices, most recent first
 * @param {number} period - RSI period (14 or 7)
 * @returns {number|null} RSI value 0-100, or null if insufficient data
 */
function calcRSI(prices, period) {
    // Filter zero-volume days already handled upstream; prices should be clean
    if (prices.length < period + 1) return null;

    // Reverse to chronological order for calculation
    const chronoPrices = [...prices].reverse();

    // Calculate initial average gain/loss from first `period` changes
    let avgGain = 0;
    let avgLoss = 0;

    for (let i = 1; i <= period; i++) {
        const change = chronoPrices[i] - chronoPrices[i - 1];
        if (change > 0) avgGain += change;
        else avgLoss += Math.abs(change);
    }

    avgGain /= period;
    avgLoss /= period;

    // Apply Wilder smoothing for remaining periods
    for (let i = period + 1; i < chronoPrices.length; i++) {
        const change = chronoPrices[i] - chronoPrices[i - 1];
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? Math.abs(change) : 0;

        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
    }

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

/**
 * Compute Rate of Change
 * @param {Array} prices - Close prices, most recent first
 * @param {number} period - Number of days
 * @returns {number|null} ROC as percentage
 */
function calcROC(prices, period) {
    if (prices.length <= period) return null;
    const current = prices[0];
    const past = prices[period];
    if (!past || past === 0) return null;
    return ((current - past) / past) * 100;
}

const hasHistory = (history) => Array.isArray(history) && history.length > 0;

const getTradingPrices = (history) => {
    const tradingDays = history.filter(h => h.volume != null && h.volume > 0);
    return tradingDays.map(h => h.closePrice).filter(p => p != null && p > 0);
};

const getAllValidPrices = (history) => history.map(h => h.closePrice).filter(p => p != null && p > 0);

const resolveRsiZone = (rsi14) => {
    if (rsi14 == null) return 'neutral';
    if (rsi14 > 70) return 'overbought';
    if (rsi14 < 30) return 'oversold';
    return 'neutral';
};

/**
 * Compute momentum metrics
 * @param {Array} history - MarketHistory records sorted by date DESC
 * @returns {Object} momentumMetrics
 */
function compute(history) {
    const result = {
        rsi14: null,
        rsi7: null,
        roc10d: null,
        roc30d: null,
        rsiZone: 'neutral' // 'overbought' (>70) | 'oversold' (<30) | 'neutral'
    };

    if (!hasHistory(history)) return result;

    // Filter zero-volume days for RSI
    const prices = getTradingPrices(history);

    if (prices.length === 0) return result;

    result.rsi14 = calcRSI(prices, 14);
    result.rsi7 = calcRSI(prices, 7);

    // ROC uses all history (including zero-volume days with valid prices)
    const allPrices = getAllValidPrices(history);
    result.roc10d = calcROC(allPrices, 10);
    result.roc30d = calcROC(allPrices, 30);

    // RSI zone determination
    result.rsiZone = resolveRsiZone(result.rsi14);

    return result;
}

module.exports = { compute, calcRSI, calcROC };
