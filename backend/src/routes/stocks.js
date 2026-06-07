const express = require('express');
const router = express.Router();
const { performance } = require('perf_hooks');
const stockOperations = require('../services/database/stockOperations');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAdminKey } = require('../middleware/auth');
const { searchLimiter, adminLimiter } = require('../middleware/rateLimiter');
const logger = require('../services/utils/logger');
const analytics = require('../services/analytics');
const metricsOrchestrator = require('../services/metrics/metricsOrchestrator');
const { prisma } = require('../services/database/connection');
const {
    getBoundedIntQuery,
    normalizeSymbolParam,
    normalizeTextQuery,
    sendQueryValidationError
} = require('../services/utils/queryValidation');

/**
 * Stock API Routes
 * Endpoints for accessing stock data
 */

const normalizeSectorParam = (value) => {
    if (typeof value !== 'string') {
        return { error: 'Invalid sector format' };
    }
    const sector = value.trim();
    if (sector.length > 80) {
        return { error: 'Sector must be 80 characters or less' };
    }
    if (!/^[a-zA-Z0-9\s-]+$/.test(sector)) {
        return { error: 'Invalid sector format' };
    }
    return { value: sector };
};

/**
 * GET /api/stocks
 * Get all stocks with optional pagination
 */
router.get('/', asyncHandler(async (req, res) => {
    const skipVal = getBoundedIntQuery(res, req.query.skip, { min: 0, max: 10000, defaultValue: 0, label: 'skip' });
    if (skipVal === null) return;
    const limitVal = getBoundedIntQuery(res, req.query.limit, { min: 1, max: 500, defaultValue: 500, label: 'limit' });
    if (limitVal === null) return;
    const { sortBy = 'symbol', sortOrder = 'asc', compact, activeOnly = 'true' } = req.query;

    const stocks = await stockOperations.getAllStocks({
        skip: skipVal,
        limit: limitVal,
        sortBy,
        sortOrder: sortOrder === 'desc' ? -1 : 1,
        compact: compact === 'true',
        includeZeroLtp: activeOnly !== 'true'
    });

    const count = await stockOperations.getStockCount(activeOnly !== 'true');

    res.json({
        success: true,
        data: stocks,
        count,
        pagination: {
            skip: skipVal,
            limit: limitVal,
            total: count
        }
    });
}));


/**
 * GET /api/stocks/search
 * Search stocks by symbol or company name
 */
