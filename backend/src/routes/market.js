const express = require('express');
const router = express.Router();
const marketOperations = require('../services/database/marketOperations');
const stockOperations = require('../services/database/stockOperations');
const scheduler = require('../services/scheduler/updateScheduler');
const dataFetcher = require('../services/dataFetcher');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../services/utils/logger');
const { getTimeSyncStatus, getNepseTimeString } = require('../services/utils/marketTime');

/**
 * Market API Routes
 * Endpoints for market data and server health
 */

// Server start time for uptime calculation
const serverStartTime = Date.now();

/**
 * GET /api/market-summary
 * Get latest market summary
 */
router.get('/market-summary', asyncHandler(async (req, res) => {
    const summary = await marketOperations.getLatestMarketSummary();

    if (!summary) {
        return res.status(404).json({
            success: false,
            error: { message: 'No market summary data available' }
        });
    }

    res.json({
        success: true,
        data: summary
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
 * GET /api/health
 * Server health check with update status
 */
router.get('/health', asyncHandler(async (req, res) => {
    const updateStatus = scheduler.getUpdateStatus();
    const fetchStatus = dataFetcher.getFetchStatus();
    const uptimeSeconds = Math.floor((Date.now() - serverStartTime) / 1000);

    const marketStats = await marketOperations.getMarketStats();
    const stockCount = await stockOperations.getStockCount();

    res.json({
        success: true,
        status: 'running',
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
            lastError: updateStatus.lastError
        },
        market: {
            isOpen: updateStatus.isMarketOpen,
            currentNST: updateStatus.currentNST,
            hours: updateStatus.marketHours
        },
        data: {
            source: fetchStatus.dataSource,
            stockCount,
            hasMarketData: marketStats.hasData,
            isHealthy: fetchStatus.isHealthy
        }
    });
}));

/**
 * GET /api/health/extended
 * Extended health metrics for monitoring system resilience
 */
router.get('/health/extended', asyncHandler(async (req, res) => {
    const fs = require('fs');
    const path = require('path');
    const stocksPath = path.join(__dirname, '../../data/stocks.json');

    let lastSyncSecondsAgo = -1;
    try {
        const stats = fs.statSync(stocksPath);
        lastSyncSecondsAgo = Math.floor((Date.now() - stats.mtimeMs) / 1000);
    } catch (e) {
        logger.error(`Failed to get stocks.json stats: ${e.message}`);
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

/**
 * GET /api/trending
 * Get trending stocks based on user activity
 */
router.get('/trending', asyncHandler(async (req, res) => {
    const analytics = require('../services/analytics');
    const { limit = 6 } = req.query;

    // Get trending stocks from analytics
    const trending = analytics.getTrending(parseInt(limit));

    // Enrich with current stock data (price change, name)
    const enrichedTrending = await Promise.all(
        trending.map(async (item) => {
            const stock = await stockOperations.getStockBySymbol(item.symbol);

            if (!stock) {
                return null;
            }

            return {
                symbol: item.symbol,
                name: stock.companyName || stock.symbol,
                score: item.score,
                change: stock.prices?.changePercent || stock.changePercent || 0,
                ltp: stock.prices?.ltp || stock.ltp || 0
            };
        })
    );

    // Filter out null entries (stocks not found)
    const validTrending = enrichedTrending.filter(item => item !== null);

    res.json({
        success: true,
        data: validTrending,
        count: validTrending.length
    });
}));

/**
 * POST /api/force-update
 * Force an immediate data update
 */
router.post('/force-update', asyncHandler(async (req, res) => {
    logger.info('Force update requested via API');

    const success = await scheduler.forceUpdate();

    res.json({
        success,
        message: success ? 'Update completed successfully' : 'Update failed',
        timestamp: new Date().toISOString()
    });
}));

/**
 * Format uptime to human readable string
 */
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${secs}s`);

    return parts.join(' ');
}

module.exports = router;
