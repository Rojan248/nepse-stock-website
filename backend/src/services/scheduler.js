const cron = require('node-cron');
const logger = require('./utils/logger');
const dataFetcher = require('./dataFetcher');

/**
 * Centralized scheduler to run market sync and transaction fixes
 * Market window (NST): 11:00 - 15:00, Sun-Thu (cron day 0-4)
 */
const initScheduler = () => {
    // Market data sync every minute during market hours
    cron.schedule('*/1 11-15 * * 0-4', async () => {
        try {
            logger.info('[Scheduler] Running market data sync...');
            await dataFetcher.fetchWithRetry(1);
        } catch (err) {
            logger.error(`[Scheduler] Market sync failed: ${err.message}`);
        }
    });

    // Fix transaction data every 5 minutes during market hours
    cron.schedule('*/5 11-15 * * 0-4', async () => {
        try {
            logger.info('[Scheduler] Fixing transaction data...');
            await dataFetcher.fixTransactionData();
        } catch (err) {
            logger.error(`[Scheduler] Transaction fix failed: ${err.message}`);
        }
    });

    // End-of-Day Snapshot (15:05, Sun-Thu)
    // Ensures accurate historical data and precise daily calculations
    cron.schedule('5 15 * * 0-4', async () => {
        try {
            const stockOps = require('./database/stockOperations');
            logger.info('[Scheduler] Running End-of-Day Market Snapshot...');
            await stockOps.snapshotDailyMarket();
        } catch (err) {
            logger.error(`[Scheduler] EOD Snapshot failed: ${err.message}`);
        }
    });

    logger.info('Scheduler initialized (market hours 11:00-15:00 NST, Sun-Thu)');
};

module.exports = {
    initScheduler
};
