const express = require('express');
const router = express.Router();
const { prisma } = require('../services/database/connection');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth } = require('../middleware/authMiddleware');
const logger = require('../services/utils/logger');
const {
    normalizeSymbol,
    parseBoolean,
    parsePositiveInteger,
    parsePositiveNumber,
    sendValidationError
} = require('../services/utils/requestValidation');

const VALID_CONDITIONS = ['above', 'below', 'pct_change'];

// GET /api/alerts — list user's alerts
router.get('/', requireAuth, asyncHandler(async (req, res) => {
    const alerts = await prisma.alert.findMany({
        where: { userId: req.user.userId },
        include: { deliveries: { orderBy: { triggeredAt: 'desc' }, take: 5 } },
        orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: alerts });
}));

// POST /api/alerts — create an alert
router.post('/', requireAuth, asyncHandler(async (req, res) => {
    const { symbol, condition, threshold } = req.body;

    if (!condition || threshold == null) {
        return res.status(400).json({ success: false, error: { message: 'symbol, condition, and threshold are required' } });
    }
    const symbolResult = normalizeSymbol(symbol);
    if (symbolResult.error) {
        return sendValidationError(res, symbolResult.error);
    }
    if (!VALID_CONDITIONS.includes(condition)) {
        return res.status(400).json({ success: false, error: { message: `condition must be one of: ${VALID_CONDITIONS.join(', ')}` } });
    }
    const thresholdResult = parsePositiveNumber(threshold, 'Threshold');
    if (thresholdResult.error) {
        return sendValidationError(res, thresholdResult.error);
    }

    const alert = await prisma.alert.create({
        data: {
            userId: req.user.userId,
            symbol: symbolResult.value,
            condition,
            threshold: thresholdResult.value
        }
    });
    logger.info(`Alert created: ${alert.symbol} ${alert.condition} ${alert.threshold} for user ${req.user.userId}`);
    res.status(201).json({ success: true, data: alert });
}));

// PUT /api/alerts/:id — update (toggle enabled, change threshold)
router.put('/:id', requireAuth, asyncHandler(async (req, res) => {
    const idResult = parsePositiveInteger(req.params.id, 'Alert ID');
    if (idResult.error) {
        return sendValidationError(res, idResult.error);
    }

    const updateData = {};
    if (req.body.enabled !== undefined) {
        const enabledResult = parseBoolean(req.body.enabled, 'enabled');
        if (enabledResult.error) {
            return sendValidationError(res, enabledResult.error);
        }
        updateData.enabled = enabledResult.value;
    }
    if (req.body.threshold !== undefined) {
        const thresholdResult = parsePositiveNumber(req.body.threshold, 'Threshold');
        if (thresholdResult.error) {
            return sendValidationError(res, thresholdResult.error);
        }
        updateData.threshold = thresholdResult.value;
    }
    if (req.body.condition !== undefined) {
        if (!VALID_CONDITIONS.includes(req.body.condition)) {
            return res.status(400).json({ success: false, error: { message: `condition must be one of: ${VALID_CONDITIONS.join(', ')}` } });
        }
        updateData.condition = req.body.condition;
    }

    const id = idResult.value;
    const alert = await prisma.alert.findFirst({ where: { id, userId: req.user.userId } });
    if (!alert) {
        return res.status(404).json({ success: false, error: { message: 'Alert not found' } });
    }

    const updated = await prisma.alert.update({ where: { id }, data: updateData });
    res.json({ success: true, data: updated });
}));

// DELETE /api/alerts/:id
router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
    const idResult = parsePositiveInteger(req.params.id, 'Alert ID');
    if (idResult.error) {
        return sendValidationError(res, idResult.error);
    }

    const id = idResult.value;
    const alert = await prisma.alert.findFirst({ where: { id, userId: req.user.userId } });
    if (!alert) {
        return res.status(404).json({ success: false, error: { message: 'Alert not found' } });
    }
    await prisma.alert.delete({ where: { id } });
    res.json({ success: true, data: { message: 'Alert deleted' } });
}));

module.exports = router;
