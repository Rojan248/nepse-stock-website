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
const aiOverviewService = require('../services/aiOverviewService');
const stockPicks = require('../services/stockPicks');

/**
 * Market API Routes
 * Endpoints for market data and server health
 */

// Server start time for uptime calculation
const serverStartTime = Date.now();

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
    const { hours = 24 } = req.query;

    const history = await marketOperations.getMarketSummaryHistory(parseInt(hours));

    res.json({
        success: true,
        data: history,
        count: history.length,
        hours: parseInt(hours)
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
 * GET /api/market-overview
 * Get AI-generated market overview narrative
 */
router.get('/market-overview', asyncHandler(async (req, res) => {
    const overview = await aiOverviewService.getOverview('MARKET', 'market');

    if (!overview) {
        return res.status(404).json({
            success: false,
            error: { message: 'No market overview available yet' }
        });
    }

    res.json({ success: true, data: overview });
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
 * GET /api/stock-picks
 * Get AI-scored stock recommendations based on technical metrics
 */
router.get('/stock-picks', asyncHandler(async (req, res) => {
    const { limit = 10 } = req.query;
    const picks = await stockPicks.getTopPicks(parseInt(limit));

    res.json({
        success: true,
        data: picks,
        count: picks.length,
        timestamp: new Date().toISOString()
    });
}));

/**
 * GET /api/health
 * Server health check with update status
 */
router.get('/health', asyncHandler(async (req, res) => {
    const updateStatus = scheduler.getUpdateStatus();
    const fetchStatus = dataFetcher.getFetchStatus();
    const uptimeSeconds = Math.floor((Date.now() - serverStartTime) / 1000);

    const marketStats = await marketOperations.getMarketStats();
    const stockCount = await stockOperations.getStockCount();

    // Determine overall health status
    // NOTE: consecutiveFailures is tracked in dataFetcher (fetchStatus), not scheduler (updateStatus)
    const isHealthy = fetchStatus.consecutiveFailures < 3 &&
        stockCount > 100 &&
        !(updateStatus.circuitBreaker?.isOpen);

    res.json({
        success: true,
        status: isHealthy ? 'healthy' : 'degraded',
        server: {
            uptime: uptimeSeconds,
            uptimeFormatted: formatUptime(uptimeSeconds),
            environment: process.env.NODE_ENV || 'development',
            port: process.env.PORT || 5000
        },
        scheduler: {
            isRunning: updateStatus.isRunning,
            lastUpdate: updateStatus.lastUpdateTime,
            updateCount: updateStatus.updateCount,
            failureCount: updateStatus.failureCount,
            consecutiveFailures: fetchStatus.consecutiveFailures,
            lastError: updateStatus.lastError
        },
        market: {
            isOpen: updateStatus.isMarketOpen,
            currentNST: updateStatus.currentNST,
            hours: updateStatus.marketHours,
            state: getMarketState()
        },
        data: {
            source: fetchStatus.dataSource,
            stockCount,
            hasMarketData: marketStats.hasData,
            isHealthy: fetchStatus.isHealthy
        },
        resilience: {
            circuitBreaker: updateStatus.circuitBreaker,
            alerting: updateStatus.alerting
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

    const status = (lastSyncSecondsAgo > 120 || lastSyncSecondsAgo === -1) ? 'warning' : 'ok';

    res.json({
        success: true,
        status,
        lastSyncSecondsAgo,
        memoryUsage: {
            rss: `${Math.round(memoryUsage.rss / 1024 / 1024 * 100) / 100} MB`,
            heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024 * 100) / 100} MB`,
            heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100} MB`,
            external: `${Math.round(memoryUsage.external / 1024 / 1024 * 100) / 100} MB`
        },
        uptime: uptimeSeconds,
        timestamp: new Date().toISOString()
    });
}));

/**
 * GET /api/scheduler-status
 * Get detailed scheduler status
 */
router.get('/scheduler-status', asyncHandler(async (req, res) => {
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
router.get('/time-sync-status', asyncHandler(async (req, res) => {
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
    const { limit = 6 } = req.query;

    // Get trending stocks from analytics
    const trending = analytics.getTrending(parseInt(limit));

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
 * POST /api/force-ai-generate
 * Force AI overview regeneration for stale/all overviews
 * Protected by Admin Key
 * Query: ?all=true to regenerate everything (ignores freshness)
 */
router.post('/force-ai-generate', adminLimiter, requireAdminKey, asyncHandler(async (req, res) => {
    logger.info('Force AI generation requested via API');

    // Generate market overview first
    const marketResult = await aiOverviewService.generateMarketOverview('manual');

    // Generate stock overviews (uses built-in staleness check)
    const stats = await aiOverviewService.generateAll('manual');

    res.json({
        success: true,
        data: {
            marketOverview: marketResult ? 'generated' : 'skipped/failed',
            stocks: stats
        },
        timestamp: new Date().toISOString()
    });
}));

/**
 * GET /api/ai-status
 * Get AI generation status
 */
router.get('/ai-status', asyncHandler(async (req, res) => {
    const status = aiOverviewService.getGenerationStatus();
    res.json({ success: true, data: status });
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
        const resp = await axios.get(MEROLAGANI_URL, { timeout: 15000, headers: MEROLAGANI_HEADERS });
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
