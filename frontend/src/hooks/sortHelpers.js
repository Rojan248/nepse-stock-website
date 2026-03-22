/**
 * Sort helper utilities for stock data.
 * Extracted from useSortedStocks.js to reduce per-file complexity.
 */

/** Extract historical metrics dynamically */
export function getHistoricalChange(stock, pctKey) {
    const pct = stock[pctKey];
    if (pct == null) return null;
    if (pct === 0) return 0;
    const ltp = stock.ltp || stock.prices?.ltp || 0;
    return ltp - (ltp / (1 + pct / 100));
}

export function getLtp(stock) {
    if (stock.ltp != null) return stock.ltp;
    if (stock.prices?.ltp != null) return stock.prices.ltp;
    return 0;
}

export function getBaseValue(stock, key) {
    if (stock[key] !== undefined) return stock[key];
    if (stock.prices?.[key] !== undefined) return stock.prices[key];
    return 0;
}

export function getPctKey(timeframe) {
    if (timeframe === '1W') return 'percentageChange1W';
    if (timeframe === '1M') return 'percentageChange1M';
    return null;
}

/** Resolve the sort value for a stock, handling nested price fields and timeframes */
export function resolveSortValue(stock, key, timeframe = '1D') {
    if (key === 'ltp') return getLtp(stock);
    
    const pctKey = getPctKey(timeframe);
    if (pctKey) {
        if (key === 'changePercent') return stock[pctKey];
        if (key === 'change') return getHistoricalChange(stock, pctKey);
    }

    return getBaseValue(stock, key);
}

/** Compare two values with directional multiplier */
export function compareValues(aVal, bVal, dir) {
    if (aVal < bVal) return -dir;
    if (aVal > bVal) return dir;
    return 0;
}
