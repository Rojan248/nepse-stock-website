const express = require('express');
const router = express.Router();
const watchdogService = require('../services/watchdog/WatchdogService');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAdminKey } = require('../middleware/auth');
const { adminLimiter } = require('../middleware/rateLimiter');
const { normalizeSymbolParam } = require('../services/utils/queryValidation');
const fs = require('fs').promises;
const path = require('path');

const LOG_FILE = path.join(__dirname, '../../logs/watchdog_verification.json');

/**
 * Trigger a manual verification
 * Protected by Admin Key and Rate Limiter
 */
router.post('/verify', adminLimiter, requireAdminKey, asyncHandler(async (req, res) => {
    const report = await watchdogService.verify();
    res.json({
        success: true,
        data: report
    });
}));

/**
 * Trigger a targeted re-fetch and fix for a specific stock symbol
 * Protected by Admin Key
 */
router.post('/fix/:symbol', adminLimiter, requireAdminKey, asyncHandler(async (req, res) => {
    const symbolResult = normalizeSymbolParam(req.params.symbol);
    if (symbolResult.error) {
        return res.status(400).json({ success: false, error: { message: symbolResult.error } });
    }

    const result = await watchdogService.fixSpecificStock(symbolResult.value);
    res.json({
        success: result.success,
        data: result
    });
}));

/**
 * Trigger an audit for zero-volume price anomalies
 * Protected by Admin Key
 */
router.post('/audit-zero-volume', adminLimiter, requireAdminKey, asyncHandler(async (req, res) => {
    const result = await watchdogService.auditZeroVolume();
    res.json({
        success: !result.error,
        data: result
    });
}));

/**
 * Get latest verification reports
 * Protected by Admin Key and Rate Limiter (same middleware stack as /verify)
 */
router.get('/reports', adminLimiter, requireAdminKey, asyncHandler(async (req, res) => {
    try {
        const content = await fs.readFile(LOG_FILE, 'utf8');
        res.json({
            success: true,
            data: JSON.parse(content)
        });
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.json({
                success: true,
                data: []
            });
        } else {
            throw error;
        }
    }
}));

module.exports = router;
