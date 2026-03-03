const { prisma } = require('./database/connection');
const logger = require('./utils/logger');

/**
 * Alert Checker — evaluates all enabled alerts against current stock prices.
 * Called after each successful data scrape cycle from the scheduler.
 */

const CONDITION_EVALUATORS = {
    above: (price, threshold) => price >= threshold,
    below: (price, threshold) => price <= threshold,
    pct_change: (price, threshold, previousClose) => {
        if (!previousClose || previousClose === 0) return false;
        const pctChange = ((price - previousClose) / previousClose) * 100;
        return Math.abs(pctChange) >= Math.abs(threshold);
    }
};

/**
 * Check all enabled alerts and record deliveries for triggered ones.
 * Avoids re-triggering alerts that already fired in the last 24 hours.
 */
const checkAlerts = async () => {
    try {
        const alerts = await prisma.alert.findMany({
            where: { enabled: true },
            include: {
                deliveries: {
                    orderBy: { triggeredAt: 'desc' },
                    take: 1
                }
            }
        });

        if (alerts.length === 0) return { checked: 0, triggered: 0 };

        // Get unique symbols from alerts
        const symbols = [...new Set(alerts.map(a => a.symbol))];
        const stocks = await prisma.stock.findMany({ where: { symbol: { in: symbols } } });
        const priceMap = {};
        for (const s of stocks) {
            priceMap[s.symbol] = { price: s.lastTradedPrice, previousClose: s.previousClose };
        }

        let triggered = 0;
        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        for (const alert of alerts) {
            const stockData = priceMap[alert.symbol];
            if (!stockData || !stockData.price) continue;

            const evaluator = CONDITION_EVALUATORS[alert.condition];
            if (!evaluator) continue;

            const isTriggered = evaluator(stockData.price, alert.threshold, stockData.previousClose);
            if (!isTriggered) continue;

            // Check cooldown — don't re-trigger within 24 hours
            const lastDelivery = alert.deliveries[0];
            if (lastDelivery && lastDelivery.triggeredAt > twentyFourHoursAgo) continue;

            // Record delivery
            await prisma.alertDelivery.create({
                data: {
                    alertId: alert.id,
                    priceAtTrigger: stockData.price,
                    channel: 'in-app'
                }
            });

            triggered++;
            logger.info(`Alert triggered: ${alert.symbol} ${alert.condition} ${alert.threshold} (price: ${stockData.price})`);
        }

        if (triggered > 0) {
            logger.info(`Alert check complete: ${alerts.length} checked, ${triggered} triggered`);
        }

        return { checked: alerts.length, triggered };
    } catch (error) {
        logger.error(`Alert checker failed: ${error.message}`);
        return { checked: 0, triggered: 0, error: error.message };
    }
};

module.exports = { checkAlerts };
