const express = require('express');
const router = express.Router();
const marketOperations = require('../services/database/marketOperations');
const stockOperations = require('../services/database/stockOperations');
const scheduler = require('../services/scheduler/updateScheduler');
const dataFetcher = require('../services/dataFetcher');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAdminKey } = require('../middleware/auth');
const { adminLimiter } = require('../middleware/rateLimiter');
const logger = require('../services/utils/logger');
const { getTimeSyncStatus, getMarketState } = require('../services/utils/marketTime');
const metricsOrchestrator = require('../services/metrics/metricsOrchestrator');
const { getBoundedIntQuery } = require('../services/utils/queryValidation');
const {
    evaluateHealth,
    getServerUptimeSeconds,
    getLastSyncSecondsAgo,
    formatUptime
} = require('../services/health/healthService');
const { fetchMerolaganiLive } = require('../services/scrapers/merolaganiScraper');
const { getTrendingStocks } = require('../services/trendingService');

/**
 * Market API Routes
 * Endpoints for market data and server health
 */

/**
 * GET /api/market-summary
 * Get latest market summary with cumulative changes
 */
router.get('/market-summary', asyncHandler(async (req, res) => {
    const summary = await marketOperations.getLatestMarketSummary();

    if (!summary) {
        return res.status(404).json({
            success: false,
            error: { message: 'No market summary data available' }
        });
    }

    const cumulative = await marketOperations.getCumulativeMarketChanges(summary.indexValue);

    res.json({
        success: true,
        data: {
            ...summary,
            cumulative
        }
    });
}));

/**
 * GET /api/market-history
 * Get market summary history
 */
router.get('/market-history', asyncHandler(async (req, res) => {
    const hoursVal = getBoundedIntQuery(res, req.query.hours, { min: 1, max: 720, defaultValue: 24, label: 'hours' });
    if (hoursVal === null) return;

    const history = await marketOperations.getMarketSummaryHistory(hoursVal);

    res.json({
        success: true,
        data: history,
        count: history.length,
        hours: hoursVal
    });
}));

/**
 * GET /api/market-stats
 * Get market statistics
 */
router.get('/market-stats', asyncHandler(async (req, res) => {
    const stats = await marketOperations.getMarketStats();
    const stockCount = await stockOperations.getStockCount();
    const sectors = await stockOperations.getAllSectors();

    res.json({
        success: true,
        data: {
            ...stats,
            stockCount,
            sectorCount: sectors.length,
            sectors
        }
    });
}));

/**
 * GET /api/market-metrics
 * Get aggregate market-level metrics
 */
router.get('/market-metrics', asyncHandler(async (req, res) => {
    const metrics = await metricsOrchestrator.getMarketMetrics();

    if (!metrics) {
        return res.status(500).json({
            success: false,
            error: { message: 'Failed to compute market metrics' }
        });
    }

    res.json({ success: true, data: metrics });
}));

/**
 * GET /api/health
 * Server health check with update status
 */
router.get('/health', asyncHandler(async (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        market: {
            state: getMarketState()
        },
        timestamp: new Date().toISOString()
    });
}));

router.get('/health/live', asyncHandler(async (req, res) => {
    res.json({
        success: true,
        status: 'alive',
        uptime: getServerUptimeSeconds(),
        timestamp: new Date().toISOString()
    });
}));

router.get('/health/ready', asyncHandler(async (req, res) => {
    const health = await evaluateHealth();
    const ready = health.status === 'healthy';
    res.status(ready ? 200 : 503).json({
        success: ready,
        status: ready ? 'ready' : 'not_ready',
        problems: health.problems,
        warnings: health.warnings,
        data: {
            stockCount: health.stockCount,
            hasMarketData: health.marketStats.hasData,
            freshness: health.freshness
        },
        fetcher: {
            consecutiveFailures: health.fetchStatus.consecutiveFailures,
            hasError: Boolean(health.fetchStatus.lastError),
            lastFetchDurationMs: health.fetchStatus.lastFetchDurationMs,
            rateLimitEvents: health.fetchStatus.rateLimitEvents
        }
    });
}));

/**
 * GET /api/health/extended
 * Extended health metrics for monitoring system resilience
 */
