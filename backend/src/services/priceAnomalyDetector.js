const { prisma } = require('./database/connection');
const logger = require('./utils/logger');

/**
 * Check for price anomalies between incoming data and current database state.
 * Rejects data if a single stock moves by more than ±15% (NEPSE circuit breaker limit).
 * @param {Array} incomingStocks - Array of normalized incoming stocks
 * @returns {Promise<boolean>} True if internal anomalies detected
 */
const hasPriceAnomalies = async (incomingStocks) => {
    if (!incomingStocks || incomingStocks.length === 0) return false;

    try {
        const symbols = incomingStocks.map(s => s.symbol);
        const existingMap = await loadExistingPriceMap(symbols);

        for (const stock of incomingStocks) {
            const anomaly = getPriceAnomaly(stock, existingMap);
            if (!anomaly) continue;
            logPriceAnomaly(stock.symbol, anomaly);
            return true;
        }
    } catch (error) {
        logger.error(`Anomaly detection failed: ${error.message}`);
        return false; // Fail safe
    }
    return false;
};

const loadExistingPriceMap = async (symbols) => {
    const existingStocks = await prisma.stock.findMany({
        where: { symbol: { in: symbols } },
        select: { symbol: true, lastTradedPrice: true }
    });

    return new Map(existingStocks.map(s => [s.symbol, s.lastTradedPrice]));
};

const hasUsablePrice = (price) => Number(price) > 0;

const calculatePriceDelta = (oldPrice, newPrice) => Math.abs(newPrice - oldPrice) / oldPrice;

const getPriceAnomaly = (stock, existingMap) => {
    const oldPrice = existingMap.get(stock.symbol);
    const newPrice = stock.lastTradedPrice;

    if (!hasUsablePrice(oldPrice) || !hasUsablePrice(newPrice)) {
        return null;
    }

    const delta = calculatePriceDelta(oldPrice, newPrice);
    return delta > 0.15 ? { oldPrice, newPrice, delta } : null;
};

const logPriceAnomaly = (symbol, { oldPrice, newPrice, delta }) => {
    const percent = (delta * 100).toFixed(1);
    logger.error(`[Anomaly] Rejecting data: ${symbol} moved ${percent}% (${oldPrice} -> ${newPrice})`);
};

module.exports = {
    hasPriceAnomalies
};
