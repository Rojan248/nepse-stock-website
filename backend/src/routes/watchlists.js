const express = require('express');
const router = express.Router();
const { prisma } = require('../services/database/connection');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth } = require('../middleware/authMiddleware');
const {
    normalizeSymbol,
    normalizeSymbolList,
    parsePositiveInteger,
    sendValidationError,
    validateName
} = require('../services/utils/requestValidation');

// ==================== Authenticated Watchlist CRUD ====================

const SHARE_SLUG_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

const mapPublicWatchlistItem = (item) => ({
    symbol: item.symbol,
    addedAt: item.addedAt
});

// GET /api/watchlists — list user's watchlists
router.get('/', requireAuth, asyncHandler(async (req, res) => {
    const watchlists = await prisma.watchlist.findMany({
        where: { userId: req.user.userId },
        include: { items: { orderBy: { addedAt: 'desc' } } },
        orderBy: { createdAt: 'asc' }
    });
    res.json({ success: true, data: watchlists });
}));

// POST /api/watchlists — create a new watchlist
router.post('/', requireAuth, asyncHandler(async (req, res) => {
    const nameResult = validateName(req.body.name, 'Watchlist name');
    if (nameResult.error) {
        return sendValidationError(res, nameResult.error);
    }

    const watchlist = await prisma.watchlist.create({
        data: { name: nameResult.value, userId: req.user.userId },
        include: { items: true }
    });
    res.status(201).json({ success: true, data: watchlist });
}));

// PUT /api/watchlists/:id — rename a watchlist
router.put('/:id', requireAuth, asyncHandler(async (req, res) => {
    const idResult = parsePositiveInteger(req.params.id, 'Watchlist ID');
    if (idResult.error) {
        return sendValidationError(res, idResult.error);
    }
    const nameResult = validateName(req.body.name, 'Watchlist name');
    if (nameResult.error) {
        return sendValidationError(res, nameResult.error);
    }

    const id = idResult.value;
    const watchlist = await prisma.watchlist.findFirst({ where: { id, userId: req.user.userId } });
    if (!watchlist) {
        return res.status(404).json({ success: false, error: { message: 'Watchlist not found' } });
    }

    const updated = await prisma.watchlist.update({
        where: { id },
        data: { name: nameResult.value },
        include: { items: true }
    });
    res.json({ success: true, data: updated });
}));

// DELETE /api/watchlists/:id — delete a watchlist
router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
    const idResult = parsePositiveInteger(req.params.id, 'Watchlist ID');
    if (idResult.error) {
        return sendValidationError(res, idResult.error);
    }

    const id = idResult.value;
    const watchlist = await prisma.watchlist.findFirst({ where: { id, userId: req.user.userId } });
    if (!watchlist) {
        return res.status(404).json({ success: false, error: { message: 'Watchlist not found' } });
    }
    await prisma.watchlist.delete({ where: { id } });
    res.json({ success: true, data: { message: 'Watchlist deleted' } });
}));

// ==================== Watchlist Items ====================

// POST /api/watchlists/:id/items — add a symbol
router.post('/:id/items', requireAuth, asyncHandler(async (req, res) => {
    const idResult = parsePositiveInteger(req.params.id, 'Watchlist ID');
    if (idResult.error) {
        return sendValidationError(res, idResult.error);
    }
    const symbolResult = normalizeSymbol(req.body.symbol);
    if (symbolResult.error) {
        return sendValidationError(res, symbolResult.error);
    }

    const watchlistId = idResult.value;
    const symbol = symbolResult.value;
    const watchlist = await prisma.watchlist.findFirst({ where: { id: watchlistId, userId: req.user.userId } });
    if (!watchlist) {
        return res.status(404).json({ success: false, error: { message: 'Watchlist not found' } });
    }

    // Check for duplicate
    const existing = await prisma.watchlistItem.findUnique({
        where: { watchlistId_symbol: { watchlistId, symbol } }
    });
    if (existing) {
        return res.status(409).json({ success: false, error: { message: 'Symbol already in watchlist' } });
    }

    const item = await prisma.watchlistItem.create({
        data: { watchlistId, symbol }
    });
    res.status(201).json({ success: true, data: item });
}));

