const schedule = require('node-schedule');
const logger = require('../utils/logger');
const dataFetcher = require('../dataFetcher');
const stockOperations = require('../database/stockOperations');
const ipoOperations = require('../database/ipoOperations');
const marketOperations = require('../database/marketOperations');
const { getNepseNow, getNepseNowSync, getMarketState, isMarketActive, initTimeSync, MARKET_STATES } = require('../utils/marketTime');
const watchdogService = require('../watchdog/WatchdogService');
const alertChecker = require('../alertChecker');
const { prisma } = require('../database/connection');
const dataEnricher = require('../dataEnricher');
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
let previousMarketState = null;
let aiTriggeredToday = false; // prevents double-trigger within same trading day

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

    if ((currentState === MARKET_STATES.WEEKEND || currentState === MARKET_STATES.HOLIDAY) && !isDev) {
        logger.info(`Skipping update: Market is closed (${currentState})`);
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
 * Detect market close transition and trigger AI overview generation.
 * Called every update cycle. When market transitions from OPEN to POST_CLOSE,
 * waits a short delay for final data to settle, then starts AI generation.
 */
const checkMarketCloseTransition = () => {
    const newState = getMarketState();

    // Reset the daily trigger flag when market opens (new trading day)
    if (newState === MARKET_STATES.OPEN) {
        aiTriggeredToday = false;
    }

    // Detect OPEN → POST_CLOSE transition
    if (previousMarketState === MARKET_STATES.OPEN && newState === MARKET_STATES.POST_CLOSE && !aiTriggeredToday) {
        aiTriggeredToday = true;
        logger.info('[Scheduler] Market just closed — triggering AI overview generation in 60s');

        setTimeout(async () => {
            try {
                logger.info('[Scheduler] Generating market overview after market close...');
                await aiOverviewService.generateMarketOverview('market-close');

                logger.info('[Scheduler] Starting stock overview generation (chunked, rate-limited)...');
                const stats = await aiOverviewService.generateAll('market-close');
                logger.info(`[Scheduler] AI generation done: ${stats.generated} generated, ${stats.failed} failed, ${stats.skipped} fresh${stats.quotaExhausted ? ' (quota exhausted)' : ''}`);
            } catch (e) {
                logger.error(`[Scheduler] Post-close AI generation failed: ${e.message}`);
            }
        }, 60000); // 60s delay for final data update to finish
    }

    previousMarketState = newState;
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
};

/**
 * Check if AI overviews were missed today and need catch-up generation.
 * Runs on scheduler start — if it's a trading day past 15:30 and overviews are stale,
 * triggers generation so restarts after the cron window don't skip a day.
 */
const checkAICatchUp = async () => {
    try {
        const config = { apiKey: process.env.GEMINI_API_KEY };
        if (!config.apiKey) return;

        const nst = getNSTTime();
        const hour = nst.getHours();
        const day = nst.getDay(); // 0=Sun

        // Only catch up on trading days (Sun-Thu, non-holiday) after 15:00 NST
        if (day === 5 || day === 6) return; // Fri/Sat weekend
        if (hour < 15) return; // Market hasn't closed yet, transition trigger will handle it

        // Skip public holidays
        const currentState = getMarketState();
        if (currentState === MARKET_STATES.HOLIDAY) return;

        // Check if market overview is stale (older than 20 hours)
        const staleThreshold = new Date(Date.now() - 20 * 60 * 60 * 1000);
        const marketOverview = await prisma.aIOverview.findFirst({
            where: { symbol: 'MARKET', type: 'market' },
            select: { updatedAt: true }
        });

        const needsCatchUp = !marketOverview || marketOverview.updatedAt < staleThreshold;

        if (needsCatchUp) {
            aiTriggeredToday = true; // prevent transition trigger from double-firing
            logger.info('[Scheduler] AI overviews are stale and cron window was missed — starting catch-up generation');
            // Delay 60s to let initial data update finish first
            setTimeout(async () => {
                try {
                    await aiOverviewService.generateMarketOverview('scheduler-catchup');
                    const stats = await aiOverviewService.generateAll('scheduler-catchup');
                    logger.info(`[Scheduler] AI catch-up done: ${stats.generated} generated, ${stats.failed} failed`);
                } catch (e) {
                    logger.error(`[Scheduler] AI catch-up failed: ${e.message}`);
                }
            }, 60000);
        }
    } catch (err) {
        logger.error(`[Scheduler] AI catch-up check failed: ${err.message}`);
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
    previousMarketState = getMarketState(); // snapshot to avoid false transition on first cycle
    logger.info('Starting NEPSE update scheduler...');

    // Initial update
    await performUpdate();

    // Start recursive scheduling and background cron tasks
    scheduleNext();
    setupCronJobs();

    // Check if AI overviews need catch-up (missed cron window)
    await checkAICatchUp();

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
