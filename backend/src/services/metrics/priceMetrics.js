/**
 * Price Metrics Module
 * Computes 52-week high/low, circuit detection, consecutive day streaks
 */

const CIRCUIT_LIMIT = 0.10; // ±10% exactly
const TRADING_DAYS_IN_YEAR = 235; // ~235 trading days in a NEPSE year

/**
 * Compute price metrics from historical data
 * @param {Array} history - MarketHistory records sorted by date DESC
 * @param {Object} currentStock - Current stock data (may include high52w/low52w from NEPSE)
 * @returns {Object} priceMetrics
 */
/**
 * Compute distance percentages from current price to 52w high/low
 */
function computeDistances(result, currentPrice) {
    if (result.high52w > 0 && currentPrice) {
        result.distFromHigh52w = ((currentPrice - result.high52w) / result.high52w) * 100;
    }
    if (result.low52w > 0 && currentPrice) {
        result.distFromLow52w = ((currentPrice - result.low52w) / result.low52w) * 100;
    }
}

/**
 * Set 52w high/low from NEPSE-provided values (fallback source)
 */
function apply52wFromNepse(result, currentStock, currentPrice) {
    if (!currentStock?.high52w || !currentStock?.low52w) return;
    result.high52w = currentStock.high52w;
    result.low52w = currentStock.low52w;
    result.source52w = 'nepse';
    if (currentPrice) computeDistances(result, currentPrice);
}

/**
 * Compute 52w high/low from local history, with NEPSE override when history is short
 */
function compute52wRange(result, yearData, currentPrice, currentStock) {
    const prices = yearData.map(h => h.closePrice).filter(p => p != null && p > 0);

    if (prices.length > 0) {
        result.high52w = Math.max(...prices);
        result.low52w = Math.min(...prices);
        result.source52w = 'computed';
        computeDistances(result, currentPrice);
    }

    // Override with NEPSE values when local history is insufficient
    const shouldOverride = currentStock?.high52w && currentStock?.low52w && yearData.length < TRADING_DAYS_IN_YEAR;
    if (shouldOverride) apply52wFromNepse(result, currentStock, currentPrice);
}

function isValidForCircuit(prevClose, ltp) {
    return Boolean(prevClose && ltp && prevClose > 0);
}

/**
 * Detect circuit breaker hits (exactly ±10% from previous close)
 */
function detectCircuit(result, currentStock) {
    const prevClose = currentStock?.previousClose;
    const ltp = currentStock?.lastTradedPrice;
    if (!isValidForCircuit(prevClose, ltp)) return;

    const changePercent = (ltp - prevClose) / prevClose;
    result.atCircuitHigh = Math.abs(changePercent - CIRCUIT_LIMIT) < 0.001;
    result.atCircuitLow = Math.abs(changePercent + CIRCUIT_LIMIT) < 0.001;
}

/**
 * Count consecutive up or down trading days from most recent history
 */
function countStreaks(result, history) {
    let activeDirection = null;

    for (let i = 0; i < history.length - 1; i++) {
        const change = history[i].change;
        if (change == null || change === 0) break;

        const currentDirection = change > 0 ? 'up' : 'down';
        
        if (activeDirection === null) {
            activeDirection = currentDirection;
        } else if (activeDirection !== currentDirection) {
            break;
        }

        if (activeDirection === 'up') result.consecutiveUp++;
        else result.consecutiveDown++;
    }
}

function hasValidHistoryForPeriod(history, days) {
    const idx = days - 1;
    return Boolean(history.length >= days && history[idx].closePrice && history[idx].closePrice > 0);
}

/**
 * Compute percentage change over a given number of trading days
 */
function periodChange(history, days) {
    if (!hasValidHistoryForPeriod(history, days)) return null;
    
    const idx = days - 1;
    return ((history[0].closePrice - history[idx].closePrice) / history[idx].closePrice) * 100;
}

function fillFallbackMissingHistory(result, currentStock, currentPrice) {
    apply52wFromNepse(result, currentStock, currentPrice);
    if (currentStock?.yearlyYield != null) result.yearlyChange = currentStock.yearlyYield;
    return result;
}

function computeYearlyChange(history, currentStock) {
    const calculated = periodChange(history, TRADING_DAYS_IN_YEAR);
    if (calculated !== null) return calculated;
    return currentStock?.yearlyYield != null ? currentStock.yearlyYield : null;
}

/**
 * Compute price metrics from historical data
 * @param {Array} history - MarketHistory records sorted by date DESC
 * @param {Object} currentStock - Current stock data (may include high52w/low52w from NEPSE)
 * @returns {Object} priceMetrics
 */
function compute(history, currentStock) {
    const result = {
        high52w: null, low52w: null,
        atCircuitHigh: false, atCircuitLow: false,
        consecutiveUp: 0, consecutiveDown: 0,
        weeklyChange: null, monthlyChange: null,
        yearlyChange: null,
        distFromHigh52w: null, distFromLow52w: null,
        source52w: null
    };

    const currentPrice = currentStock?.lastTradedPrice || (history?.[0]?.closePrice);

    if (!history || history.length === 0) {
        return fillFallbackMissingHistory(result, currentStock, currentPrice);
    }

    compute52wRange(result, history.slice(0, TRADING_DAYS_IN_YEAR), currentPrice, currentStock);
    detectCircuit(result, currentStock);
    countStreaks(result, history);

    result.weeklyChange = periodChange(history, 5);
    result.monthlyChange = periodChange(history, 20);
    result.yearlyChange = computeYearlyChange(history, currentStock);

    return result;
}

module.exports = { compute };
