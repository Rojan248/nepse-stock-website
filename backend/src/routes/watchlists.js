const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { prisma } = require('../services/database/connection');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireAuth } = require('../middleware/authMiddleware');
const { shareLookupLimiter } = require('../middleware/rateLimiter');
const {
    normalizeSymbol,
    normalizeSymbolList,
    parsePositiveInteger,
    sendValidationError,
    validateName
} = require('../services/utils/requestValidation');
const {
    USER_RESOURCE_LIMITS,
    assertResourceCapacity,
    assertResourceLimit,
    sendResourceQuotaError
} = require('../services/utils/resourceQuotas');

// ==================== Authenticated Watchlist CRUD ====================

const SHARE_SLUG_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const SHARE_SLUG_BYTES = 16;
const isUniqueConstraintError = (error) => error?.code === 'P2002';

const WATCHLIST_ITEM_RESPONSE_SELECT = {
    symbol: true,
    addedAt: true
};
const WATCHLIST_ITEM_OWNERSHIP_SELECT = { id: true };

const WATCHLIST_RESPONSE_SELECT = {
    id: true,
    name: true,
    createdAt: true,
    updatedAt: true
};

const mapWatchlistItem = (item) => ({
    symbol: item.symbol,
    addedAt: item.addedAt
});

const mapWatchlist = (watchlist) => {
    if (!watchlist) return watchlist;

    return {
        id: watchlist.id,
        name: watchlist.name,
        createdAt: watchlist.createdAt,
        updatedAt: watchlist.updatedAt,
        items: Array.isArray(watchlist.items) ? watchlist.items.map(mapWatchlistItem) : []
    };
};

const generatePublicShareSlug = () => crypto.randomBytes(SHARE_SLUG_BYTES).toString('base64url');

// GET /api/watchlists — list user's watchlists
router.get('/', requireAuth, asyncHandler(async (req, res) => {
    const watchlists = await prisma.watchlist.findMany({
        where: { userId: req.user.userId },
        select: {
            ...WATCHLIST_RESPONSE_SELECT,
            items: {
                select: WATCHLIST_ITEM_RESPONSE_SELECT,
                orderBy: { addedAt: 'desc' }
            }
        },
        orderBy: { createdAt: 'asc' }
    });
    res.json({ success: true, data: watchlists.map(mapWatchlist) });
}));

// POST /api/watchlists — create a new watchlist
router.post('/', requireAuth, asyncHandler(async (req, res) => {
    const nameResult = validateName(req.body.name, 'Watchlist name');
    if (nameResult.error) {
        return sendValidationError(res, nameResult.error);
    }

    let watchlist;
    try {
        watchlist = await prisma.$transaction(async (tx) => {
            const watchlistCount = await tx.watchlist.count({ where: { userId: req.user.userId } });
            assertResourceLimit({
                count: watchlistCount,
                limit: USER_RESOURCE_LIMITS.watchlists,
                label: 'Watchlist'
            });

            return tx.watchlist.create({
                data: { name: nameResult.value, userId: req.user.userId },
                select: {
                    ...WATCHLIST_RESPONSE_SELECT,
                    items: { select: WATCHLIST_ITEM_RESPONSE_SELECT }
                }
            });
        });
    } catch (error) {
        if (sendResourceQuotaError(res, error)) return;
        throw error;
    }
    res.status(201).json({ success: true, data: mapWatchlist(watchlist) });
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
    const result = await prisma.watchlist.updateMany({
        where: { id, userId: req.user.userId },
        data: { name: nameResult.value }
    });
    if (result.count !== 1) {
        return res.status(404).json({ success: false, error: { message: 'Watchlist not found' } });
    }

    const updated = await prisma.watchlist.findFirst({
        where: { id, userId: req.user.userId },
        select: {
            ...WATCHLIST_RESPONSE_SELECT,
            items: {
                select: WATCHLIST_ITEM_RESPONSE_SELECT,
                orderBy: { addedAt: 'desc' }
            }
        }
    });
    res.json({ success: true, data: mapWatchlist(updated) });
}));

