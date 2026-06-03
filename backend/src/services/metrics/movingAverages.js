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
    return history.filter(h => h.volume != null && Number(h.volume) > 0);
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

function computeLocalMAs(prices, result, price) {
    result.ma20  = calcSMA(prices, 20);
    result.ma50  = calcSMA(prices, 50);
    result.ma120 = calcSMA(prices, 120);
    result.ma180 = calcSMA(prices, 180);

    applyPriceComparisons(result, price);
}

const MA_COMPARISON_FIELDS = [
    ['ma20', 'priceVsMa20'],
    ['ma50', 'priceVsMa50'],
    ['ma120', 'priceVsMa120'],
    ['ma180', 'priceVsMa180'],
];

const hasAverage = (value) => Boolean(value);

const priceVsAverage = (price, average) => ((price - average) / average) * 100;

function applyPriceComparisons(result, price) {
    for (const [averageField, comparisonField] of MA_COMPARISON_FIELDS) {
        const average = result[averageField];
        if (hasAverage(average)) result[comparisonField] = priceVsAverage(price, average);
    }
}

const hasCrossHistory = (prices) => prices.length >= 181;

const buildPreviousCrossAverages = (prices) => {
    const prevPrices = prices.slice(1);
    return {
        ma50: calcSMA(prevPrices, 50),
        ma180: calcSMA(prevPrices, 180)
    };
};

const hasCrossInputs = (current, previous) =>
    hasAverage(current.ma50) && hasAverage(current.ma180) && hasAverage(previous.ma50) && hasAverage(previous.ma180);

const crossedAbove = (previousShort, previousLong, currentShort, currentLong) =>
    previousShort < previousLong && currentShort > currentLong;

const crossedBelow = (previousShort, previousLong, currentShort, currentLong) =>
    previousShort > previousLong && currentShort < currentLong;

function detectCrosses(prices, result) {
    if (!hasCrossHistory(prices)) return;

    const previous = buildPreviousCrossAverages(prices);
    if (!hasCrossInputs(result, previous)) return;

    result.goldenCross = crossedAbove(previous.ma50, previous.ma180, result.ma50, result.ma180);
    result.deathCross = crossedBelow(previous.ma50, previous.ma180, result.ma50, result.ma180);
}

const TREND_RULES = [
    {
        trend: 'bullish',
        matches: (result, price) => hasAverage(result.ma20) && hasAverage(result.ma50)
            && price > result.ma20 && result.ma20 > result.ma50
    },
    {
        trend: 'bearish',
        matches: (result, price) => hasAverage(result.ma20) && hasAverage(result.ma50)
            && price < result.ma20 && result.ma20 < result.ma50
    },
    {
        trend: 'bullish',
        matches: (result, price) => hasAverage(result.ma120) && hasAverage(result.ma180)
            && result.ma120 > result.ma180 && price > result.ma180
    },
    {
        trend: 'bearish',
        matches: (result, price) => hasAverage(result.ma120) && hasAverage(result.ma180)
            && result.ma120 < result.ma180 && price < result.ma180
    },
    {
        trend: 'bullish',
        matches: (result, price) => hasAverage(result.ma180) && price > result.ma180 * 1.03
    },
    {
        trend: 'bearish',
        matches: (result, price) => hasAverage(result.ma180) && price < result.ma180 * 0.97
    },
];

function determineTrend(result, price) {
    const rule = TREND_RULES.find(({ matches }) => matches(result, price));
    return rule?.trend || 'neutral';
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

    const currentPrice = currentStock?.lastTradedPrice ? Number(currentStock.lastTradedPrice) : null;

    if (!history || history.length === 0) {
        // No local history — apply MeroLagani external fallbacks
        _applyExtFallbacks(result, currentStock, currentPrice, 0);
        return result;
    }

    // Filter zero-volume days for MA calculations
    const tradingDays = filterTradingDays(history);
    const prices = tradingDays.map(h => Number(h.closePrice)).filter(p => p != null && p > 0);

    if (prices.length === 0) {
        _applyExtFallbacks(result, currentStock, currentPrice, 0);
        return result;
    }

    const price = currentPrice || prices[0];

    // Compute MAs from local history
    computeLocalMAs(prices, result, price);

    // Golden Cross / Death Cross detection
    detectCrosses(prices, result);

    // Apply MeroLagani fallbacks
    _applyExtFallbacks(result, currentStock, price, prices.length);

    // Determine trend
    result.trend = determineTrend(result, price);

    return result;
}

/**
 * Apply MeroLagani-sourced external fallbacks for any MA fields still null.
 * Marks applied fields with a `source_*` sibling for debugging.
 */
const EXT_FALLBACK_FIELDS = [
    { resultField: 'ma180', sourceField: 'ma180Ext', sourceMarker: 'source_ma180', comparisonField: 'priceVsMa180' },
    { resultField: 'ma120', sourceField: 'ma120Ext', sourceMarker: 'source_ma120', comparisonField: 'priceVsMa120' },
];

const isUsableExternalAverage = (value) => value != null && value !== 0;

function applyExternalAverage(result, currentStock, currentPrice, config) {
    const extValue = currentStock?.[config.sourceField];
    if (result[config.resultField] || !isUsableExternalAverage(extValue)) return;

    result[config.resultField] = extValue;
    result[config.sourceMarker] = 'merolagani';
    if (currentPrice) result[config.comparisonField] = priceVsAverage(currentPrice, extValue);
}

function _applyExtFallbacks(result, currentStock, currentPrice, localDays) {
    for (const config of EXT_FALLBACK_FIELDS) {
        applyExternalAverage(result, currentStock, currentPrice, config);
    }
}

module.exports = { compute, filterTradingDays, calcSMA };
