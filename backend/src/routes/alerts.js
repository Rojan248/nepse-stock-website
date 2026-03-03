const express = require('express');
const router = express.Router();
const { prisma } = require('../services/database/connection');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth } = require('../middleware/authMiddleware');
const logger = require('../services/utils/logger');

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

    if (!symbol || !condition || threshold == null) {
        return res.status(400).json({ success: false, error: { message: 'symbol, condition, and threshold are required' } });
    }
    if (!VALID_CONDITIONS.includes(condition)) {
        return res.status(400).json({ success: false, error: { message: `condition must be one of: ${VALID_CONDITIONS.join(', ')}` } });
    }

    const alert = await prisma.alert.create({
        data: {
            userId: req.user.userId,
            symbol: symbol.toUpperCase(),
            condition,
            threshold: parseFloat(threshold)
        }
    });
    logger.info(`Alert created: ${alert.symbol} ${alert.condition} ${alert.threshold} for user ${req.user.userId}`);
    res.status(201).json({ success: true, data: alert });
}));

// PUT /api/alerts/:id — update (toggle enabled, change threshold)
router.put('/:id', requireAuth, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    const alert = await prisma.alert.findFirst({ where: { id, userId: req.user.userId } });
    if (!alert) {
        return res.status(404).json({ success: false, error: { message: 'Alert not found' } });
    }

    const updateData = {};
    if (req.body.enabled !== undefined) updateData.enabled = Boolean(req.body.enabled);
    if (req.body.threshold !== undefined) updateData.threshold = parseFloat(req.body.threshold);
    if (req.body.condition && VALID_CONDITIONS.includes(req.body.condition)) updateData.condition = req.body.condition;

    const updated = await prisma.alert.update({ where: { id }, data: updateData });
    res.json({ success: true, data: updated });
}));

// DELETE /api/alerts/:id
router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    const alert = await prisma.alert.findFirst({ where: { id, userId: req.user.userId } });
    if (!alert) {
        return res.status(404).json({ success: false, error: { message: 'Alert not found' } });
    }
    await prisma.alert.delete({ where: { id } });
    res.json({ success: true, data: { message: 'Alert deleted' } });
}));

module.exports = router;
