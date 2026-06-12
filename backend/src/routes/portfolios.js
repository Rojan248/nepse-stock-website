const express = require('express');
const router = express.Router();
const { prisma } = require('../services/database/connection');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth } = require('../middleware/authMiddleware');
const portfolioCalculator = require('../services/portfolioCalculator');
const {
    normalizeSymbol,
    parsePositiveInteger,
    parsePositiveNumber,
    parseRequiredDate,
    sendValidationError,
    validateName,
    validateOptionalNote
} = require('../services/utils/requestValidation');
const {
    USER_RESOURCE_LIMITS,
    assertResourceLimit,
    sendResourceQuotaError
} = require('../services/utils/resourceQuotas');

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
    const nameResult = validateName(req.body.name, 'Portfolio name');
    if (nameResult.error) {
        return sendValidationError(res, nameResult.error);
    }

    let portfolio;
    try {
        portfolio = await prisma.$transaction(async (tx) => {
            const portfolioCount = await tx.portfolio.count({ where: { userId: req.user.userId } });
            assertResourceLimit({
                count: portfolioCount,
                limit: USER_RESOURCE_LIMITS.portfolios,
                label: 'Portfolio'
            });

            return tx.portfolio.create({
                data: { name: nameResult.value, userId: req.user.userId },
                include: { trades: true }
            });
        });
    } catch (error) {
        if (sendResourceQuotaError(res, error)) return;
        throw error;
    }
    res.status(201).json({ success: true, data: portfolio });
}));

// DELETE /api/portfolios/:id
router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
    const idResult = parsePositiveInteger(req.params.id, 'Portfolio ID');
    if (idResult.error) {
        return sendValidationError(res, idResult.error);
    }

    const id = idResult.value;
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
    const idResult = parsePositiveInteger(req.params.id, 'Portfolio ID');
    if (idResult.error) {
        return sendValidationError(res, idResult.error);
    }

    const { symbol, type, quantity, price, date, note } = req.body;

    if (!type || quantity === undefined || price === undefined || date === undefined) {
        return res.status(400).json({ success: false, error: { message: 'symbol, type, quantity, price, and date are required' } });
    }
    const symbolResult = normalizeSymbol(symbol);
    if (symbolResult.error) {
        return sendValidationError(res, symbolResult.error);
    }
    if (!['buy', 'sell'].includes(type)) {
        return res.status(400).json({ success: false, error: { message: 'type must be "buy" or "sell"' } });
    }
    const quantityResult = parsePositiveInteger(quantity, 'Quantity');
    if (quantityResult.error) {
        return sendValidationError(res, quantityResult.error);
    }
    const priceResult = parsePositiveNumber(price, 'Price');
    if (priceResult.error) {
        return sendValidationError(res, priceResult.error);
    }
    const dateResult = parseRequiredDate(date, 'Date');
    if (dateResult.error) {
        return sendValidationError(res, dateResult.error);
    }
    const noteResult = validateOptionalNote(note);
    if (noteResult.error) {
        return sendValidationError(res, noteResult.error);
    }

    const portfolioId = idResult.value;
    let trade;
    try {
        trade = await prisma.$transaction(async (tx) => {
            const portfolio = await tx.portfolio.findFirst({ where: { id: portfolioId, userId: req.user.userId } });
            if (!portfolio) {
                return null;
            }

            const tradeCount = await tx.trade.count({ where: { portfolioId } });
            assertResourceLimit({
                count: tradeCount,
                limit: USER_RESOURCE_LIMITS.tradesPerPortfolio,
                label: 'Portfolio trade'
            });

            return tx.trade.create({
                data: {
                    portfolioId,
                    symbol: symbolResult.value,
                    type,
                    quantity: quantityResult.value,
                    price: priceResult.value,
                    date: dateResult.value,
                    note: noteResult.value
                }
            });
        });
    } catch (error) {
        if (sendResourceQuotaError(res, error)) return;
        throw error;
    }
    if (!trade) {
        return res.status(404).json({ success: false, error: { message: 'Portfolio not found' } });
    }
    res.status(201).json({ success: true, data: trade });
}));

// DELETE /api/portfolios/:id/trades/:tradeId — delete a trade
router.delete('/:id/trades/:tradeId', requireAuth, asyncHandler(async (req, res) => {
    const portfolioIdResult = parsePositiveInteger(req.params.id, 'Portfolio ID');
    if (portfolioIdResult.error) {
        return sendValidationError(res, portfolioIdResult.error);
    }
    const tradeIdResult = parsePositiveInteger(req.params.tradeId, 'Trade ID');
    if (tradeIdResult.error) {
        return sendValidationError(res, tradeIdResult.error);
    }

    const portfolioId = portfolioIdResult.value;
    const tradeId = tradeIdResult.value;
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

// GET /api/portfolios/:id/summary — computed holdings with detailed P&L
router.get('/:id/summary', requireAuth, asyncHandler(async (req, res) => {
    const portfolioIdResult = parsePositiveInteger(req.params.id, 'Portfolio ID');
    if (portfolioIdResult.error) {
        return sendValidationError(res, portfolioIdResult.error);
    }

    const portfolioId = portfolioIdResult.value;

    // Verify portfolio exists and belongs to user
    const portfolio = await prisma.portfolio.findFirst({
        where: { id: portfolioId, userId: req.user.userId },
        select: { id: true, name: true }
    });

    if (!portfolio) {
        return res.status(404).json({ success: false, error: { message: 'Portfolio not found' } });
    }

    const pnlData = await portfolioCalculator.calculatePortfolioPnL(req.user.userId, portfolioId);

    res.json({
        success: true,
        data: {
            portfolio,
            ...pnlData
        }
    });
}));

// GET /api/portfolios/summary — aggregate P&L for all user portfolios
router.get('/summary', requireAuth, asyncHandler(async (req, res) => {
    const pnlData = await portfolioCalculator.calculatePortfolioPnL(req.user.userId);
    res.json({
        success: true,
        data: pnlData
    });
}));

// GET /api/portfolios/:id/holdings — computed holdings with P&L
router.get('/:id/holdings', requireAuth, asyncHandler(async (req, res) => {
    const portfolioIdResult = parsePositiveInteger(req.params.id, 'Portfolio ID');
    if (portfolioIdResult.error) {
        return sendValidationError(res, portfolioIdResult.error);
    }

    const portfolioId = portfolioIdResult.value;
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
