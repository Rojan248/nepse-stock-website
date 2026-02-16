const express = require('express');
const router = express.Router();
const watchdogService = require('../services/watchdog/WatchdogService');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * Trigger a manual verification
 */
router.post('/verify', asyncHandler(async (req, res) => {
    const report = await watchdogService.verify();
    res.json({
        success: true,
        data: report
    });
}));

/**
 * Get latest verification reports
 */
router.get('/reports', asyncHandler(async (req, res) => {
    const fs = require('fs').promises;
    const path = require('path');
    const LOG_FILE = path.join(__dirname, '../../logs/watchdog_verification.json');
    
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
