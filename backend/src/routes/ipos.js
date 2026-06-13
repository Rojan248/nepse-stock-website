const express = require('express');
const router = express.Router();
const ipoOperations = require('../services/database/ipoOperations');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../services/utils/logger');
const { searchLimiter } = require('../middleware/rateLimiter');
const {
    getBoundedIntQuery,
    normalizeTextQuery,
    sendQueryValidationError
} = require('../services/utils/queryValidation');

/**
 * IPO API Routes
 * Endpoints for accessing IPO data
 */

const VALID_STATUSES = ['upcoming', 'open', 'closed', 'completed'];
const COMPANY_NAME_PATTERN = /^[a-zA-Z0-9 .\-()]+$/;
const MAX_COMPANY_NAME_LENGTH = 100;

const normalizeStatusQuery = (value) => {
    if (value === undefined || value === null || value === '') {
        return { value: null };
    }
    if (typeof value !== 'string') {
        return { error: 'status must be a single value' };
    }

    const status = value.trim().toLowerCase();
    if (!VALID_STATUSES.includes(status)) {
        return { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` };
    }
    return { value: status };
};

const normalizeCompanyNameParam = (value) => {
    if (typeof value !== 'string') {
        return { error: 'Invalid company name format' };
    }

    const companyName = value.trim();
    if (
        !companyName
        || companyName.length > MAX_COMPANY_NAME_LENGTH
        || !COMPANY_NAME_PATTERN.test(companyName)
    ) {
        return { error: 'Invalid company name format' };
    }

    return { value: companyName };
};

/**
 * GET /api/ipos
 * Get all IPOs with optional filters
 */
router.get('/', asyncHandler(async (req, res) => {
    const skipVal = getBoundedIntQuery(res, req.query.skip, { min: 0, max: 10000, defaultValue: 0, label: 'skip' });
    if (skipVal === null) return;
    const limitVal = getBoundedIntQuery(res, req.query.limit, { min: 1, max: 500, defaultValue: 100, label: 'limit' });
    if (limitVal === null) return;
    const statusResult = normalizeStatusQuery(req.query.status);
    if (statusResult.error) {
        return sendQueryValidationError(res, statusResult.error);
    }

    const ipos = await ipoOperations.getAllIPOs({
        skip: skipVal,
        limit: limitVal,
        status: statusResult.value
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
router.get('/search', searchLimiter, asyncHandler(async (req, res) => {
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
    const statusResult = normalizeStatusQuery(req.params.status);
    if (statusResult.error) {
        return sendQueryValidationError(res, statusResult.error);
    }

    const result = await ipoOperations.getIPOsByStatus(statusResult.value);

    res.json({
        success: true,
        data: result.ipos,
        count: result.count,
        status: statusResult.value
    });
}));

/**
 * GET /api/ipos/:companyName
 * Get specific IPO by company name
 */
router.get('/:companyName', asyncHandler(async (req, res) => {
    const companyNameResult = normalizeCompanyNameParam(req.params.companyName);
    if (companyNameResult.error) {
        return res.status(400).json({
            success: false,
            error: { message: companyNameResult.error }
        });
    }

    const ipo = await ipoOperations.getIPOByCompanyName(companyNameResult.value);

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
