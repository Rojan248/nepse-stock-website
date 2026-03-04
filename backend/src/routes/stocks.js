const express = require('express');
const router = express.Router();
const stockOperations = require('../services/database/stockOperations');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAdminKey } = require('../middleware/auth');
const { searchLimiter, adminLimiter } = require('../middleware/rateLimiter');
const logger = require('../services/utils/logger');
const analytics = require('../services/analytics');
const metricsOrchestrator = require('../services/metrics/metricsOrchestrator');
const aiOverviewService = require('../services/aiOverviewService');

/**
 * Stock API Routes
 * Endpoints for accessing stock data
 */

/**
 * GET /api/stocks
 * Get all stocks with optional pagination
 */
router.get('/', asyncHandler(async (req, res) => {
    const { skip = 0, limit = 500, sortBy = 'symbol', sortOrder = 'asc', compact } = req.query;

    const stocks = await stockOperations.getAllStocks({
        skip: parseInt(skip),
        limit: parseInt(limit),
        sortBy,
        sortOrder: sortOrder === 'desc' ? -1 : 1,
        compact: compact === 'true'
    });

    const count = await stockOperations.getStockCount();

    res.json({
        success: true,
        data: stocks,
        count,
        pagination: {
            skip: parseInt(skip),
            limit: parseInt(limit),
            total: count
        }
    });
}));

/**
 * GET /api/stocks/search
 * Search stocks by symbol or company name
 */
router.get('/search', searchLimiter, asyncHandler(async (req, res) => {
    const { q } = req.query;

    if (!q || q.length < 1) {
        return res.status(400).json({
            success: false,
            error: { message: 'Search query is required' }
        });
    }

    if (q.length > 50) {
        return res.status(400).json({
            success: false,
            error: { message: 'Search query too long' }
        });
    }

    const stocks = await stockOperations.searchStocks(q);

    // Record search for analytics
    analytics.recordSearch(q);

    res.json({
        success: true,
        data: stocks,
        count: stocks.length,
        query: q
    });
}));

/**
 * GET /api/stocks/sectors
 * Get all available sectors
 */
router.get('/sectors', asyncHandler(async (req, res) => {
    const sectors = await stockOperations.getAllSectors();

    res.json({
        success: true,
        data: sectors,
        count: sectors.length
    });
}));

/**
 * GET /api/stocks/top-gainers
 * Get top gaining stocks
 */
router.get('/top-gainers', asyncHandler(async (req, res) => {
    const { limit = 10 } = req.query;

    const stocks = await stockOperations.getTopGainers(parseInt(limit));

    res.json({
        success: true,
        data: stocks,
        count: stocks.length
    });
}));

/**
 * GET /api/stocks/top-losers
 * Get top losing stocks
 */
router.get('/top-losers', asyncHandler(async (req, res) => {
    const { limit = 10 } = req.query;

    const stocks = await stockOperations.getTopLosers(parseInt(limit));

    res.json({
        success: true,
        data: stocks,
        count: stocks.length
    });
}));

/**
 * GET /api/stocks/top-traded
 * Get top traded stocks
 */
router.get('/top-traded', asyncHandler(async (req, res) => {
    const { limit = 10 } = req.query;

    const stocks = await stockOperations.getTopTraded(parseInt(limit));

    res.json({
        success: true,
        data: stocks,
        count: stocks.length
    });
}));

/**
 * GET /api/stocks/unchanged
 * Get stocks with no change
 */
router.get('/unchanged', asyncHandler(async (req, res) => {
    const { limit = 10 } = req.query;

    const stocks = await stockOperations.getUnchangedStocks(parseInt(limit));

    res.json({
        success: true,
        data: stocks,
        count: stocks.length
    });
}));

/**
 * GET /api/stocks/sector/:sector
 * Get stocks by sector
 */
router.get('/sector/:sector', asyncHandler(async (req, res) => {
    const { sector } = req.params;

    // Validate sector format
    if (!/^[a-zA-Z0-9\s-]+$/.test(sector)) {
        return res.status(400).json({
            success: false,
            error: { message: 'Invalid sector format' }
        });
    }

    const stocks = await stockOperations.getStocksBySector(sector);

    res.json({
        success: true,
        data: stocks,
        count: stocks.length,
        sector
    });
}));

/**
 * GET /api/stocks/recent
 * Get recently updated stocks
 */
router.get('/recent', asyncHandler(async (req, res) => {
    const { seconds = 30 } = req.query;

    const stocks = await stockOperations.getRecentlyUpdated(parseInt(seconds));

    res.json({
        success: true,
        data: stocks,
        count: stocks.length,
        window: `${seconds} seconds`
    });
}));

/**
 * GET /api/stocks/:symbol/metrics
 * Get computed metrics for a stock
 */
router.get('/:symbol/metrics', asyncHandler(async (req, res) => {
    const { symbol } = req.params;

    if (!/^[a-zA-Z0-9]+$/.test(symbol) || symbol.length > 20) {
        return res.status(400).json({
            success: false,
            error: { message: 'Invalid symbol format' }
        });
    }

    const metrics = await metricsOrchestrator.getMetrics(symbol);

    if (!metrics) {
        return res.status(404).json({
            success: false,
            error: { message: `No metrics available for '${symbol}'` }
        });
    }

    res.json({ success: true, data: metrics });
}));

/**
 * GET /api/stocks/:symbol/overview
 * Get AI-generated overview for a stock
 */
router.get('/:symbol/overview', asyncHandler(async (req, res) => {
    const { symbol } = req.params;

    if (!/^[a-zA-Z0-9]+$/.test(symbol) || symbol.length > 20) {
        return res.status(400).json({
            success: false,
            error: { message: 'Invalid symbol format' }
        });
    }

    const overview = await aiOverviewService.getOverview(symbol, 'stock');

    if (!overview) {
        return res.status(404).json({
            success: false,
            error: { message: `No AI overview available for '${symbol}'` }
        });
    }

    res.json({ success: true, data: overview });
}));

