const { prisma } = require('./database/connection');
const logger = require('./utils/logger');
const { Decimal } = require('@prisma/client').Prisma;

const CONDITION_EVALUATORS = {
    above: (price, threshold) => price.gte(threshold),
    below: (price, threshold) => price.lte(threshold),
    // Extensibility placeholder if pct_change is adopted without a relative marker
    pct_change: (price, threshold, previousClose) => {
        if (!previousClose || previousClose.isZero()) return false;
        const pctChange = price.minus(previousClose).dividedBy(previousClose).times(100);
        return pctChange.abs().gte(threshold.abs());
    }
};

async function processStockAlerts(stock, symbolAlerts, now) {
    let triggeredCount = 0;
    const currentPrice = stock.lastTradedPrice ? new Decimal(stock.lastTradedPrice) : null;
    if (!currentPrice) return 0;

    const prevClose = stock.previousClose ? new Decimal(stock.previousClose) : null;

    for (const alert of symbolAlerts) {
        const evaluator = CONDITION_EVALUATORS[alert.condition];
        if (!evaluator) continue;

        const threshold = new Decimal(alert.threshold);
        const isTriggered = evaluator(currentPrice, threshold, prevClose);

        if (isTriggered) {
            await prisma.$transaction([
                prisma.alertDelivery.create({
                    data: {
                        alertId: alert.id,
                        priceAtTrigger: currentPrice,
                        triggeredAt: now,
                        channel: 'in-app'
                    }
                }),
                prisma.alert.update({
                    where: { id: alert.id },
                    data: { triggeredAt: now }
                })
            ]);

            logger.info(`Alert Triggered -> Symbol: ${alert.symbol} | Condition: ${alert.condition} | Threshold: ${threshold.toNumber()} | Current: ${currentPrice.toNumber()}`);
            triggeredCount++;
        }
    }
    return triggeredCount;
}

/**
 * Checks pending active alerts against the most recent stock tick frame.
 * @param {Array} currentStockPrices - Raw stock objects directly from fetcher containing symbol, lastTradedPrice, etc.
 */
const checkAlerts = async (currentStockPrices) => {
    if (!currentStockPrices || currentStockPrices.length === 0) return { checked: 0, triggered: 0 };

    try {
        // Fetch strictly pending alerts
        const activeAlerts = await prisma.alert.findMany({
            where: {
                triggeredAt: null,
                enabled: true
            }
        });

        if (activeAlerts.length === 0) return { checked: 0, triggered: 0 };

        // Group active alerts safely into a symbol-mapped array for efficient iterations
        const groupedAlerts = {};
        for (const alert of activeAlerts) {
            if (!groupedAlerts[alert.symbol]) {
                groupedAlerts[alert.symbol] = [];
            }
            groupedAlerts[alert.symbol].push(alert);
        }

        let triggeredCount = 0;
        const now = new Date();

        // Process sequentially to enforce database constraints appropriately without racing
        for (const stock of currentStockPrices) {
            const symbolAlerts = groupedAlerts[stock.symbol];
            if (!symbolAlerts || symbolAlerts.length === 0) continue;

            triggeredCount += await processStockAlerts(stock, symbolAlerts, now);
        }

        if (triggeredCount > 0) {
            logger.info(`Alert Engine verification completed. Active: ${activeAlerts.length}, Triggered: ${triggeredCount}`);
        }

        return { checked: activeAlerts.length, triggered: triggeredCount };
    } catch (error) {
        logger.error(`Alert Engine execution failed: ${error.message}`);
        return { checked: 0, triggered: 0, error: error.message };
    }
};

module.exports = { checkAlerts };