router.get('/search', searchLimiter, asyncHandler(async (req, res) => {
    const queryResult = normalizeTextQuery(req.query.q, { maxLength: 50 });
    if (queryResult.error) {
        return res.status(400).json({
            success: false,
            error: { message: queryResult.error }
        });
    }

    const stocks = await stockOperations.searchStocks(queryResult.value);

    // Record search for analytics
    analytics.recordSearch(queryResult.value);

    res.json({
        success: true,
        data: stocks,
        count: stocks.length,
        query: queryResult.value
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
    const limit = getBoundedIntQuery(res, req.query.limit, { min: 1, max: 100, defaultValue: 10, label: 'limit' });
    if (limit === null) return;
    const stocks = await stockOperations.getTopGainers(limit);

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
    const limit = getBoundedIntQuery(res, req.query.limit, { min: 1, max: 100, defaultValue: 10, label: 'limit' });
    if (limit === null) return;
    const stocks = await stockOperations.getTopLosers(limit);

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
    const limit = getBoundedIntQuery(res, req.query.limit, { min: 1, max: 100, defaultValue: 10, label: 'limit' });
    if (limit === null) return;
    const stocks = await stockOperations.getTopTraded(limit);

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
    const limit = getBoundedIntQuery(res, req.query.limit, { min: 1, max: 100, defaultValue: 10, label: 'limit' });
    if (limit === null) return;
    const stocks = await stockOperations.getUnchangedStocks(limit);

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
    const sectorResult = normalizeSectorParam(req.params.sector);
    if (sectorResult.error) {
        return sendQueryValidationError(res, sectorResult.error);
    }

    const stocks = await stockOperations.getStocksBySector(sectorResult.value);

    res.json({
        success: true,
        data: stocks,
        count: stocks.length,
        sector: sectorResult.value
    });
}));

/**
 * GET /api/stocks/recent
 * Get recently updated stocks
 */
router.get('/recent', asyncHandler(async (req, res) => {
    const seconds = getBoundedIntQuery(res, req.query.seconds, { min: 1, max: 24 * 60 * 60, defaultValue: 30, label: 'seconds' });
    if (seconds === null) return;

    const stocks = await stockOperations.getRecentlyUpdated(seconds);

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
    const symbolResult = normalizeSymbolParam(req.params.symbol);
    if (symbolResult.error) {
        return res.status(400).json({
            success: false,
            error: { message: symbolResult.error }
        });
    }

    const metrics = await metricsOrchestrator.getMetrics(symbolResult.value);

    if (!metrics) {
        return res.status(404).json({
            success: false,
            error: { message: `No metrics available for '${symbolResult.value}'` }
        });
    }

    res.json({ success: true, data: metrics });
}));

/**
 * GET /api/stocks/:symbol
 * Get specific stock by symbol
 */
router.get('/:symbol', asyncHandler(async (req, res) => {
    const symbolResult = normalizeSymbolParam(req.params.symbol);
    if (symbolResult.error) {
        return res.status(400).json({
            success: false,
            error: { message: symbolResult.error }
        });
    }

    const stock = await stockOperations.getStockBySymbol(symbolResult.value);

    if (!stock) {
        return res.status(404).json({
            success: false,
            error: { message: 'Stock not found' }
        });
    }

    // Record view for analytics
    analytics.recordView(symbolResult.value);

    res.json({
        success: true,
        data: stock
    });
}));

/**
 * GET /api/stocks/:symbol/history
 * Get historical price data with technical indicators
 */
router.get('/:symbol/history', asyncHandler(async (req, res) => {
    const symbolResult = normalizeSymbolParam(req.params.symbol);
    if (symbolResult.error) {
        return res.status(400).json({
            success: false,
            error: { message: symbolResult.error }
        });
    }

    const startTime = performance.now();

    const daysVal = getBoundedIntQuery(res, req.query.days, { min: 1, max: 365, defaultValue: 180, label: 'days' });
    if (daysVal === null) return;
    const historyDesc = await prisma.marketHistory.findMany({
        where: { symbol: symbolResult.value },
        orderBy: { date: 'desc' },
        take: daysVal
    });
    const history = historyDesc.reverse();

    if (history.length === 0) {
        return res.json({ success: true, symbol: symbolResult.value, data: [] });
    }

    const metrics = await prisma.stockMetrics.findMany({
        where: { symbol: symbolResult.value },
        orderBy: { date: 'asc' }
    });

    // Create a map for O(1) metrics lookup
    const metricsMap = new Map(metrics.map(m => [m.date.toISOString().split('T')[0], m]));

    const combinedData = history.map(h => {
        const dateStr = h.date.toISOString().split('T')[0];
        const m = metricsMap.get(dateStr);
        const trend = m ? JSON.parse(m.trendMetrics || '{}') : {};

        return {
            date: dateStr, // lightweight-charts accepts "YYYY-MM-DD"
            open: parseFloat(h.openPrice),
            high: parseFloat(h.highPrice),
            low: parseFloat(h.lowPrice),
            close: parseFloat(h.closePrice),
            volume: parseFloat(h.volume || 0),
            ma20: trend.ma20 || null,
            ma50: trend.ma50 || null
        };
    });

    const endTime = performance.now();
    logger.info(`GET /api/stocks/${symbolResult.value}/history execution time: ${(endTime - startTime).toFixed(2)}ms`);

    res.json({
        success: true,
        symbol: symbolResult.value,
        count: combinedData.length,
        data: combinedData
    });
}));

/**
 * GET /api/stocks/:symbol/depth
 * Get market depth (Level 2 data) and floorsheet for a stock
 */
router.get('/:symbol/depth', asyncHandler(async (req, res) => {
    const symbolResult = normalizeSymbolParam(req.params.symbol);
    if (symbolResult.error) {
        return res.status(400).json({
            success: false,
            error: { message: symbolResult.error }
        });
    }

    const depthFetcher = require('../services/depthFetcher');

    try {
        const depthData = await depthFetcher.getDepth(symbolResult.value);

        res.json({
            success: true,
            symbol: symbolResult.value,
            data: depthData
        });
    } catch (error) {
        logger.error(`Failed to fetch depth for ${symbolResult.value}: ${error.message}`);
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
            error: 'Operation failed'
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
            error: 'Operation failed'
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
        res.status(500).json({
            success: false,
            error: 'Operation failed'
        });
    }
});

module.exports = router;
