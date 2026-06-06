const express = require('express');
const router = express.Router();
const ipoOperations = require('../services/database/ipoOperations');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../services/utils/logger');
const { clampInt, normalizeTextQuery } = require('../services/utils/queryValidation');

/**
 * IPO API Routes
 * Endpoints for accessing IPO data
 */

/**
 * GET /api/ipos
 * Get all IPOs with optional filters
 */
router.get('/', asyncHandler(async (req, res) => {
    const skipVal = clampInt(req.query.skip, 0, 10000, 0);
    const limitVal = clampInt(req.query.limit, 1, 500, 100);
    const { status } = req.query;

    const ipos = await ipoOperations.getAllIPOs({
        skip: skipVal,
        limit: limitVal,
        status: status || null
    });

    const counts = await ipoOperations.getIPOCounts();

    res.json({
        success: true,
        data: ipos,
        count: ipos.length,
        statistics: counts
    });
}));

/**
 * GET /api/ipos/active
 * Get currently active/open IPOs
 */
router.get('/active', asyncHandler(async (req, res) => {
    const ipos = await ipoOperations.getActiveIPOs();

    res.json({
        success: true,
        data: ipos,
        count: ipos.length
    });
}));

/**
 * GET /api/ipos/search
 * Search IPOs by name
 */
router.get('/search', asyncHandler(async (req, res) => {
    const queryResult = normalizeTextQuery(req.query.q, { maxLength: 80 });
    if (queryResult.error) {
        return res.status(400).json({
            success: false,
            error: { message: queryResult.error }
        });
    }

    const ipos = await ipoOperations.searchIPOs(queryResult.value);

    res.json({
        success: true,
        data: ipos,
        count: ipos.length,
        query: queryResult.value
    });
}));

/**
 * GET /api/ipos/counts
 * Get IPO counts by status
 */
router.get('/counts', asyncHandler(async (req, res) => {
    const counts = await ipoOperations.getIPOCounts();

    res.json({
        success: true,
        data: counts
    });
}));

/**
 * GET /api/ipos/status/:status
 * Get IPOs by status
 */
router.get('/status/:status', asyncHandler(async (req, res) => {
    const { status } = req.params;

    // Validate status
    const validStatuses = ['upcoming', 'open', 'closed', 'completed'];
    if (!validStatuses.includes(status.toLowerCase())) {
        return res.status(400).json({
            success: false,
            error: {
                message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
            }
        });
    }

    const ipos = await ipoOperations.getIPOsByStatus(status);

    res.json({
        success: true,
        data: ipos,
        count: ipos.length,
        status
    });
}));

/**
 * GET /api/ipos/:companyName
 * Get specific IPO by company name
 */
router.get('/:companyName', asyncHandler(async (req, res) => {
    const { companyName } = req.params;
    // Validate companyName format: alphanumeric, spaces, dots, dashes, parentheses only, max 100 chars
    if (!/^[a-zA-Z0-9\s.\-()]+$/.test(companyName) || companyName.length > 100) {
        return res.status(400).json({
            success: false,
            error: { message: 'Invalid company name format' }
        });
    }

    const ipo = await ipoOperations.getIPOByCompanyName(companyName);

    if (!ipo) {
        return res.status(404).json({
            success: false,
            error: { message: 'IPO not found' }
        });
    }

    res.json({
        success: true,
        data: ipo
    });
}));

module.exports = router;
