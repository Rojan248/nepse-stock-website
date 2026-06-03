/**
 * Fundamentals Module
 * Reads base price from nepseStocks.js seed data for P/B-style ratios
 */

const NEPSE_STOCKS = require('../../data/nepseStocks');

const emptyFundamentals = () => ({
    basePrice: null,
    priceToBase: null,
    sector: null,
    aboveBase: null
});

const hasSymbol = (stock) => Boolean(stock?.symbol);

const findSeedEntry = (symbol) => NEPSE_STOCKS.find(
    s => s.symbol.toUpperCase() === symbol.toUpperCase()
);

const hasBasePrice = (seedEntry) => Boolean(seedEntry?.base);

const hasComparablePrice = (ltp, basePrice) => ltp && ltp > 0 && basePrice > 0;

const applyBaseMetrics = (result, currentStock, seedEntry) => {
    if (!hasBasePrice(seedEntry)) return;

    result.basePrice = seedEntry.base;
    const ltp = currentStock.lastTradedPrice;
    if (!hasComparablePrice(ltp, result.basePrice)) return;

    result.priceToBase = ltp / result.basePrice;
    result.aboveBase = ltp > result.basePrice;
};

/**
 * Compute fundamental metrics for a stock
 * @param {Object} currentStock - Current stock data
 * @returns {Object} fundamentals
 */
function compute(currentStock) {
    const result = emptyFundamentals();

    if (!hasSymbol(currentStock)) return result;

    const seedEntry = findSeedEntry(currentStock.symbol);

    result.sector = currentStock.sector || seedEntry?.sector || null;
    applyBaseMetrics(result, currentStock, seedEntry);

    return result;
}

module.exports = { compute };
