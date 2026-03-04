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
function compute(history, currentStock) {
    const result = {
        high52w: null,
        low52w: null,
        atCircuitHigh: false,
        atCircuitLow: false,
        consecutiveUp: 0,
        consecutiveDown: 0,
        weeklyChange: null,
        monthlyChange: null,
        yearlyChange: null,  // 1-year price return; from MeroLagani when history insufficient
        distFromHigh52w: null,
        distFromLow52w: null,
        source52w: null // 'computed' | 'nepse' — for debugging
    };

    const currentPrice = currentStock?.lastTradedPrice || (history?.[0]?.closePrice);

    if (!history || history.length === 0) {
        // No history at all — fall back to NEPSE-provided 52W if available
        if (currentStock?.high52w && currentStock?.low52w) {
            result.high52w = currentStock.high52w;
            result.low52w = currentStock.low52w;
            result.source52w = 'nepse';
            if (currentPrice) {
                result.distFromHigh52w = ((currentPrice - result.high52w) / result.high52w) * 100;
                result.distFromLow52w = ((currentPrice - result.low52w) / result.low52w) * 100;
            }
        }
        // Apply MeroLagani yearly yield as annual return proxy
        if (currentStock?.yearlyYield != null) result.yearlyChange = currentStock.yearlyYield;
        return result;
    }

    // 52-week window (approx 235 trading days)
    const yearData = history.slice(0, TRADING_DAYS_IN_YEAR);

    if (yearData.length > 0) {
        const prices = yearData
            .map(h => h.closePrice)
            .filter(p => p != null && p > 0);

        if (prices.length > 0) {
            result.high52w = Math.max(...prices);
            result.low52w = Math.min(...prices);
            result.source52w = 'computed';

            if (result.high52w > 0 && currentPrice) {
                result.distFromHigh52w = ((currentPrice - result.high52w) / result.high52w) * 100;
            }
            if (result.low52w > 0 && currentPrice) {
                result.distFromLow52w = ((currentPrice - result.low52w) / result.low52w) * 100;
            }
        }
    }

    // Override with NEPSE-provided 52W values when history is insufficient.
    // NEPSE computes these from full exchange records — always more accurate than
    // our local history when we have fewer than TRADING_DAYS_IN_YEAR of records.
    if (currentStock?.high52w && currentStock?.low52w && yearData.length < TRADING_DAYS_IN_YEAR) {
        result.high52w = currentStock.high52w;
        result.low52w = currentStock.low52w;
        result.source52w = 'nepse';
        if (currentPrice) {
            result.distFromHigh52w = ((currentPrice - result.high52w) / result.high52w) * 100;
            result.distFromLow52w = ((currentPrice - result.low52w) / result.low52w) * 100;
        }
    }

    // Circuit detection: exactly ±10% from previous close
    if (currentStock?.previousClose && currentStock?.lastTradedPrice) {
        const prevClose = currentStock.previousClose;
        const ltp = currentStock.lastTradedPrice;
        if (prevClose > 0) {
            const changePercent = (ltp - prevClose) / prevClose;
            // Use tolerance of 0.001 (0.1%) for floating point comparison
            result.atCircuitHigh = Math.abs(changePercent - CIRCUIT_LIMIT) < 0.001;
            result.atCircuitLow = Math.abs(changePercent + CIRCUIT_LIMIT) < 0.001;
        }
    }

    // Consecutive up/down days
    for (let i = 0; i < history.length - 1; i++) {
        const change = history[i].change;
        if (change == null) break;
        if (change > 0) {
            if (result.consecutiveDown > 0) break;
            result.consecutiveUp++;
        } else if (change < 0) {
            if (result.consecutiveUp > 0) break;
            result.consecutiveDown++;
        } else {
            break; // unchanged day breaks streak
        }
    }

    // Weekly change (5 trading days)
    if (history.length >= 5 && history[4].closePrice > 0) {
        const current = history[0].closePrice;
        const week = history[4].closePrice;
        result.weeklyChange = ((current - week) / week) * 100;
    }

    // Monthly change (20 trading days)
    if (history.length >= 20 && history[19].closePrice > 0) {
        const current = history[0].closePrice;
        const month = history[19].closePrice;
        result.monthlyChange = ((current - month) / month) * 100;
    }

    // Yearly change — computed from 235 days of history when available, else MeroLagani
    if (history.length >= TRADING_DAYS_IN_YEAR && history[TRADING_DAYS_IN_YEAR - 1].closePrice > 0) {
        const current = history[0].closePrice;
        const yearAgo = history[TRADING_DAYS_IN_YEAR - 1].closePrice;
        result.yearlyChange = ((current - yearAgo) / yearAgo) * 100;
    } else if (currentStock?.yearlyYield != null && result.yearlyChange == null) {
        result.yearlyChange = currentStock.yearlyYield;
    }

    return result;
}

module.exports = { compute };
