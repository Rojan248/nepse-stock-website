const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAdminKey } = require('../middleware/auth');
const { adminLimiter } = require('../middleware/rateLimiter');
const repository = require('../services/ai/summaryRepository');
const aiSummaryScheduler = require('../services/scheduler/aiSummaryScheduler');
const { runStockSummaries } = require('../services/ai/stockSummaryWorker');
const { runMarketSummary } = require('../services/ai/marketSummaryWorker');
const { getAiSummaryConfig } = require('../services/ai/aiSummaryConfig');

const VALID_PERIODS = new Set(['HOURLY', 'EOD', 'DAILY', 'WEEKLY', 'MONTHLY']);

const parseLimit = (value, fallback, max) => {
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.min(parsed, max);
};

const normalizePeriod = (value, fallback) => {
    const period = (value || fallback).toString().toUpperCase();
    return VALID_PERIODS.has(period) ? period : fallback;
};

router.get('/status', asyncHandler(async (req, res) => {
    const [schedulerStatus, summaryStatus] = await Promise.all([
        Promise.resolve(aiSummaryScheduler.getStatus()),
        repository.getAiSummaryStatus()
    ]);

    res.json({
        success: true,
        data: {
            scheduler: schedulerStatus,
            summaries: summaryStatus
        }
    });
}));

router.get('/stocks/:symbol/latest', asyncHandler(async (req, res) => {
    const periodType = normalizePeriod(req.query.periodType, 'HOURLY');
    const summary = await repository.getLatestStockSummary(req.params.symbol, periodType);

    if (!summary) {
        return res.status(404).json({
            success: false,
            error: { message: 'No AI stock summary available' }
        });
    }

    res.json({ success: true, data: summary });
}));

router.get('/stocks/:symbol', asyncHandler(async (req, res) => {
    const periodType = normalizePeriod(req.query.periodType, 'HOURLY');
    const limit = parseLimit(req.query.limit, 24, 168);
    const summaries = await repository.getStockSummaries(req.params.symbol, { periodType, limit });

    res.json({
        success: true,
        data: summaries,
        count: summaries.length
    });
}));

router.get('/market', asyncHandler(async (req, res) => {
    const periodType = normalizePeriod(req.query.periodType, 'DAILY');
    const limit = parseLimit(req.query.limit, 20, 100);
    const summaries = await repository.getMarketSummaries({ periodType, limit });

    res.json({
        success: true,
        data: summaries,
        count: summaries.length
    });
}));

router.post('/admin/run', adminLimiter, requireAdminKey, asyncHandler(async (req, res) => {
    const config = getAiSummaryConfig();
    const job = (req.body.job || 'stock').toString().toLowerCase();
    const periodType = normalizePeriod(req.body.periodType, job === 'market' ? 'DAILY' : 'HOURLY');

    if (!config.enabled) {
        return res.status(409).json({
            success: false,
            error: { message: 'AI summaries are disabled. Set AI_SUMMARIES_ENABLED=true on the backend.' }
        });
    }

    const result = job === 'market'
        ? await runMarketSummary({ periodType })
        : await runStockSummaries({ periodType });

    res.json({ success: !!result.success, data: result });
}));

module.exports = router;
