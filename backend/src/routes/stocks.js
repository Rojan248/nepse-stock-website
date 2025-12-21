const express = require('express');
const router = express.Router();
const stockOperations = require('../services/database/stockOperations');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../services/utils/logger');

/**
 * Stock API Routes
 * Endpoints for accessing stock data
 */

/**
 * GET /api/stocks
 * Get all stocks with optional pagination
 */
router.get('/', asyncHandler(async (req, res) => {
    const { skip = 0, limit = 500, sortBy = 'symbol', sortOrder = 'asc' } = req.query;

    const stocks = await stockOperations.getAllStocks({
        skip: parseInt(skip),
        limit: parseInt(limit),
        sortBy,
        sortOrder: sortOrder === 'desc' ? -1 : 1
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
router.get('/search', asyncHandler(async (req, res) => {
    const { q } = req.query;

    if (!q || q.length < 1) {
        return res.status(400).json({
            success: false,
            error: { message: 'Search query is required' }
        });
    }

    const stocks = await stockOperations.searchStocks(q);

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
 * GET /api/stocks/:symbol
 * Get specific stock by symbol
 */
router.get('/:symbol', asyncHandler(async (req, res) => {
    const { symbol } = req.params;

    const stock = await stockOperations.getStockBySymbol(symbol);

    if (!stock) {
        return res.status(404).json({
            success: false,
            error: { message: `Stock with symbol '${symbol}' not found` }
        });
    }

    res.json({
        success: true,
        data: stock
    });
}));

/**
 * POST /api/stocks/admin/cleanup
 * Delete inactive stocks (zero LTP) from database
 * Should be called after data refresh
 */
router.post('/admin/cleanup', async (req, res) => {
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
 * POST /api/stocks/admin/validate
 * Remove stocks not in the official NEPSE list
 * Fetches valid symbols from NEPSE API and removes any stocks not in that list
 */
router.post('/admin/validate', async (req, res) => {
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
