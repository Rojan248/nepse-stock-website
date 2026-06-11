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
const { getTimeSyncStatus, getNepseTimeString, getMarketState } = require('../services/utils/marketTime');
const { prisma } = require('../services/database/connection');
const metricsOrchestrator = require('../services/metrics/metricsOrchestrator');
const { getBoundedIntQuery } = require('../services/utils/queryValidation');

/**
 * Market API Routes
 * Endpoints for market data and server health
 */

// Server start time for uptime calculation
const serverStartTime = Date.now();

const FRESHNESS_LIMITS_SECONDS = {
    OPEN: 120,
    PRE_OPEN: 15 * 60,
    CLOSED: 6 * 60 * 60,
    POST_CLOSE: 6 * 60 * 60,
    WEEKEND: 24 * 60 * 60,
    HOLIDAY: 24 * 60 * 60
};

const FETCH_FAILURE_PROBLEM_THRESHOLD = 3;
const isSchedulerExpected = () => process.env.DISABLE_BACKGROUND_JOBS !== 'true';

const secondsSince = (date) => {
    if (!date) return null;
    const parsed = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(parsed.getTime())) return null;
    return Math.floor((Date.now() - parsed.getTime()) / 1000);
};

const getLatestStockSync = async () => {
    const latestStock = await prisma.stock.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true }
    });
    return latestStock?.updatedAt || null;
};

const collectHealthContext = async () => {
    const updateStatus = scheduler.getUpdateStatus();
    const fetchStatus = dataFetcher.getFetchStatus();
    const uptimeSeconds = Math.floor((Date.now() - serverStartTime) / 1000);
    const marketState = getMarketState();

    const [marketStats, stockCount, latestStockSync] = await Promise.all([
        marketOperations.getMarketStats(),
        stockOperations.getStockCount(),
        getLatestStockSync()
    ]);

    const lastSyncSecondsAgo = secondsSince(latestStockSync);
    const freshnessLimitSeconds = FRESHNESS_LIMITS_SECONDS[marketState] || FRESHNESS_LIMITS_SECONDS.CLOSED;
    const isFresh = lastSyncSecondsAgo !== null && lastSyncSecondsAgo <= freshnessLimitSeconds;

    return {
        updateStatus,
        fetchStatus,
        uptimeSeconds,
        marketState,
        isSchedulerExpected: isSchedulerExpected(),
        marketStats,
        stockCount,
        latestStockSync,
        lastSyncSecondsAgo,
        freshnessLimitSeconds,
        isFresh
    };
};

const hasFetchFailureProblem = (fetchStatus, isFresh) =>
    fetchStatus.consecutiveFailures >= FETCH_FAILURE_PROBLEM_THRESHOLD && !isFresh;

const hasRecentFetchWarning = (fetchStatus, isFresh) =>
    fetchStatus.consecutiveFailures > 0
    && (fetchStatus.consecutiveFailures < FETCH_FAILURE_PROBLEM_THRESHOLD || isFresh);

const HEALTH_PROBLEM_RULES = [
    { applies: ({ updateStatus, isSchedulerExpected }) => isSchedulerExpected && !updateStatus.isRunning, message: () => 'scheduler is not running' },
    { applies: ({ stockCount }) => stockCount <= 100, message: ({ stockCount }) => `stock count too low (${stockCount})` },
    { applies: ({ marketStats }) => !marketStats.hasData, message: () => 'market summary data is missing' },
    { applies: ({ updateStatus }) => updateStatus.circuitBreaker?.isOpen, message: () => 'circuit breaker is open' },
    {
        applies: ({ fetchStatus, isFresh }) => hasFetchFailureProblem(fetchStatus, isFresh),
        message: ({ fetchStatus }) => `${fetchStatus.consecutiveFailures} consecutive fetch failures`
    },
    {
        applies: ({ updateStatus, isFresh }) => updateStatus.isMarketOpen && !isFresh,
        message: ({ lastSyncSecondsAgo }) => `market data stale during open market (${lastSyncSecondsAgo ?? 'unknown'}s old)`
    },
];

const buildHealthProblems = (context) => HEALTH_PROBLEM_RULES
    .filter(rule => rule.applies(context))
    .map(rule => rule.message(context));

