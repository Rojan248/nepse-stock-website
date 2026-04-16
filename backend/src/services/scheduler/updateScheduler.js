const schedule = require('node-schedule');
const logger = require('../utils/logger');
const dataFetcher = require('../dataFetcher');
const stockOperations = require('../database/stockOperations');
const ipoOperations = require('../database/ipoOperations');
const marketOperations = require('../database/marketOperations');
const { getNepseNow, getNepseNowSync, getMarketState, isMarketActive, initTimeSync, MARKET_STATES } = require('../utils/marketTime');
const watchdogService = require('../watchdog/WatchdogService');
const alertEngine = require('../alertEngine');
const { prisma } = require('../database/connection');
const dataEnricher = require('../dataEnricher');
const metricsOrchestrator = require('../metrics/metricsOrchestrator');
const updateLock = require('../utils/updateLock');

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
let previousMarketState = null;

// Market hours from environment or defaults
const MARKET_OPEN_HOUR = parseInt(process.env.MARKET_OPEN_HOUR) || 10;
const MARKET_OPEN_MINUTE = parseInt(process.env.MARKET_OPEN_MINUTE) || 0;
const MARKET_CLOSE_HOUR = parseInt(process.env.MARKET_CLOSE_HOUR) || 15;
const MARKET_CLOSE_MINUTE = parseInt(process.env.MARKET_CLOSE_MINUTE) || 0;

// Update intervals - changed to 10 seconds for market open
const MARKET_OPEN_INTERVAL = parseInt(process.env.NEPSE_UPDATE_INTERVAL) || 60000; // 60 seconds
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
 * Check if the update cycle should be skipped
 * @returns {boolean} True if update should be skipped
 */
const shouldSkipUpdate = () => {
    const currentState = getMarketState();
    
    // Check if development/mock mode is active
    let isDevMode = false;
    if (process.env.NODE_ENV === 'development') isDevMode = true;
    if (process.env.USE_MOCK_DATA === 'true') isDevMode = true;

    // Determine if it is a non-trading day
    let isNonTradingDay = false;
    if (currentState === MARKET_STATES.WEEKEND) isNonTradingDay = true;
    if (currentState === MARKET_STATES.HOLIDAY) isNonTradingDay = true;

    logger.info(`Scheduler Debug: State=${currentState}, isDev=${isDevMode}, NODE_ENV=${process.env.NODE_ENV}`);

    // If it's a closed day and we are NOT in dev mode, skip update
    if (isNonTradingDay) {
        if (!isDevMode) {
            logger.info(`Skipping update: Market is closed (${currentState})`);
            return true;
        }
    }
    
    return false;
};

/**
 * Persist stocks and IPOs to the database
 */
const persistCoreData = async (data) => {
    if (data.stocks && data.stocks.length > 0) {
        await stockOperations.saveStocks(data.stocks);
    }
    if (data.ipos && data.ipos.length > 0) {
        await ipoOperations.saveIPOs(data.ipos);
    }
};

/**
 * Persist market summary and top movers to the database
 */
const persistMarketAnalytics = async (data) => {
    if (data.marketSummary) {
        await marketOperations.upsertMarketSummary(data.marketSummary);
    }

    const hasTopMovers = data.topTurnover || data.topTrades || data.topVolume || data.topGainers || data.topLosers;
    if (hasTopMovers) {
        await marketOperations.saveTopMovers({
            turnover: data.topTurnover,
            trade: data.topTrades,
            volume: data.topVolume,
            gainers: data.topGainers,
            losers: data.topLosers
        });
    }
};

/**
 * Persist fetched data to database
 * @param {Object} data - The fetched data object from dataFetcher
 */
const saveUpdateData = async (data) => {
    await persistCoreData(data);
    await persistMarketAnalytics(data);
};

/**
 * Perform data update
 * Fetches data and saves to database
 */
