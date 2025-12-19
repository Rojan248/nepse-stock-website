const schedule = require('node-schedule');
const logger = require('../utils/logger');
const dataFetcher = require('../dataFetcher');
const stockOperations = require('../database/stockOperations');
const ipoOperations = require('../database/ipoOperations');
const marketOperations = require('../database/marketOperations');
const { getNepseNow, getNepseNowSync, getMarketState, isMarketActive, initTimeSync, MARKET_STATES } = require('../utils/marketTime');

/**
 * Update Scheduler
 * Handles automatic data fetching based on market hours
 * Uses external time server for accurate Nepal time
 */

// Scheduler state
let schedulerJob = null;
let isRunning = false;
let lastUpdateTime = null;
let updateCount = 0;
let lastError = null;
let currentMarketState = null;

// Market hours from environment or defaults
const MARKET_OPEN_HOUR = parseInt(process.env.MARKET_OPEN_HOUR) || 10;
const MARKET_OPEN_MINUTE = parseInt(process.env.MARKET_OPEN_MINUTE) || 0;
const MARKET_CLOSE_HOUR = parseInt(process.env.MARKET_CLOSE_HOUR) || 15;
const MARKET_CLOSE_MINUTE = parseInt(process.env.MARKET_CLOSE_MINUTE) || 0;

// Update intervals - changed to 10 seconds for market open
const MARKET_OPEN_INTERVAL = parseInt(process.env.NEPSE_UPDATE_INTERVAL) || 10000; // 10 seconds
const MARKET_CLOSED_INTERVAL = 60 * 60 * 1000; // 1 hour

/**
 * Get current Nepal Standard Time (uses external time server)
 * @returns {Date} Current NST time
 */
const getNSTTime = () => {
    return getNepseNowSync();
};

/**
 * Check if market is currently open
 * Market hours: 10:00 AM - 3:00 PM NST, Sunday-Thursday
 * @returns {boolean} True if market is open
 */
const isMarketOpen = () => {
    currentMarketState = getMarketState();
    return currentMarketState === MARKET_STATES.OPEN;
};


/**
 * Perform data update
 * Fetches data and saves to database
 */
const performUpdate = async () => {
    const startTime = Date.now();
    logger.info('Starting data update cycle...');

    // Scheduler Shield: Skip updates on weekends
    const currentState = getMarketState();
    if (currentState === MARKET_STATES.WEEKEND) {
        logger.info('Skipping update: Market is closed (WEEKEND)');
        return false;
    }

    try {
        // Fetch latest data
        const data = await dataFetcher.fetchLatestData();

        if (!data) {
            logger.warn('No data received from any source');
            lastError = 'No data received';
            return false;
        }

        // Save stocks
        if (data.stocks && data.stocks.length > 0) {
            await stockOperations.saveStocks(data.stocks);
        }

        // Save IPOs
        if (data.ipos && data.ipos.length > 0) {
            await ipoOperations.saveIPOs(data.ipos);
        }

        // Save market summary
        if (data.marketSummary) {
            await marketOperations.upsertMarketSummary(data.marketSummary);
        }

        // Update state
        lastUpdateTime = new Date();
        updateCount++;
        lastError = null;

        const duration = Date.now() - startTime;
        logger.info(`Update cycle completed in ${duration}ms (Source: ${data.source})`);

        return true;

    } catch (error) {
        logger.error(`Update cycle failed: ${error.message}`);
        lastError = error.message;
        return false;
    }
};

/**
 * Start the update scheduler
 */
const startScheduler = async () => {
    if (isRunning) {
        logger.warn('Scheduler is already running');
        return;
    }

    // Initialize time sync with external server first
    await initTimeSync();

    isRunning = true;
    logger.info('Starting NEPSE update scheduler...');

    // Initial update
    performUpdate();

    // Schedule updates based on market status
    const scheduleNextUpdate = () => {
        if (!isRunning) return;

        const marketOpen = isMarketOpen();
        const interval = marketOpen ? MARKET_OPEN_INTERVAL : MARKET_CLOSED_INTERVAL;
        const state = currentMarketState || 'UNKNOWN';

        if (marketOpen) {
            logger.debug(`Market is OPEN (${state}). Next update in ${interval / 1000}s`);
        } else {
            logger.debug(`Market is CLOSED (${state}). Next update in ${interval / 60000}min`);
        }

        setTimeout(async () => {
            if (isRunning) {
                await performUpdate();
                scheduleNextUpdate();
            }
        }, interval);
    };

    scheduleNextUpdate();

    // Also schedule daily cleanup
    schedulerJob = schedule.scheduleJob('0 0 * * *', async () => {
        logger.info('Running daily cleanup...');
        await marketOperations.cleanOldSummaries(30);
    });

    const nst = getNSTTime();
    logger.info(`Scheduler started at ${nst.toISOString()} NST (from external time server)`);
    logger.info(`Market hours: ${MARKET_OPEN_HOUR}:${MARKET_OPEN_MINUTE.toString().padStart(2, '0')} - ${MARKET_CLOSE_HOUR}:${MARKET_CLOSE_MINUTE.toString().padStart(2, '0')} NST`);
    logger.info(`Current market status: ${isMarketOpen() ? 'OPEN' : 'CLOSED'} (${currentMarketState})`);
};


/**
 * Stop the scheduler
 */
const stopScheduler = () => {
    if (!isRunning) {
        logger.warn('Scheduler is not running');
        return;
    }

    isRunning = false;

    if (schedulerJob) {
        schedulerJob.cancel();
        schedulerJob = null;
    }

    logger.info('Scheduler stopped');
};

/**
 * Get last update time
 * @returns {Date|null} Last successful update time
 */
const getLastUpdateTime = () => lastUpdateTime;

/**
 * Get scheduler status
 * @returns {Object} Status object
 */
const getUpdateStatus = () => ({
    isRunning,
    isMarketOpen: isMarketOpen(),
    lastUpdateTime: lastUpdateTime ? lastUpdateTime.toISOString() : null,
    updateCount,
    lastError,
    currentNST: getNSTTime().toISOString(),
    marketHours: {
        open: `${MARKET_OPEN_HOUR}:${MARKET_OPEN_MINUTE.toString().padStart(2, '0')}`,
        close: `${MARKET_CLOSE_HOUR}:${MARKET_CLOSE_MINUTE.toString().padStart(2, '0')}`
    },
    dataSource: dataFetcher.getDataSource()
});

/**
 * Force immediate update
 * @returns {boolean} Success status
 */
const forceUpdate = async () => {
    logger.info('Forcing immediate update...');
    return await performUpdate();
};

module.exports = {
    startScheduler,
    stopScheduler,
    isMarketOpen,
    getLastUpdateTime,
    getUpdateStatus,
    forceUpdate,
    getNSTTime
};