const buildHealthWarnings = ({ updateStatus, fetchStatus, marketState, isFresh, lastSyncSecondsAgo, isSchedulerExpected }) => {
    const warnings = [];

    if (!isSchedulerExpected && !updateStatus.isRunning) {
        warnings.push('background jobs are disabled by configuration');
    }
    if (hasRecentFetchWarning(fetchStatus, isFresh)) {
        warnings.push(`${fetchStatus.consecutiveFailures} recent fetch failure`);
    }
    if (!updateStatus.isMarketOpen && !isFresh) {
        warnings.push(`stored market data is older than preferred for ${marketState} (${lastSyncSecondsAgo ?? 'unknown'}s)`);
    }
    if (fetchStatus.rateLimitEvents > 0) {
        warnings.push(`${fetchStatus.rateLimitEvents} rate-limit-like event(s) observed`);
    }

    return warnings;
};

const buildFreshnessStatus = ({ latestStockSync, lastSyncSecondsAgo, freshnessLimitSeconds, isFresh }) => ({
    lastStockSync: latestStockSync ? latestStockSync.toISOString() : null,
    lastSyncSecondsAgo,
    freshnessLimitSeconds,
    isFresh
});

const evaluateHealth = async () => {
    const context = await collectHealthContext();
    const problems = buildHealthProblems(context);
    const warnings = buildHealthWarnings(context);
    const status = problems.length > 0 ? 'degraded' : 'healthy';

    return {
        status,
        problems,
        warnings,
        updateStatus: context.updateStatus,
        fetchStatus: context.fetchStatus,
        uptimeSeconds: context.uptimeSeconds,
        marketState: context.marketState,
        marketStats: context.marketStats,
        stockCount: context.stockCount,
        freshness: buildFreshnessStatus(context)
    };
};

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
    const uptimeSeconds = Math.floor((Date.now() - serverStartTime) / 1000);
    res.json({
        success: true,
        status: 'alive',
        uptime: uptimeSeconds,
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
    let lastSyncSecondsAgo = -1;
    try {
        const latestStock = await prisma.stock.findFirst({ orderBy: { updatedAt: 'desc' } });
        if (latestStock?.updatedAt) {
            lastSyncSecondsAgo = Math.floor((Date.now() - latestStock.updatedAt.getTime()) / 1000);
        }
    } catch (e) {
        logger.error(`Failed to get latest stock timestamp: ${e.message}`);
    }

    const memoryUsage = process.memoryUsage();
    const uptimeSeconds = Math.floor((Date.now() - serverStartTime) / 1000);
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

/** Enrich a single trending item with current stock data */
function enrichTrendingItem(item, stock) {
    const prices = stock.prices || {};
    return {
        symbol: item.symbol,
        name: stock.companyName || stock.symbol,
        score: item.score,
        change: prices.changePercent ?? stock.changePercent ?? 0,
        ltp: prices.ltp ?? stock.ltp ?? 0
    };
}

/**
 * GET /api/trending
 * Get trending stocks based on user activity
 */
router.get('/trending', asyncHandler(async (req, res) => {
    const analytics = require('../services/analytics');
    const limitVal = getBoundedIntQuery(res, req.query.limit, { min: 1, max: 500, defaultValue: 6, label: 'limit' });
    if (limitVal === null) return;

    // Get trending stocks from analytics
    const trending = analytics.getTrending(limitVal);

    // Extract symbols
    const symbols = trending.map(t => t.symbol);

    // Batch fetch stock data
    const stocks = await stockOperations.getStocksBySymbols(symbols);

    // Create a map for O(1) lookup
    const stockMap = new Map(stocks.map(s => [s.symbol, s]));

    // Enrich with current stock data, skipping unknown symbols
    const validTrending = trending.flatMap((item) => {
        const stock = stockMap.get(item.symbol.toUpperCase());
        if (!stock) return [];
        return enrichTrendingItem(item, stock);
    });

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

// ==================== Scrape Helpers ====================

/** Remove commas from a numeric string */
const stripCommas = (s) => s.replace(/,/g, '');

/** Parse an integer from a comma-separated string */
const parseIntClean = (s) => parseInt(stripCommas(s), 10);

/** Parse a float from a comma-separated string */
const parseFloatClean = (s) => parseFloat(stripCommas(s));

/**
 * Data-driven scraping patterns.
 * Each entry: { field, patterns (tried in order), parser }
 * First matching pattern wins for each field.
 */
const SCRAPE_PATTERNS = [
    {
        field: 'totalTransactions',
        patterns: [
            /Total Transactions<\/th>\s*<td[^>]*>([0-9,]+)/i,
            /Total Transactions<\/[^>]+>\s*<[^>]+>([0-9,]+)/i,
            /Total Transactions[\s\S]{0,50}?([0-9,]{3,})/i,
        ],
        parser: parseIntClean,
    },
    {
        field: 'totalTurnover',
        patterns: [/Total Turnover[\s\S]{0,50}?([0-9,.]{5,})/i],
        parser: parseFloatClean,
    },
    {
        field: 'totalVolume',
        patterns: [/Total Traded Shares[\s\S]{0,50}?([0-9,]{3,})/i],
        parser: parseIntClean,
    },
    {
        field: 'nepseIndex',
        patterns: [
            /NEPSE<\/[^>]+>\s*<[^>]+>([0-9,.]+)/i,
            />NEPSE[\s\S]{0,30}?([0-9,]{1,3}(?:,[0-9]{3})*\.?[0-9]*)/i,
        ],
        parser: parseFloatClean,
    },
];

/** Apply the first matching regex pattern from a list, returning the parsed value or null */
function applyFirstMatch(html, patterns, parser) {
    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) return parser(match[1]);
    }
    return null;
}

/** Extract an HTML sample around the 'Transactions' keyword for debugging */
function extractHtmlSample(html) {
    const txIdx = html.indexOf('Transactions');
    if (txIdx <= 0) return null;
    return html.substring(Math.max(0, txIdx - 50), txIdx + 150);
}

/**
 * Parse market data from Merolagani HTML using data-driven regex patterns.
 * @param {string} html - Raw HTML string
 * @returns {Object} Parsed fields (values are null if not found)
 */
function scrapeFromMerolagani(html) {
    const result = {};
    for (const { field, patterns, parser } of SCRAPE_PATTERNS) {
        result[field] = applyFirstMatch(html, patterns, parser);
    }
    result.htmlSample = extractHtmlSample(html);
    return result;
}

const MEROLAGANI_URL = 'https://merolagani.com/MarketSummary.aspx';
const MEROLAGANI_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Cache-Control': 'no-cache'
};

/**
 * GET /api/scrape-live
 * Scrape and return live market data from official sources (without saving)
 */
router.get('/scrape-live', adminLimiter, requireAdminKey, asyncHandler(async (req, res) => {
    logger.info('Live scrape requested');
    const axios = require('axios');

    const base = {
        nepseIndex: null, totalTransactions: null, totalTurnover: null, totalVolume: null,
        advanced: null, declined: null, unchanged: null, source: null, error: null, htmlSample: null
    };

    try {
        const resp = await axios.get(MEROLAGANI_URL, {
            timeout: 15000,
            maxRedirects: 0,
            headers: MEROLAGANI_HEADERS
        });
        const html = resp.data || '';
        logger.info(`Merolagani HTML fetched: ${html.length} bytes`);

        const parsed = scrapeFromMerolagani(html);
        Object.assign(base, parsed, { source: 'merolagani' });
    } catch (err) {
        base.error = err.message;
        logger.error(`Scrape failed: ${err.message}`);
    }

    res.json({
        success: base.totalTransactions !== null || base.nepseIndex !== null,
        data: base,
        timestamp: new Date().toISOString()
    });
}));

/** Time units for uptime formatting (largest first) */
const TIME_UNITS = [
    { divisor: 86400, suffix: 'd' },
    { divisor: 3600, suffix: 'h' },
    { divisor: 60, suffix: 'm' },
    { divisor: 1, suffix: 's' }
];

/** Format uptime seconds to human-readable string (e.g. "2d 5h 30m 12s") */
function formatUptime(seconds) {
    return TIME_UNITS.reduce((parts, { divisor, suffix }) => {
        const value = Math.floor(seconds / divisor);
        seconds %= divisor;
        if (value > 0 || suffix === 's') parts.push(`${value}${suffix}`);
        return parts;
    }, []).join(' ');
}

module.exports = router;