router.get('/health/extended', adminLimiter, requireAdminKey, asyncHandler(async (req, res) => {
    const lastSyncSecondsAgo = await getLastSyncSecondsAgo();

    const memoryUsage = process.memoryUsage();
    const uptimeSeconds = getServerUptimeSeconds();
    const health = await evaluateHealth();
    const { updateStatus, fetchStatus, stockCount, marketStats } = health;

    res.json({
        success: true,
        status: health.status,
        lastSyncSecondsAgo,
        memoryUsage: {
            rss: `${Math.round(memoryUsage.rss / 1024 / 1024 * 100) / 100} MB`,
            heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100} MB`,
            heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100} MB`,
            external: `${Math.round(memoryUsage.external / 1024 / 1024 * 100) / 100} MB`
        },
        uptime: uptimeSeconds,
        uptimeFormatted: formatUptime(uptimeSeconds),
        environment: process.env.NODE_ENV || 'development',
        port: process.env.PORT || 5000,
        problems: health.problems,
        warnings: health.warnings,
        scheduler: {
            isRunning: updateStatus.isRunning,
            lastUpdate: updateStatus.lastUpdateTime,
            updateCount: updateStatus.updateCount,
            failureCount: updateStatus.failureCount,
            consecutiveFailures: fetchStatus.consecutiveFailures,
            lastError: updateStatus.lastError,
            lastScheduledIntervalMs: updateStatus.lastScheduledIntervalMs
        },
        market: {
            isOpen: updateStatus.isMarketOpen,
            currentNST: updateStatus.currentNST,
            hours: updateStatus.marketHours,
            state: health.marketState
        },
        data: {
            source: fetchStatus.dataSource,
            stockCount,
            hasMarketData: marketStats.hasData,
            freshness: health.freshness,
            isHealthy: fetchStatus.isHealthy && health.problems.length === 0
        },
        fetcher: {
            lastUpdateTime: fetchStatus.lastUpdateTime,
            lastFetchStartedAt: fetchStatus.lastFetchStartedAt,
            lastFetchDurationMs: fetchStatus.lastFetchDurationMs,
            lastSuccessfulDurationMs: fetchStatus.lastSuccessfulDurationMs,
            lastError: fetchStatus.lastError,
            rateLimitEvents: fetchStatus.rateLimitEvents,
            sourceStats: fetchStatus.sourceStats
        },
        resilience: {
            circuitBreaker: updateStatus.circuitBreaker,
            alerting: updateStatus.alerting
        },
        timestamp: new Date().toISOString()
    });
}));

/**
 * GET /api/scheduler-status
 * Get detailed scheduler status
 */
router.get('/scheduler-status', adminLimiter, requireAdminKey, asyncHandler(async (req, res) => {
    const status = scheduler.getUpdateStatus();

    res.json({
        success: true,
        data: status
    });
}));

/**
 * GET /api/time-sync-status
 * Get time synchronization status for monitoring
 */
router.get('/time-sync-status', adminLimiter, requireAdminKey, asyncHandler(async (req, res) => {
    const syncStatus = getTimeSyncStatus();
    const systemTime = new Date();

    res.json({
        success: true,
        data: {
            ...syncStatus,
            systemTime: systemTime.toISOString(),
            systemTimeLocal: systemTime.toLocaleString(),
            comparison: {
                nepseTime: syncStatus.nepseTime,
                systemTime: systemTime.toTimeString().split(' ')[0],
                offsetApplied: `${syncStatus.offsetSeconds}s`
            }
        }
    });
}));

/**
 * GET /api/trending
 * Get trending stocks based on user activity
 */
router.get('/trending', asyncHandler(async (req, res) => {
    const limitVal = getBoundedIntQuery(res, req.query.limit, { min: 1, max: 500, defaultValue: 6, label: 'limit' });
    if (limitVal === null) return;

    const validTrending = await getTrendingStocks(limitVal);

    res.json({
        success: true,
        data: validTrending,
        count: validTrending.length
    });
}));

/**
 * POST /api/force-update
 * Force an immediate data update
 * Protected by Admin Key
 */
router.post('/force-update', adminLimiter, requireAdminKey, asyncHandler(async (req, res) => {
    logger.info('Force update requested via API');

    const success = await scheduler.forceUpdate();

    res.json({
        success,
        message: success ? 'Update completed successfully' : 'Update failed',
        timestamp: new Date().toISOString()
    });
}));

/**
 * POST /api/sync-from-web
 * Sync market data directly from web scraping (custom scraper)
 * Protected by Admin Key
 */
router.post('/sync-from-web', adminLimiter, requireAdminKey, asyncHandler(async (req, res) => {
    logger.info('Web sync requested via API');

    const result = await dataFetcher.syncMarketDataFromWeb();

    res.json({
        success: result.updated,
        data: result,
        timestamp: new Date().toISOString()
    });
}));

/**
 * GET /api/scrape-live
 * Scrape and return live market data from official sources (without saving)
 */
router.get('/scrape-live', adminLimiter, requireAdminKey, asyncHandler(async (req, res) => {
    logger.info('Live scrape requested');

    const base = await fetchMerolaganiLive();

    res.json({
        success: base.totalTransactions !== null || base.nepseIndex !== null,
        data: base,
        timestamp: new Date().toISOString()
    });
}));

module.exports = router;
