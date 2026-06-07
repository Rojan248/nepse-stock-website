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
const {
    getBoundedIntQuery,
    normalizeSymbolParam,
    sendQueryValidationError
} = require('../services/utils/queryValidation');

const VALID_PERIODS = new Set(['HOURLY', 'EOD', 'DAILY', 'WEEKLY', 'MONTHLY']);
const VALID_ADMIN_JOBS = new Set(['stock', 'market']);

const normalizePeriod = (value, fallback) => {
    if (typeof value !== 'string' && value !== undefined) return fallback;
    const period = (value || fallback).toString().toUpperCase();
    return VALID_PERIODS.has(period) ? period : fallback;
};

const sanitizeSchedulerStatus = (status) => ({
    enabled: status.enabled,
    running: status.running,
    scheduledJobs: status.scheduledJobs
});

const sanitizeSummaryStatus = (status) => ({
    stockSummaryCount: status.stockSummaryCount,
    marketSummaryCount: status.marketSummaryCount
});

const sanitizeStockSummary = (summary) => summary && ({
    symbol: summary.symbol,
    periodType: summary.periodType,
    periodStart: summary.periodStart,
    periodEnd: summary.periodEnd,
    summary: summary.summary,
    sentiment: summary.sentiment,
    confidence: summary.confidence,
    drivers: summary.drivers,
    risks: summary.risks,
    createdAt: summary.createdAt,
    updatedAt: summary.updatedAt
});

const sanitizeMarketSummary = (summary) => summary && ({
    periodType: summary.periodType,
    periodStart: summary.periodStart,
    periodEnd: summary.periodEnd,
    summary: summary.summary,
    sentiment: summary.sentiment,
    confidence: summary.confidence,
    breadth: summary.breadth,
    topMovers: summary.topMovers,
    sectors: summary.sectors,
    createdAt: summary.createdAt,
    updatedAt: summary.updatedAt
});

router.get('/status', asyncHandler(async (req, res) => {
    const [schedulerStatus, summaryStatus] = await Promise.all([
        Promise.resolve(aiSummaryScheduler.getStatus()),
        repository.getAiSummaryStatus()
    ]);

    res.json({
        success: true,
        data: {
            scheduler: sanitizeSchedulerStatus(schedulerStatus),
            summaries: sanitizeSummaryStatus(summaryStatus)
        }
    });
}));

router.get('/stocks/:symbol/latest', asyncHandler(async (req, res) => {
    const symbolResult = normalizeSymbolParam(req.params.symbol);
    if (symbolResult.error) {
        return res.status(400).json({ success: false, error: { message: symbolResult.error } });
    }
    const periodType = normalizePeriod(req.query.periodType, 'HOURLY');
    const summary = await repository.getLatestStockSummary(symbolResult.value, periodType);

    if (!summary) {
        return res.status(404).json({
            success: false,
            error: { message: 'No AI stock summary available' }
        });
    }

    res.json({ success: true, data: sanitizeStockSummary(summary) });
}));

router.get('/stocks/:symbol', asyncHandler(async (req, res) => {
    const symbolResult = normalizeSymbolParam(req.params.symbol);
    if (symbolResult.error) {
        return res.status(400).json({ success: false, error: { message: symbolResult.error } });
    }
    const periodType = normalizePeriod(req.query.periodType, 'HOURLY');
    const limit = getBoundedIntQuery(res, req.query.limit, { min: 1, max: 168, defaultValue: 24, label: 'limit' });
    if (limit === null) return;
    const summaries = await repository.getStockSummaries(symbolResult.value, { periodType, limit });

    res.json({
        success: true,
        data: summaries.map(sanitizeStockSummary),
        count: summaries.length
    });
}));

router.get('/market', asyncHandler(async (req, res) => {
    const periodType = normalizePeriod(req.query.periodType, 'DAILY');
    const limit = getBoundedIntQuery(res, req.query.limit, { min: 1, max: 100, defaultValue: 20, label: 'limit' });
    if (limit === null) return;
    const summaries = await repository.getMarketSummaries({ periodType, limit });

    res.json({
        success: true,
        data: summaries.map(sanitizeMarketSummary),
        count: summaries.length
    });
}));

router.post('/admin/run', adminLimiter, requireAdminKey, asyncHandler(async (req, res) => {
    const config = getAiSummaryConfig();
    const job = req.body.job === undefined ? 'stock' : req.body.job;
    if (typeof job !== 'string' || !VALID_ADMIN_JOBS.has(job.toLowerCase())) {
        return sendQueryValidationError(res, 'job must be stock or market');
    }
    const normalizedJob = job.toLowerCase();
    const periodType = normalizePeriod(req.body.periodType, normalizedJob === 'market' ? 'DAILY' : 'HOURLY');

    if (!config.enabled) {
        return res.status(409).json({
            success: false,
            error: { message: 'AI summaries are disabled. Set AI_SUMMARIES_ENABLED=true on the backend.' }
        });
    }

    const result = normalizedJob === 'market'
        ? await runMarketSummary({ periodType })
        : await runStockSummaries({ periodType });

    res.json({ success: !!result.success, data: result });
}));

module.exports = router;
