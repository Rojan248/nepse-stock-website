const express = require('express');
const router = express.Router();
const ipoOperations = require('../services/database/ipoOperations');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../services/utils/logger');

/**
 * IPO API Routes
 * Endpoints for accessing IPO data
 */

/**
 * GET /api/ipos
 * Get all IPOs with optional filters
 */
router.get('/', asyncHandler(async (req, res) => {
    const { skip = 0, limit = 100, status } = req.query;

    const ipos = await ipoOperations.getAllIPOs({
        skip: parseInt(skip),
        limit: parseInt(limit),
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
    const { q } = req.query;

    if (!q || q.length < 1) {
        return res.status(400).json({
            success: false,
            error: { message: 'Search query is required' }
        });
    }

    const ipos = await ipoOperations.searchIPOs(q);

    res.json({
        success: true,
        data: ipos,
        count: ipos.length,
        query: q
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

    const ipo = await ipoOperations.getIPOByCompanyName(companyName);

    if (!ipo) {
        return res.status(404).json({
            success: false,
            error: { message: `IPO for '${companyName}' not found` }
        });
    }

    res.json({
        success: true,
        data: ipo
    });
}));

module.exports = router;
