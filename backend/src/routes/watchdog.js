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
    const fs = require('fs');
    const path = require('path');
    const LOG_FILE = path.join(__dirname, '../../logs/watchdog_verification.json');
    
    if (fs.existsSync(LOG_FILE)) {
        const content = fs.readFileSync(LOG_FILE, 'utf8');
        res.json({
            success: true,
            data: JSON.parse(content)
        });
    } else {
        res.json({
            success: true,
            data: []
        });
    }
}));

module.exports = router;