// DELETE /api/watchlists/:id — delete a watchlist
router.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
    const idResult = parsePositiveInteger(req.params.id, 'Watchlist ID');
    if (idResult.error) {
        return sendValidationError(res, idResult.error);
    }

    const id = idResult.value;
    const result = await prisma.watchlist.deleteMany({ where: { id, userId: req.user.userId } });
    if (result.count !== 1) {
        return res.status(404).json({ success: false, error: { message: 'Watchlist not found' } });
    }
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
    let item;
    try {
        item = await prisma.$transaction(async (tx) => {
            const watchlist = await tx.watchlist.findFirst({
                where: { id: watchlistId, userId: req.user.userId },
                select: { id: true }
            });
            if (!watchlist) {
                return null;
            }

            const existing = await tx.watchlistItem.findUnique({
                where: { watchlistId_symbol: { watchlistId, symbol } },
                select: WATCHLIST_ITEM_OWNERSHIP_SELECT
            });
            if (existing) {
                return { duplicate: true };
            }

            const itemCount = await tx.watchlistItem.count({ where: { watchlistId } });
            assertResourceLimit({
                count: itemCount,
                limit: USER_RESOURCE_LIMITS.watchlistItems,
                label: 'Watchlist item'
            });

            return tx.watchlistItem.create({
                data: { watchlistId, symbol },
                select: WATCHLIST_ITEM_RESPONSE_SELECT
            });
        });
    } catch (error) {
        if (sendResourceQuotaError(res, error)) return;
        throw error;
    }
    if (!item) {
        return res.status(404).json({ success: false, error: { message: 'Watchlist not found' } });
    }
    if (item.duplicate) {
        return res.status(409).json({ success: false, error: { message: 'Symbol already in watchlist' } });
    }
    res.status(201).json({ success: true, data: mapWatchlistItem(item) });
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
    const watchlist = await prisma.watchlist.findFirst({
        where: { id: watchlistId, userId: req.user.userId },
        select: { id: true }
    });
    if (!watchlist) {
        return res.status(404).json({ success: false, error: { message: 'Watchlist not found' } });
    }

    const item = await prisma.watchlistItem.findUnique({
        where: { watchlistId_symbol: { watchlistId, symbol } },
        select: WATCHLIST_ITEM_OWNERSHIP_SELECT
    });
    if (!item) {
        return res.status(404).json({ success: false, error: { message: 'Symbol not in watchlist' } });
    }

    const result = await prisma.watchlistItem.deleteMany({
        where: {
            id: item.id,
            watchlistId,
            watchlist: { is: { userId: req.user.userId } }
        }
    });
    if (result.count !== 1) {
        return res.status(404).json({ success: false, error: { message: 'Symbol not in watchlist' } });
    }
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
    let outcome;
    try {
        outcome = await prisma.$transaction(async (tx) => {
            const watchlist = await tx.watchlist.findFirst({
                where: { id: watchlistId, userId: req.user.userId },
                select: { id: true }
            });
            if (!watchlist) {
                return null;
            }

            const existingItems = await tx.watchlistItem.findMany({
                where: { watchlistId },
                select: { symbol: true }
            });
            const existingSymbols = new Set(existingItems.map(item => item.symbol));
            const newSymbols = symbolsResult.value.filter(symbol => !existingSymbols.has(symbol));
            assertResourceCapacity({
                currentCount: existingItems.length,
                requestedCount: newSymbols.length,
                limit: USER_RESOURCE_LIMITS.watchlistItems,
                label: 'Watchlist item'
            });

            const results = { added: 0, skipped: 0 };
            for (const symbol of symbolsResult.value) {
                try {
                    await tx.watchlistItem.create({
                        data: { watchlistId, symbol },
                        select: WATCHLIST_ITEM_OWNERSHIP_SELECT
                    });
                    results.added++;
                } catch (error) {
                    if (!isUniqueConstraintError(error)) {
                        throw error;
                    }
                    results.skipped++;
                }
            }

            const updated = await tx.watchlist.findUnique({
                where: { id: watchlistId },
                select: {
                    ...WATCHLIST_RESPONSE_SELECT,
                    items: {
                        select: WATCHLIST_ITEM_RESPONSE_SELECT,
                        orderBy: { addedAt: 'desc' }
                    }
                }
            });

            return { updated, results };
        });
    } catch (error) {
        if (sendResourceQuotaError(res, error)) return;
        throw error;
    }

    if (!outcome) {
        return res.status(404).json({ success: false, error: { message: 'Watchlist not found' } });
    }

    res.json({ success: true, data: mapWatchlist(outcome.updated), meta: outcome.results });
}));

// ==================== Shared/Public Watchlist ====================

// GET /api/watchlists/shared/:slug — view a public watchlist (no auth required)
router.get('/shared/:slug', shareLookupLimiter, asyncHandler(async (req, res) => {
    const { slug } = req.params;
    if (!SHARE_SLUG_PATTERN.test(slug)) {
        return res.status(400).json({ success: false, error: { message: 'Invalid share slug' } });
    }

    const watchlist = await prisma.watchlist.findUnique({
        where: { publicSlug: slug },
        select: {
            name: true,
            createdAt: true,
            items: {
                select: WATCHLIST_ITEM_RESPONSE_SELECT,
                orderBy: { addedAt: 'desc' }
            },
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
            items: watchlist.items.map(mapWatchlistItem),
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
    const watchlist = await prisma.watchlist.findFirst({
        where: { id, userId: req.user.userId },
        select: { publicSlug: true }
    });
    if (!watchlist) {
        return res.status(404).json({ success: false, error: { message: 'Watchlist not found' } });
    }

    // Generate slug if not already shared
    let slug = watchlist.publicSlug;
    if (!slug) {
        slug = generatePublicShareSlug();
        const result = await prisma.watchlist.updateMany({
            where: { id, userId: req.user.userId },
            data: { publicSlug: slug }
        });
        if (result.count !== 1) {
            return res.status(404).json({ success: false, error: { message: 'Watchlist not found' } });
        }
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
    const watchlist = await prisma.watchlist.findFirst({
        where: { id, userId: req.user.userId },
        select: { id: true }
    });
    if (!watchlist) {
        return res.status(404).json({ success: false, error: { message: 'Watchlist not found' } });
    }

    const result = await prisma.watchlist.updateMany({
        where: { id, userId: req.user.userId },
        data: { publicSlug: null }
    });
    if (result.count !== 1) {
        return res.status(404).json({ success: false, error: { message: 'Watchlist not found' } });
    }
    res.json({ success: true, data: { message: 'Watchlist is now private' } });
}));

module.exports = router;