// DELETE /api/watchlists/:id/items/:symbol — remove a symbol
router.delete('/:id/items/:symbol', requireAuth, asyncHandler(async (req, res) => {
    const idResult = parsePositiveInteger(req.params.id, 'Watchlist ID');
    if (idResult.error) {
        return sendValidationError(res, idResult.error);
    }
    const symbolResult = normalizeSymbol(req.params.symbol);
    if (symbolResult.error) {
        return sendValidationError(res, symbolResult.error);
    }

    const watchlistId = idResult.value;
    const symbol = symbolResult.value;
    const watchlist = await prisma.watchlist.findFirst({ where: { id: watchlistId, userId: req.user.userId } });
    if (!watchlist) {
        return res.status(404).json({ success: false, error: { message: 'Watchlist not found' } });
    }

    const item = await prisma.watchlistItem.findUnique({
        where: { watchlistId_symbol: { watchlistId, symbol } }
    });
    if (!item) {
        return res.status(404).json({ success: false, error: { message: 'Symbol not in watchlist' } });
    }

    await prisma.watchlistItem.delete({ where: { id: item.id } });
    res.json({ success: true, data: { message: `${symbol} removed from watchlist` } });
}));

// ==================== Bulk import (localStorage migration) ====================

// POST /api/watchlists/:id/import — bulk-add symbols
router.post('/:id/import', requireAuth, asyncHandler(async (req, res) => {
    const idResult = parsePositiveInteger(req.params.id, 'Watchlist ID');
    if (idResult.error) {
        return sendValidationError(res, idResult.error);
    }
    const symbolsResult = normalizeSymbolList(req.body.symbols);
    if (symbolsResult.error) {
        return sendValidationError(res, symbolsResult.error);
    }

    const watchlistId = idResult.value;
    const watchlist = await prisma.watchlist.findFirst({ where: { id: watchlistId, userId: req.user.userId } });
    if (!watchlist) {
        return res.status(404).json({ success: false, error: { message: 'Watchlist not found' } });
    }

    const results = { added: 0, skipped: 0 };
    for (const symbol of symbolsResult.value) {
        try {
            await prisma.watchlistItem.create({ data: { watchlistId, symbol } });
            results.added++;
        } catch {
            results.skipped++; // duplicate
        }
    }

    const updated = await prisma.watchlist.findUnique({
        where: { id: watchlistId },
        include: { items: { orderBy: { addedAt: 'desc' } } }
    });

    res.json({ success: true, data: updated, meta: results });
}));

// ==================== Shared/Public Watchlist ====================

// GET /api/watchlists/shared/:slug — view a public watchlist (no auth required)
router.get('/shared/:slug', asyncHandler(async (req, res) => {
    const { slug } = req.params;
    if (!SHARE_SLUG_PATTERN.test(slug)) {
        return res.status(400).json({ success: false, error: { message: 'Invalid share slug' } });
    }

    const watchlist = await prisma.watchlist.findUnique({
        where: { publicSlug: slug },
        include: {
            items: { orderBy: { addedAt: 'desc' } },
            user: { select: { displayName: true } }
        }
    });
    if (!watchlist) {
        return res.status(404).json({ success: false, error: { message: 'Shared watchlist not found' } });
    }
    res.json({
        success: true,
        data: {
            name: watchlist.name,
            owner: watchlist.user?.displayName || 'Anonymous',
            items: watchlist.items.map(mapPublicWatchlistItem),
            createdAt: watchlist.createdAt
        }
    });
}));

// POST /api/watchlists/:id/share — generate a public slug
router.post('/:id/share', requireAuth, asyncHandler(async (req, res) => {
    const idResult = parsePositiveInteger(req.params.id, 'Watchlist ID');
    if (idResult.error) {
        return sendValidationError(res, idResult.error);
    }

    const id = idResult.value;
    const watchlist = await prisma.watchlist.findFirst({ where: { id, userId: req.user.userId } });
    if (!watchlist) {
        return res.status(404).json({ success: false, error: { message: 'Watchlist not found' } });
    }

    // Generate slug if not already shared
    let slug = watchlist.publicSlug;
    if (!slug) {
        const crypto = require('crypto');
        slug = crypto.randomBytes(6).toString('base64url');
        await prisma.watchlist.update({ where: { id }, data: { publicSlug: slug } });
    }

    res.json({ success: true, data: { publicSlug: slug, shareUrl: `/w/${slug}` } });
}));

// POST /api/watchlists/:id/unshare — remove public access
router.post('/:id/unshare', requireAuth, asyncHandler(async (req, res) => {
    const idResult = parsePositiveInteger(req.params.id, 'Watchlist ID');
    if (idResult.error) {
        return sendValidationError(res, idResult.error);
    }

    const id = idResult.value;
    const watchlist = await prisma.watchlist.findFirst({ where: { id, userId: req.user.userId } });
    if (!watchlist) {
        return res.status(404).json({ success: false, error: { message: 'Watchlist not found' } });
    }

    await prisma.watchlist.update({ where: { id }, data: { publicSlug: null } });
    res.json({ success: true, data: { message: 'Watchlist is now private' } });
}));

module.exports = router;