const performUpdate = async () => {
    const startTime = Date.now();
    logger.info('Starting data update cycle...');

    if (shouldSkipUpdate()) {
        return false;
    }

    // Phase 3: Acquire Distributed Lock
    const hasLock = await updateLock.acquireLock('scheduler');
    if (!hasLock) {
        logger.warn('[Scheduler] Update skipped: Lock held by another instance/service');
        return false;
    }

    try {
        const data = await dataFetcher.fetchLatestData();

        if (!data) {
            logger.warn('No data received from any source');
            lastError = 'No data received';
            return false;
        }

        await saveUpdateData(data);

        lastUpdateTime = new Date();
        updateCount++;
        lastError = null;

        // Check price alerts asynchronously after successful data update
        try {
            alertEngine.checkAlerts(data.stocks).catch(alertErr => {
                logger.error(`Alert Engine background fault: ${alertErr.message}`);
            });
        } catch (alertErr) {
            logger.error(`Alert Engine initialization failed: ${alertErr.message}`);
        }

        // Compute metrics after successful data update
        try {
            await metricsOrchestrator.computeAll();
        } catch (metricsErr) {
            logger.error(`Metrics computation failed after update: ${metricsErr.message}`);
        }

        const duration = Date.now() - startTime;
        logger.info(`Update cycle completed in ${duration}ms (Source: ${data.source})`);
        return true;

        logger.error(`Update cycle failed: ${error.message}`);
        lastError = error.message;
        return false;
    } finally {
        // Phase 3: Release Distributed Lock
        await updateLock.releaseLock('scheduler');
    }
};

/**
 * Detect market close transition.
 * Called every update cycle.
 */
const checkMarketCloseTransition = () => {
    const newState = getMarketState();
    
    // Detect transition from OPEN to CLOSED
    if (previousMarketState === MARKET_STATES.OPEN && newState === MARKET_STATES.CLOSED) {
        logger.info('Market transition detected: OPEN -> CLOSED. Taking End-of-Day snapshot.');
        stockOperations.snapshotDailyMarket().catch(err => {
            logger.error(`Automated EOD Snapshot failed: ${err.message}`);
        });
    }
    
    previousMarketState = newState;
};

/**
 * Handle repetitive interval scheduling dynamically
 */
const scheduleNext = () => {
    if (!isRunning) return;

    let isDevMode = false;
    if (process.env.NODE_ENV === 'development') isDevMode = true;
    if (process.env.USE_MOCK_DATA === 'true') isDevMode = true;

    let interval = MARKET_CLOSED_INTERVAL;
    if (isMarketOpen()) {
        interval = MARKET_OPEN_INTERVAL;
    } else if (isDevMode) {
        interval = MARKET_OPEN_INTERVAL;
    }

    schedulerJob = setTimeout(async () => {
        if (isRunning) {
            try {
                await performUpdate();
            } catch (error) {
                logger.error(`Scheduled update failed: ${error.message}`);
            } finally {
                checkMarketCloseTransition();
                scheduleNext();
            }
        }
    }, interval);
};

/**
 * Setup daily and periodic cron jobs
 */
const setupCronJobs = () => {
    // EOD Fallback (3:30 PM NST every Sun-Thu)
    schedule.scheduleJob('30 15 * * 0-4', async () => {
        logger.info('Running fallback EOD snapshot (3:30 PM NST)...');
        try {
            await stockOperations.snapshotDailyMarket();
        } catch (e) {
            logger.error(`Fallback EOD snapshot failed: ${e.message}`);
        }
    });

    // Daily cleanup
    schedule.scheduleJob('0 0 * * *', async () => {
        logger.info('Running daily cleanup...');
        await marketOperations.cleanOldSummaries(30);
    });

    // Reset AI trigger flag at midnight so catch-up works next day
    schedule.scheduleJob('0 0 * * *', () => {
        aiTriggeredToday = false;
    });

    // Watchdog (Every 10 minutes)
    schedule.scheduleJob('*/10 * * * *', async () => {
        logger.info('Running scheduled watchdog verification...');
        try {
            await watchdogService.verify();
        } catch (e) {
            logger.error(`Scheduled watchdog failed: ${e.message}`);
        }
    });

    // Hourly Backups feature migrated to shell script layer instead of Node.js.
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
    previousMarketState = getMarketState(); // snapshot to avoid false transition on first cycle
    logger.info('Starting NEPSE update scheduler...');

    // Initial update
    await performUpdate();

    // Start recursive scheduling and background cron tasks
    scheduleNext();
    setupCronJobs();


    let statusLabel = 'CLOSED';
    if (isMarketOpen()) {
        statusLabel = 'OPEN';
    }

    const nst = getNSTTime();
    logger.info(`Scheduler started at ${nst.toISOString()} NST (from external time server)`);
    logger.info(`Market hours: ${MARKET_OPEN_HOUR}:${MARKET_OPEN_MINUTE.toString().padStart(2, '0')} - ${MARKET_CLOSE_HOUR}:${MARKET_CLOSE_MINUTE.toString().padStart(2, '0')} NST`);
    logger.info(`Current market status: ${statusLabel} (${currentMarketState})`);
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
        clearTimeout(schedulerJob);
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
