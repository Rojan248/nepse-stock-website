const schedule = require('node-schedule');
const logger = require('../utils/logger');
const dataFetcher = require('../dataFetcher');
const stockOperations = require('../database/stockOperations');
const ipoOperations = require('../database/ipoOperations');
const marketOperations = require('../database/marketOperations');
const { getNepseNow, getNepseNowSync, getMarketState, isMarketActive, initTimeSync, MARKET_STATES } = require('../utils/marketTime');
const watchdogService = require('../watchdog/WatchdogService');
const alertChecker = require('../alertChecker');
const metricsOrchestrator = require('../metrics/metricsOrchestrator');
const aiOverviewService = require('../aiOverviewService');

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
 * Check if the update cycle should be skipped (e.g. weekends in production)
 * @returns {boolean} True if update should be skipped
 */
const shouldSkipUpdate = () => {
    const currentState = getMarketState();
    const isDev = process.env.NODE_ENV === 'development' || process.env.USE_MOCK_DATA === 'true';

    logger.info(`Scheduler Debug: State=${currentState}, isDev=${isDev}, NODE_ENV=${process.env.NODE_ENV}`);

    if (currentState === MARKET_STATES.WEEKEND && !isDev) {
        logger.info('Skipping update: Market is closed (WEEKEND)');
        return true;
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

        // Check price alerts after successful data update
        try {
            await alertChecker.checkAlerts();
        } catch (alertErr) {
            logger.error(`Alert check failed after update: ${alertErr.message}`);
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

    } catch (error) {
        logger.error(`Update cycle failed: ${error.message}`);
        lastError = error.message;
        return false;
    }
};

/**
 * Handle repetitive interval scheduling dynamically
 */
const scheduleNext = () => {
    if (!isRunning) return;

    const isDev = process.env.NODE_ENV === 'development' || process.env.USE_MOCK_DATA === 'true';
    const interval = (isMarketOpen() || isDev) ? MARKET_OPEN_INTERVAL : MARKET_CLOSED_INTERVAL;

    schedulerJob = setTimeout(async () => {
        if (isRunning) {
            try {
                await performUpdate();
            } catch (error) {
                logger.error(`Scheduled update failed: ${error.message}`);
            } finally {
                scheduleNext();
            }
        }
    }, interval);
};

/**
 * Setup daily and periodic cron jobs
 */
const setupCronJobs = () => {
    // Daily cleanup
    schedule.scheduleJob('0 0 * * *', async () => {
        logger.info('Running daily cleanup...');
        await marketOperations.cleanOldSummaries(30);
    });

    // AI Overview: Regenerate market overview after market close (15:15 NST, Sun-Thu)
    schedule.scheduleJob('15 15 * * 0-4', async () => {
        logger.info('[Scheduler] Generating market overview after market close...');
        try {
            await aiOverviewService.generateMarketOverview('scheduler');
        } catch (e) {
            logger.error(`[Scheduler] Market overview generation failed: ${e.message}`);
        }
    });

    // AI Overview: Regenerate all stock overviews daily (15:30 NST, Sun-Thu)
    // Processes in chunks with rate-limit awareness to stay within free-tier quotas
    schedule.scheduleJob('30 15 * * 0-4', async () => {
        logger.info('[Scheduler] Starting daily AI stock overview generation...');
        try {
            const stats = await aiOverviewService.generateAll('scheduler');
            logger.info(`[Scheduler] AI generation done: ${stats.generated} generated, ${stats.failed} failed, ${stats.skipped} fresh${stats.quotaExhausted ? ' (quota exhausted — will resume tomorrow)' : ''}`);
        } catch (e) {
            logger.error(`[Scheduler] AI stock overview generation failed: ${e.message}`);
        }
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
    await performUpdate();

    // Start recursive scheduling and background cron tasks
    scheduleNext();
    setupCronJobs();

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
    dataSource: dataFetcher.getDataSource(),
    aiGeneration: aiOverviewService.getGenerationStatus()
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
