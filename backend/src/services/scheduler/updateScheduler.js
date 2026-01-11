const schedule = require('node-schedule');
const logger = require('../utils/logger');
const dataFetcher = require('../dataFetcher');
const stockOperations = require('../database/stockOperations');
const ipoOperations = require('../database/ipoOperations');
const marketOperations = require('../database/marketOperations');
const { getNepseNow, getNepseNowSync, getMarketState, isMarketActive, initTimeSync, MARKET_STATES } = require('../utils/marketTime');
const watchdogService = require('../watchdog/WatchdogService');
const { isAnyLockActive, getLockStatus } = require('../utils/updateLock');
const { withRetry, isCircuitClosed, recordFailure, recordSuccess, getCircuitStatus } = require('../utils/asyncRetry');
const { sendAlert, recordSyncSuccess, recordSyncFailure, sendDailyDigest, getAlertStatus } = require('../utils/alertService');

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
let failureCount = 0;
let consecutiveFailures = 0;
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
 * Core data fetch and save logic (called by performUpdate with retry wrapper)
 */
const fetchAndSaveData = async () => {
    // Fetch latest data
    const data = await dataFetcher.fetchLatestData();

    if (!data) {
        throw new Error('No data received from any source');
    }

    // Validate minimum data quality
    if (!data.stocks || data.stocks.length < 100) {
        throw new Error(`Insufficient stock data: only ${data.stocks?.length || 0} stocks received (expected 200+)`);
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

    // Save Top Movers
    if (data.topTurnover || data.topTrades || data.topVolume || data.topGainers || data.topLosers) {
        await marketOperations.saveTopMovers(
            data.topTurnover,
            data.topTrades,
            data.topVolume,
            data.topGainers,
            data.topLosers
        );
    }

    return data;
};

/**
 * Perform data update with retry logic and circuit breaker
 * Fetches data and saves to database
 */
const performUpdate = async () => {
    const startTime = Date.now();
    logger.info('Starting data update cycle...');

    // Weekend handling: Still fetch data (last trading day's closing data is available)
    // but at reduced frequency (hourly instead of every 10 seconds)
    const currentState = getMarketState();
    const isDev = process.env.NODE_ENV === 'development' || process.env.USE_MOCK_DATA === 'true';
    const isWeekend = currentState === MARKET_STATES.WEEKEND;

    logger.debug(`Scheduler Debug: State=${currentState}, isDev=${isDev}, isWeekend=${isWeekend}`);

    // Skip if Watchdog is currently correcting data (prevent race condition)
    if (isAnyLockActive()) {
        const lockInfo = getLockStatus();
        logger.info(`[Scheduler] Skipping update: Watchdog lock active (owner: ${lockInfo.lockOwner}, expires in ${Math.round(lockInfo.remainingMs / 1000)}s)`);
        return false;
    }

    // Circuit breaker check - don't hammer NEPSE if it's down
    if (!isCircuitClosed()) {
        logger.warn('[Scheduler] Circuit breaker is OPEN. Skipping update.');
        return false;
    }

    try {
        // Fetch and save with retry logic
        const data = await withRetry(
            fetchAndSaveData,
            { retries: 3 }, // Fewer retries per cycle (scheduler will try again)
            'fetchAndSaveData'
        );

        // Update state on success
        lastUpdateTime = new Date();
        updateCount++;
        consecutiveFailures = 0;
        lastError = null;

        // Record success for alerting and circuit breaker
        recordSuccess();
        recordSyncSuccess();

        const duration = Date.now() - startTime;
        logger.info(`Update cycle completed in ${duration}ms (Source: ${data.source})`);

        return true;

    } catch (error) {
        logger.error(`Update cycle failed after retries: ${error.message}`);
        lastError = error.message;
        failureCount++;
        consecutiveFailures++;

        // Record failure for circuit breaker and alerting
        recordFailure();
        recordSyncFailure();

        // Send alert on failure (rate-limited)
        await sendAlert(
            `Sync failed: ${error.message}\nConsecutive failures: ${consecutiveFailures}`,
            'error',
            'sync_failure'
        );

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
        const isDev = process.env.NODE_ENV === 'development' || process.env.USE_MOCK_DATA === 'true';
        const interval = (marketOpen || isDev) ? MARKET_OPEN_INTERVAL : MARKET_CLOSED_INTERVAL;
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

    // Schedule Watchdog (Every 10 minutes)
    schedule.scheduleJob('*/10 * * * *', async () => {
        logger.info('Running scheduled watchdog verification...');
        try {
            await watchdogService.verify();
        } catch (e) {
            logger.error(`Scheduled watchdog failed: ${e.message}`);
        }
    });

    // Schedule Daily Digest Alert at 3:30 PM (after market close)
    schedule.scheduleJob('30 15 * * 0-4', async () => {
        logger.info('Sending daily sync digest...');
        try {
            await sendDailyDigest();
        } catch (e) {
            logger.error(`Daily digest failed: ${e.message}`);
        }
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
    failureCount,
    consecutiveFailures,
    lastError,
    currentNST: getNSTTime().toISOString(),
    marketHours: {
        open: `${MARKET_OPEN_HOUR}:${MARKET_OPEN_MINUTE.toString().padStart(2, '0')}`,
        close: `${MARKET_CLOSE_HOUR}:${MARKET_CLOSE_MINUTE.toString().padStart(2, '0')}`
    },
    dataSource: dataFetcher.getDataSource(),
    circuitBreaker: getCircuitStatus(),
    alerting: getAlertStatus()
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
