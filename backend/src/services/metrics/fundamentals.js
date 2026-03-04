/**
 * Fundamentals Module
 * Reads base price from nepseStocks.js seed data for P/B-style ratios
 */

const NEPSE_STOCKS = require('../../data/nepseStocks');

/**
 * Compute fundamental metrics for a stock
 * @param {Object} currentStock - Current stock data
 * @returns {Object} fundamentals
 */
function compute(currentStock) {
    const result = {
        basePrice: null,
        priceToBase: null,     // LTP / base price ratio
        sector: null,
        aboveBase: null        // boolean: is LTP above base?
    };

    if (!currentStock || !currentStock.symbol) return result;

    // Find seed data entry
    const seedEntry = NEPSE_STOCKS.find(
        s => s.symbol.toUpperCase() === currentStock.symbol.toUpperCase()
    );

    result.sector = currentStock.sector || seedEntry?.sector || null;

    if (seedEntry && seedEntry.base) {
        result.basePrice = seedEntry.base;

        const ltp = currentStock.lastTradedPrice;
        if (ltp && ltp > 0 && result.basePrice > 0) {
            result.priceToBase = ltp / result.basePrice;
            result.aboveBase = ltp > result.basePrice;
        }
    }

    return result;
}

module.exports = { compute };