/**
 * POST /api/stocks/:symbol/overview/refresh
 * Manually trigger AI overview regeneration for a stock
 * Protected by Admin Key
 */
router.post('/:symbol/overview/refresh', adminLimiter, requireAdminKey, asyncHandler(async (req, res) => {
    const { symbol } = req.params;

    if (!/^[a-zA-Z0-9]+$/.test(symbol) || symbol.length > 20) {
        return res.status(400).json({
            success: false,
            error: { message: 'Invalid symbol format' }
        });
    }

    // Compute fresh metrics first
    await metricsOrchestrator.computeForSymbol(symbol);

    // Generate fresh AI overview
    const overview = await aiOverviewService.generateForSymbol(symbol, 'manual');

    if (!overview) {
        return res.status(500).json({
            success: false,
            error: { message: `Failed to generate AI overview for '${symbol}'` }
        });
    }

    res.json({
        success: true,
        message: `AI overview refreshed for ${symbol}`,
        data: overview
    });
}));

/**
 * GET /api/stocks/:symbol
 * Get specific stock by symbol
 */
router.get('/:symbol', asyncHandler(async (req, res) => {
    const { symbol } = req.params;

    // Validate symbol format (alphanumeric only, max 20 chars)
    if (!/^[a-zA-Z0-9]+$/.test(symbol) || symbol.length > 20) {
        return res.status(400).json({
            success: false,
            error: { message: 'Invalid symbol format' }
        });
    }

    const stock = await stockOperations.getStockBySymbol(symbol);

    if (!stock) {
        return res.status(404).json({
            success: false,
            error: { message: `Stock with symbol '${symbol}' not found` }
        });
    }

    // Record view for analytics
    analytics.recordView(symbol);

    res.json({
        success: true,
        data: stock
    });
}));

/**
 * GET /api/stocks/:symbol/depth
 * Get market depth (Level 2 data) and floorsheet for a stock
 */
router.get('/:symbol/depth', asyncHandler(async (req, res) => {
    const { symbol } = req.params;
    const depthFetcher = require('../services/depthFetcher');

    try {
        const depthData = await depthFetcher.getDepth(symbol);

        res.json({
            success: true,
            symbol: symbol.toUpperCase(),
            data: depthData
        });
    } catch (error) {
        logger.error(`Failed to fetch depth for ${symbol}: ${error.message}`);
        res.status(500).json({
            success: false,
            error: { message: 'Failed to fetch market depth' }
        });
    }
}));

/**
 * POST /api/stocks/admin/cleanup
 * Delete inactive stocks (zero LTP) from database
 * Protected by Admin Key
 */
router.post('/admin/cleanup', adminLimiter, requireAdminKey, async (req, res) => {
    try {
        logger.info('Running cleanup to delete inactive stocks...');

        const { removed, remaining } = await stockOperations.cleanupInactiveStocks();

        return res.status(200).json({
            success: true,
            message: 'Inactive stocks cleanup completed',
            removed,
            remaining
        });
    } catch (err) {
        logger.error(`Cleanup failed: ${err.message}`);
        return res.status(500).json({
            success: false,
            message: 'Cleanup failed',
            error: err.message
        });
    }
});

/**
 * POST /api/stocks/admin/cleanup-bonds
 * Remove non-equity securities (Bonds, Mutual Funds, Debentures, Promoter Shares)
 * Protected by Admin Key
 */
router.post('/admin/cleanup-bonds', adminLimiter, requireAdminKey, async (req, res) => {
    try {
        logger.info('Running cleanup to remove non-equity securities (Bonds, MFs, Debentures)...');

        const { removed, remaining, removedSymbols } = await stockOperations.deleteNonEquitySecurities();

        return res.status(200).json({
            success: true,
            message: 'Non-equity securities cleanup completed',
            removed,
            remaining,
            removedSymbols: removedSymbols.slice(0, 50)  // Limit to 50 for response size
        });
    } catch (err) {
        logger.error(`Cleanup failed: ${err.message}`);
        return res.status(500).json({
            success: false,
            message: 'Cleanup failed',
            error: err.message
        });
    }
});

/**
 * POST /api/stocks/admin/validate
 * Remove stocks not in the official NEPSE list
 * Protected by Admin Key
 */
router.post('/admin/validate', adminLimiter, requireAdminKey, async (req, res) => {
    try {
        logger.info('Validating stocks against official NEPSE data...');

        // Fetch valid symbols from NEPSE API
        const { nepseClient, nepseAxios, createHeaders, BASE_URL } = require('nepse-api-helper');

        await nepseClient.initialize();
        const token = await nepseClient.getToken();

        const response = await nepseAxios.get(BASE_URL + '/api/nots/securityDailyTradeStat/58', {
            headers: createHeaders(token)
        });

        const validSymbols = new Set(response.data.map(s => s.symbol));
        logger.info(`Found ${validSymbols.size} valid stocks from NEPSE`);

        // Clean up invalid stocks
        const result = await stockOperations.cleanupInvalidStocks(validSymbols);

        return res.status(200).json({
            success: true,
            message: 'Stock validation completed',
            validNepseStocks: validSymbols.size,
            removed: result.removed,
            remaining: result.remaining,
            removedSymbols: result.removedSymbols
        });
    } catch (err) {
        logger.error(`Validation failed: ${err.message}`);
        return res.status(500).json({
            success: false,
            message: 'Validation failed',
            error: err.message
        });
    }
});

module.exports = router;
