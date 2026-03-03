const express = require('express');
const router = express.Router();
const { prisma } = require('../services/database/connection');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth } = require('../middleware/authMiddleware');
const logger = require('../services/utils/logger');

// ==================== Portfolio CRUD ====================

// GET /api/portfolios — list user's portfolios
router.get('/', requireAuth, asyncHandler(async (req, res) => {
    const portfolios = await prisma.portfolio.findMany({
        where: { userId: req.user.userId },
        include: { trades: { orderBy: { date: 'desc' } } },
        orderBy: { createdAt: 'asc' }
    });
    res.json({ success: true, data: portfolios });
}));

// POST /api/portfolios — create a portfolio
router.post('/', requireAuth, asyncHandler(async (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ success: false, error: { message: 'Portfolio name is required' } });
    }
    const portfolio = await prisma.portfolio.create({
        data: { name: name.trim(), userId: req.user.userId },
        include: { trades: true }
    });
    res.status(201).json({ success: true, data: portfolio });
}));

// DELETE /api/portfolios/:id
router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
    const id = parseInt(req.params.id);
    const portfolio = await prisma.portfolio.findFirst({ where: { id, userId: req.user.userId } });
    if (!portfolio) {
        return res.status(404).json({ success: false, error: { message: 'Portfolio not found' } });
    }
    await prisma.portfolio.delete({ where: { id } });
    res.json({ success: true, data: { message: 'Portfolio deleted' } });
}));

// ==================== Trades ====================

// POST /api/portfolios/:id/trades — add a trade
router.post('/:id/trades', requireAuth, asyncHandler(async (req, res) => {
    const portfolioId = parseInt(req.params.id);
    const { symbol, type, quantity, price, date, note } = req.body;

    // Validate
    if (!symbol || !type || !quantity || !price || !date) {
        return res.status(400).json({ success: false, error: { message: 'symbol, type, quantity, price, and date are required' } });
    }
    if (!['buy', 'sell'].includes(type)) {
        return res.status(400).json({ success: false, error: { message: 'type must be "buy" or "sell"' } });
    }

    const portfolio = await prisma.portfolio.findFirst({ where: { id: portfolioId, userId: req.user.userId } });
    if (!portfolio) {
        return res.status(404).json({ success: false, error: { message: 'Portfolio not found' } });
    }

    const trade = await prisma.trade.create({
        data: {
            portfolioId,
            symbol: symbol.toUpperCase(),
            type,
            quantity: parseInt(quantity),
            price: parseFloat(price),
            date: new Date(date),
            note: note || null
        }
    });
    res.status(201).json({ success: true, data: trade });
}));

// DELETE /api/portfolios/:id/trades/:tradeId — delete a trade
router.delete('/:id/trades/:tradeId', requireAuth, asyncHandler(async (req, res) => {
    const portfolioId = parseInt(req.params.id);
    const tradeId = parseInt(req.params.tradeId);

    const portfolio = await prisma.portfolio.findFirst({ where: { id: portfolioId, userId: req.user.userId } });
    if (!portfolio) {
        return res.status(404).json({ success: false, error: { message: 'Portfolio not found' } });
    }

    const trade = await prisma.trade.findFirst({ where: { id: tradeId, portfolioId } });
    if (!trade) {
        return res.status(404).json({ success: false, error: { message: 'Trade not found' } });
    }

    await prisma.trade.delete({ where: { id: tradeId } });
    res.json({ success: true, data: { message: 'Trade deleted' } });
}));

// ==================== Holdings Computation ====================

// GET /api/portfolios/:id/holdings — computed holdings with P&L
router.get('/:id/holdings', requireAuth, asyncHandler(async (req, res) => {
    const portfolioId = parseInt(req.params.id);
    const portfolio = await prisma.portfolio.findFirst({
        where: { id: portfolioId, userId: req.user.userId },
        include: { trades: { orderBy: { date: 'asc' } } }
    });
    if (!portfolio) {
        return res.status(404).json({ success: false, error: { message: 'Portfolio not found' } });
    }

    // Aggregate trades into holdings
    const holdingsMap = {};
    for (const trade of portfolio.trades) {
        if (!holdingsMap[trade.symbol]) {
            holdingsMap[trade.symbol] = { symbol: trade.symbol, quantity: 0, totalCost: 0 };
        }
        const h = holdingsMap[trade.symbol];
        if (trade.type === 'buy') {
            h.totalCost += trade.quantity * trade.price;
            h.quantity += trade.quantity;
        } else {
            // Sell: reduce quantity, proportionally reduce cost basis
            const avgCost = h.quantity > 0 ? h.totalCost / h.quantity : 0;
            const sellQty = Math.min(trade.quantity, h.quantity);
            h.totalCost -= sellQty * avgCost;
            h.quantity -= sellQty;
        }
    }

    // Fetch current prices for each held symbol
    const symbols = Object.keys(holdingsMap).filter(s => holdingsMap[s].quantity > 0);
    const stocks = symbols.length > 0
        ? await prisma.stock.findMany({ where: { symbol: { in: symbols } } })
        : [];

    const priceMap = {};
    for (const s of stocks) { priceMap[s.symbol] = s.lastTradedPrice || 0; }

    const holdings = symbols.map(symbol => {
        const h = holdingsMap[symbol];
        const currentPrice = priceMap[symbol] || 0;
        const avgCost = h.quantity > 0 ? h.totalCost / h.quantity : 0;
        const marketValue = h.quantity * currentPrice;
        const unrealizedPL = marketValue - h.totalCost;
        const unrealizedPLPercent = h.totalCost > 0 ? (unrealizedPL / h.totalCost) * 100 : 0;

        return {
            symbol,
            quantity: h.quantity,
            avgCost: Math.round(avgCost * 100) / 100,
            currentPrice,
            marketValue: Math.round(marketValue * 100) / 100,
            totalCost: Math.round(h.totalCost * 100) / 100,
            unrealizedPL: Math.round(unrealizedPL * 100) / 100,
            unrealizedPLPercent: Math.round(unrealizedPLPercent * 100) / 100
        };
    });

    const totalCost = holdings.reduce((sum, h) => sum + h.totalCost, 0);
    const totalValue = holdings.reduce((sum, h) => sum + h.marketValue, 0);
    const totalPL = totalValue - totalCost;

    res.json({
        success: true,
        data: {
            portfolio: { id: portfolio.id, name: portfolio.name },
            holdings,
            summary: {
                totalCost: Math.round(totalCost * 100) / 100,
                totalValue: Math.round(totalValue * 100) / 100,
                totalPL: Math.round(totalPL * 100) / 100,
                totalPLPercent: totalCost > 0 ? Math.round((totalPL / totalCost) * 10000) / 100 : 0
            }
        }
    });
}));

module.exports = router;
