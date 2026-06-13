const express = require('express');
const request = require('supertest');
const { errorHandler } = require('../../src/middleware/errorHandler');

const mockPrisma = {
    alert: {
        count: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn()
    },
    portfolio: {
        count: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn()
    },
    stock: {
        findMany: jest.fn()
    },
    trade: {
        count: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
        findFirst: jest.fn()
    },
    watchlist: {
        count: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn()
    },
    watchlistItem: {
        count: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn()
    },
    $transaction: jest.fn()
};

jest.mock('../../src/services/database/connection', () => ({
    prisma: mockPrisma
}));

jest.mock('../../src/middleware/authMiddleware', () => ({
    requireAuth: (req, res, next) => {
        req.user = { userId: 1, email: 'tester@example.com', role: 'user' };
        next();
    }
}));

jest.mock('../../src/services/portfolioCalculator', () => ({
    calculatePortfolioPnL: jest.fn().mockResolvedValue({ holdings: [], summary: {} })
}));

jest.mock('../../src/services/utils/logger', () => ({
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
}));

const app = express();
app.use(express.json());
app.use('/api/alerts', require('../../src/routes/alerts'));
app.use('/api/portfolios', require('../../src/routes/portfolios'));
app.use('/api/watchlists', require('../../src/routes/watchlists'));
app.use(errorHandler);

const portfolioCalculator = require('../../src/services/portfolioCalculator');
const { shareLookupLimiter } = require('../../src/middleware/rateLimiter');

describe('authenticated user route validation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        shareLookupLimiter.resetKey('::ffff:127.0.0.1');
        shareLookupLimiter.resetKey('127.0.0.1');
        mockPrisma.alert.count.mockResolvedValue(0);
        mockPrisma.portfolio.count.mockResolvedValue(0);
        mockPrisma.trade.count.mockResolvedValue(0);
        mockPrisma.watchlist.count.mockResolvedValue(0);
        mockPrisma.watchlistItem.count.mockResolvedValue(0);
        mockPrisma.watchlistItem.findMany.mockResolvedValue([]);
        mockPrisma.alert.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.alert.deleteMany.mockResolvedValue({ count: 1 });
        mockPrisma.portfolio.deleteMany.mockResolvedValue({ count: 1 });
        mockPrisma.trade.deleteMany.mockResolvedValue({ count: 1 });
        mockPrisma.watchlist.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.watchlist.deleteMany.mockResolvedValue({ count: 1 });
        mockPrisma.watchlistItem.deleteMany.mockResolvedValue({ count: 1 });
        mockPrisma.$transaction.mockImplementation((operation) => operation(mockPrisma));
    });

    it('rejects malformed watchlist symbols before database lookup', async () => {
        const res = await request(app)
            .post('/api/watchlists/1/items')
            .send({ symbol: '../../secrets' })
            .expect(400);

        expect(res.body.error.message).toContain('Symbol must');
        expect(mockPrisma.watchlist.findFirst).not.toHaveBeenCalled();
        expect(mockPrisma.watchlistItem.create).not.toHaveBeenCalled();
    });

    it('limits bulk watchlist imports before database lookup', async () => {
        const symbols = Array.from({ length: 201 }, (_, index) => `SYM${index}`);

        const res = await request(app)
            .post('/api/watchlists/1/import')
            .send({ symbols })
            .expect(400);

        expect(res.body.error.message).toContain('200 items or less');
        expect(mockPrisma.watchlist.findFirst).not.toHaveBeenCalled();
        expect(mockPrisma.watchlistItem.create).not.toHaveBeenCalled();
    });

    it('deduplicates normalized watchlist imports', async () => {
        mockPrisma.watchlist.findFirst.mockResolvedValue({ id: 1, userId: 1 });
        mockPrisma.watchlist.findUnique.mockResolvedValue({ id: 1, items: [] });
        mockPrisma.watchlistItem.findMany.mockResolvedValue([]);
        mockPrisma.watchlistItem.create.mockResolvedValue({});

        const res = await request(app)
            .post('/api/watchlists/1/import')
            .send({ symbols: ['nabil', 'NABIL', 'EBL'] })
            .expect(200);

        expect(res.body.success).toBe(true);
        expect(mockPrisma.watchlistItem.create).toHaveBeenCalledTimes(2);
        expect(mockPrisma.watchlistItem.create).toHaveBeenCalledWith({
            data: { watchlistId: 1, symbol: 'NABIL' }
        });
        expect(mockPrisma.watchlistItem.create).toHaveBeenCalledWith({
            data: { watchlistId: 1, symbol: 'EBL' }
        });
        expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('does not hide unexpected watchlist import write failures as duplicate skips', async () => {
        mockPrisma.watchlist.findFirst.mockResolvedValue({ id: 1, userId: 1 });
        mockPrisma.watchlistItem.findMany.mockResolvedValue([]);
        mockPrisma.watchlistItem.create.mockRejectedValue(new Error('database unavailable'));

        const res = await request(app)
            .post('/api/watchlists/1/import')
            .send({ symbols: ['NABIL'] })
            .expect(500);

        expect(res.body.error.message).toBe('Internal Server Error');
        expect(mockPrisma.watchlist.findUnique).not.toHaveBeenCalled();
        expect(mockPrisma.watchlistItem.create).toHaveBeenCalledTimes(1);
    });

    it('counts watchlist import unique collisions as duplicate skips', async () => {
        mockPrisma.watchlist.findFirst.mockResolvedValue({ id: 1, userId: 1 });
        mockPrisma.watchlist.findUnique.mockResolvedValue({ id: 1, items: [] });
        mockPrisma.watchlistItem.findMany.mockResolvedValue([]);
        mockPrisma.watchlistItem.create.mockRejectedValueOnce({ code: 'P2002' });
        mockPrisma.watchlistItem.create.mockResolvedValueOnce({});

        const res = await request(app)
            .post('/api/watchlists/1/import')
            .send({ symbols: ['NABIL', 'EBL'] })
            .expect(200);

        expect(res.body.meta).toEqual({ added: 1, skipped: 1 });
        expect(mockPrisma.watchlistItem.create).toHaveBeenCalledTimes(2);
    });

    it('rejects watchlist creation after the per-user quota is reached', async () => {
        mockPrisma.watchlist.count.mockResolvedValue(25);

        const res = await request(app)
            .post('/api/watchlists')
            .send({ name: 'Overflow' })
            .expect(409);

        expect(res.body.error.message).toContain('Watchlist limit');
        expect(mockPrisma.watchlist.create).not.toHaveBeenCalled();
        expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('rejects watchlist item creation after the per-list quota is reached', async () => {
        mockPrisma.watchlist.findFirst.mockResolvedValue({ id: 1, userId: 1 });
        mockPrisma.watchlistItem.findUnique.mockResolvedValue(null);
        mockPrisma.watchlistItem.count.mockResolvedValue(250);

        const res = await request(app)
            .post('/api/watchlists/1/items')
            .send({ symbol: 'NABIL' })
            .expect(409);

        expect(res.body.error.message).toContain('Watchlist item limit');
        expect(mockPrisma.watchlistItem.create).not.toHaveBeenCalled();
        expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('rejects watchlist imports that would exceed the per-list quota', async () => {
        mockPrisma.watchlist.findFirst.mockResolvedValue({ id: 1, userId: 1 });
        mockPrisma.watchlistItem.findMany.mockResolvedValue(
            Array.from({ length: 249 }, (_, index) => ({ symbol: `OLD${index}` }))
        );

        const res = await request(app)
            .post('/api/watchlists/1/import')
            .send({ symbols: ['NABIL', 'EBL'] })
            .expect(409);

        expect(res.body.error.message).toContain('Watchlist item limit');
        expect(mockPrisma.watchlistItem.create).not.toHaveBeenCalled();
        expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('rejects malformed public share slugs before database lookup', async () => {
        const res = await request(app)
            .get('/api/watchlists/shared/..%2Fsecret')
            .expect(400);

        expect(res.body.error.message).toContain('Invalid share slug');
        expect(mockPrisma.watchlist.findUnique).not.toHaveBeenCalled();
    });

    it('redacts internal IDs from public shared watchlists', async () => {
        mockPrisma.watchlist.findUnique.mockResolvedValue({
            id: 9,
            name: 'Public list',
            createdAt: new Date('2026-06-06T00:00:00Z'),
            user: { displayName: 'Owner' },
            items: [
                { id: 100, watchlistId: 9, symbol: 'NABIL', addedAt: new Date('2026-06-06T00:00:00Z') }
            ]
        });

        const res = await request(app)
            .get('/api/watchlists/shared/abcDEF12')
            .expect(200);

        expect(res.body.data.items).toEqual([
            { symbol: 'NABIL', addedAt: '2026-06-06T00:00:00.000Z' }
        ]);
        expect(JSON.stringify(res.body)).not.toContain('watchlistId');
    });

    it('generates high-entropy public share slugs for new shared watchlists', async () => {
        mockPrisma.watchlist.findFirst.mockResolvedValue({ id: 1, userId: 1, publicSlug: null });
        mockPrisma.watchlist.updateMany.mockResolvedValue({ count: 1 });

        const res = await request(app)
            .post('/api/watchlists/1/share')
            .send({})
            .expect(200);

        const slug = res.body.data.publicSlug;
        expect(slug).toMatch(/^[A-Za-z0-9_-]{22}$/);
        expect(res.body.data.shareUrl).toBe(`/w/${slug}`);
        expect(mockPrisma.watchlist.updateMany).toHaveBeenCalledWith({
            where: { id: 1, userId: 1 },
            data: { publicSlug: slug }
        });
    });

    it('returns 404 when public sharing affects no owned watchlist row', async () => {
        mockPrisma.watchlist.findFirst.mockResolvedValue({ id: 1, userId: 1, publicSlug: null });
        mockPrisma.watchlist.updateMany.mockResolvedValue({ count: 0 });

        const res = await request(app)
            .post('/api/watchlists/1/share')
            .send({})
            .expect(404);

        expect(res.body.error.message).toBe('Watchlist not found');
        expect(mockPrisma.watchlist.updateMany).toHaveBeenCalledWith({
            where: { id: 1, userId: 1 },
            data: { publicSlug: expect.stringMatching(/^[A-Za-z0-9_-]{22}$/) }
        });
    });

    it('renames watchlists with an owner-bound write', async () => {
        mockPrisma.watchlist.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.watchlist.findFirst.mockResolvedValue({ id: 1, userId: 1, name: 'Renamed', items: [] });

        const res = await request(app)
            .put('/api/watchlists/1')
            .send({ name: 'Renamed' })
            .expect(200);

        expect(res.body.data.name).toBe('Renamed');
        expect(mockPrisma.watchlist.updateMany).toHaveBeenCalledWith({
            where: { id: 1, userId: 1 },
            data: { name: 'Renamed' }
        });
    });

    it('returns 404 when a watchlist owner-bound write affects no rows', async () => {
        mockPrisma.watchlist.updateMany.mockResolvedValue({ count: 0 });

        const res = await request(app)
            .put('/api/watchlists/1')
            .send({ name: 'Renamed' })
            .expect(404);

        expect(res.body.error.message).toBe('Watchlist not found');
        expect(mockPrisma.watchlist.findFirst).not.toHaveBeenCalled();
        expect(mockPrisma.watchlist.update).not.toHaveBeenCalled();
    });

    it('deletes watchlists with an owner-bound delete', async () => {
        mockPrisma.watchlist.deleteMany.mockResolvedValue({ count: 1 });

        await request(app)
            .delete('/api/watchlists/1')
            .expect(200);

        expect(mockPrisma.watchlist.deleteMany).toHaveBeenCalledWith({
            where: { id: 1, userId: 1 }
        });
        expect(mockPrisma.watchlist.delete).not.toHaveBeenCalled();
    });

    it('returns 404 when a watchlist owner-bound delete affects no rows', async () => {
        mockPrisma.watchlist.deleteMany.mockResolvedValue({ count: 0 });

        const res = await request(app)
            .delete('/api/watchlists/1')
            .expect(404);

        expect(res.body.error.message).toBe('Watchlist not found');
        expect(mockPrisma.watchlist.delete).not.toHaveBeenCalled();
    });

    it('deletes watchlist items with a watchlist owner-bound delete', async () => {
        mockPrisma.watchlist.findFirst.mockResolvedValue({ id: 1, userId: 1 });
        mockPrisma.watchlistItem.findUnique.mockResolvedValue({ id: 7, watchlistId: 1, symbol: 'NABIL' });
        mockPrisma.watchlistItem.deleteMany.mockResolvedValue({ count: 1 });

        await request(app)
            .delete('/api/watchlists/1/items/NABIL')
            .expect(200);

        expect(mockPrisma.watchlistItem.deleteMany).toHaveBeenCalledWith({
            where: {
                id: 7,
                watchlistId: 1,
                watchlist: { is: { userId: 1 } }
            }
        });
        expect(mockPrisma.watchlistItem.delete).not.toHaveBeenCalled();
    });

    it('returns 404 when a watchlist item owner-bound delete affects no rows', async () => {
        mockPrisma.watchlist.findFirst.mockResolvedValue({ id: 1, userId: 1 });
        mockPrisma.watchlistItem.findUnique.mockResolvedValue({ id: 7, watchlistId: 1, symbol: 'NABIL' });
        mockPrisma.watchlistItem.deleteMany.mockResolvedValue({ count: 0 });

        const res = await request(app)
            .delete('/api/watchlists/1/items/NABIL')
            .expect(404);

        expect(res.body.error.message).toBe('Symbol not in watchlist');
        expect(mockPrisma.watchlistItem.delete).not.toHaveBeenCalled();
    });

    it('unshares watchlists with an owner-bound write', async () => {
        mockPrisma.watchlist.findFirst.mockResolvedValue({ id: 1, userId: 1, publicSlug: 'sharedSlug' });
        mockPrisma.watchlist.updateMany.mockResolvedValue({ count: 1 });

        await request(app)
            .post('/api/watchlists/1/unshare')
            .send({})
            .expect(200);

        expect(mockPrisma.watchlist.updateMany).toHaveBeenCalledWith({
            where: { id: 1, userId: 1 },
            data: { publicSlug: null }
        });
    });

    it('returns 404 when unsharing affects no owned watchlist row', async () => {
        mockPrisma.watchlist.findFirst.mockResolvedValue({ id: 1, userId: 1, publicSlug: 'sharedSlug' });
        mockPrisma.watchlist.updateMany.mockResolvedValue({ count: 0 });

        const res = await request(app)
            .post('/api/watchlists/1/unshare')
            .send({})
            .expect(404);

        expect(res.body.error.message).toBe('Watchlist not found');
    });

    it('rate limits repeated unauthenticated public share lookups', async () => {
        mockPrisma.watchlist.findUnique.mockResolvedValue(null);

        for (let i = 0; i < 60; i++) {
            await request(app)
                .get(`/api/watchlists/shared/guess${String(i).padStart(3, '0')}`)
                .expect(404);
        }

        const res = await request(app)
            .get('/api/watchlists/shared/guess999')
            .expect(429);

        expect(res.body.error.message).toContain('Too many shared watchlist lookups');
    });

    it('rejects invalid portfolio trade numbers before database lookup', async () => {
        const res = await request(app)
            .post('/api/portfolios/1/trades')
            .send({
                symbol: 'NABIL',
                type: 'buy',
                quantity: -10,
                price: 100,
                date: '2026-06-06'
            })
            .expect(400);

        expect(res.body.error.message).toContain('Quantity');
        expect(mockPrisma.portfolio.findFirst).not.toHaveBeenCalled();
        expect(mockPrisma.trade.create).not.toHaveBeenCalled();
    });

    it('rejects numeric type confusion before portfolio trade lookup', async () => {
        const res = await request(app)
            .post('/api/portfolios/1/trades')
            .send({
                symbol: 'NABIL',
                type: 'buy',
                quantity: true,
                price: [100],
                date: '2026-06-06'
            })
            .expect(400);

        expect(res.body.error.message).toContain('Quantity');
        expect(mockPrisma.portfolio.findFirst).not.toHaveBeenCalled();
        expect(mockPrisma.trade.create).not.toHaveBeenCalled();
    });

    it('rejects impossible portfolio trade calendar dates before database lookup', async () => {
        const res = await request(app)
            .post('/api/portfolios/1/trades')
            .send({
                symbol: 'NABIL',
                type: 'buy',
                quantity: 10,
                price: 100,
                date: '2026-02-31'
            })
            .expect(400);

        expect(res.body.error.message).toContain('Date');
        expect(mockPrisma.portfolio.findFirst).not.toHaveBeenCalled();
        expect(mockPrisma.trade.create).not.toHaveBeenCalled();
    });

    it('rejects overlarge integer IDs before database lookup', async () => {
        const res = await request(app)
            .post('/api/watchlists/999999999999999999/items')
            .send({ symbol: 'NABIL' })
            .expect(400);

        expect(res.body.error.message).toContain('Watchlist ID');
        expect(mockPrisma.watchlist.findFirst).not.toHaveBeenCalled();
    });

    it('normalizes valid portfolio trade writes', async () => {
        mockPrisma.portfolio.findFirst.mockResolvedValue({ id: 1, userId: 1 });
        mockPrisma.trade.create.mockImplementation(({ data }) => Promise.resolve({ id: 10, ...data }));

        const res = await request(app)
            .post('/api/portfolios/1/trades')
            .send({
                symbol: 'nabil',
                type: 'buy',
                quantity: '10',
                price: '123.45',
                date: '2026-06-06',
                note: ' test note '
            })
            .expect(201);

        expect(res.body.data.symbol).toBe('NABIL');
        expect(mockPrisma.trade.create).toHaveBeenCalledWith({
            data: {
                portfolioId: 1,
                symbol: 'NABIL',
                type: 'buy',
                quantity: 10,
                price: 123.45,
                date: expect.any(Date),
                note: 'test note'
            }
        });
        expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('rejects portfolio creation after the per-user quota is reached', async () => {
        mockPrisma.portfolio.count.mockResolvedValue(25);

        const res = await request(app)
            .post('/api/portfolios')
            .send({ name: 'Overflow' })
            .expect(409);

        expect(res.body.error.message).toContain('Portfolio limit');
        expect(mockPrisma.portfolio.create).not.toHaveBeenCalled();
        expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('rejects trade creation after the per-portfolio quota is reached', async () => {
        mockPrisma.portfolio.findFirst.mockResolvedValue({ id: 1, userId: 1 });
        mockPrisma.trade.count.mockResolvedValue(500);

        const res = await request(app)
            .post('/api/portfolios/1/trades')
            .send({
                symbol: 'NABIL',
                type: 'buy',
                quantity: 10,
                price: 123.45,
                date: '2026-06-06'
            })
            .expect(409);

        expect(res.body.error.message).toContain('Portfolio trade limit');
        expect(mockPrisma.trade.create).not.toHaveBeenCalled();
        expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('checks portfolio ownership before running summary calculations', async () => {
        mockPrisma.portfolio.findFirst.mockResolvedValue(null);

        const res = await request(app)
            .get('/api/portfolios/99/summary')
            .expect(404);

        expect(res.body.error.message).toBe('Portfolio not found');
        expect(portfolioCalculator.calculatePortfolioPnL).not.toHaveBeenCalled();
    });

    it('deletes portfolios with an owner-bound delete', async () => {
        mockPrisma.portfolio.deleteMany.mockResolvedValue({ count: 1 });

        await request(app)
            .delete('/api/portfolios/1')
            .expect(200);

        expect(mockPrisma.portfolio.deleteMany).toHaveBeenCalledWith({
            where: { id: 1, userId: 1 }
        });
        expect(mockPrisma.portfolio.delete).not.toHaveBeenCalled();
    });

    it('returns 404 when a portfolio owner-bound delete affects no rows', async () => {
        mockPrisma.portfolio.deleteMany.mockResolvedValue({ count: 0 });

        const res = await request(app)
            .delete('/api/portfolios/1')
            .expect(404);

        expect(res.body.error.message).toBe('Portfolio not found');
        expect(mockPrisma.portfolio.delete).not.toHaveBeenCalled();
    });

    it('deletes trades with a portfolio owner-bound delete', async () => {
        mockPrisma.portfolio.findFirst.mockResolvedValue({ id: 1, userId: 1 });
        mockPrisma.trade.findFirst.mockResolvedValue({ id: 5, portfolioId: 1 });
        mockPrisma.trade.deleteMany.mockResolvedValue({ count: 1 });

        await request(app)
            .delete('/api/portfolios/1/trades/5')
            .expect(200);

        expect(mockPrisma.trade.deleteMany).toHaveBeenCalledWith({
            where: {
                id: 5,
                portfolioId: 1,
                portfolio: { is: { userId: 1 } }
            }
        });
        expect(mockPrisma.trade.delete).not.toHaveBeenCalled();
    });

    it('returns 404 when a trade owner-bound delete affects no rows', async () => {
        mockPrisma.portfolio.findFirst.mockResolvedValue({ id: 1, userId: 1 });
        mockPrisma.trade.findFirst.mockResolvedValue({ id: 5, portfolioId: 1 });
        mockPrisma.trade.deleteMany.mockResolvedValue({ count: 0 });

        const res = await request(app)
            .delete('/api/portfolios/1/trades/5')
            .expect(404);

        expect(res.body.error.message).toBe('Trade not found');
        expect(mockPrisma.trade.delete).not.toHaveBeenCalled();
    });

    it('rejects string booleans on alert updates instead of coercing them', async () => {
        const res = await request(app)
            .put('/api/alerts/1')
            .send({ enabled: 'false' })
            .expect(400);

        expect(res.body.error.message).toContain('boolean');
        expect(mockPrisma.alert.findFirst).not.toHaveBeenCalled();
        expect(mockPrisma.alert.update).not.toHaveBeenCalled();
    });

    it('rejects no-op alert updates before database lookup', async () => {
        const res = await request(app)
            .put('/api/alerts/1')
            .send({ symbol: 'NABIL' })
            .expect(400);

        expect(res.body.error.message).toContain('At least one');
        expect(mockPrisma.alert.updateMany).not.toHaveBeenCalled();
        expect(mockPrisma.alert.findFirst).not.toHaveBeenCalled();
    });

    it('rejects array thresholds before alert lookup', async () => {
        const res = await request(app)
            .post('/api/alerts')
            .send({ symbol: 'NABIL', condition: 'above', threshold: [100] })
            .expect(400);

        expect(res.body.error.message).toContain('Threshold');
        expect(mockPrisma.alert.create).not.toHaveBeenCalled();
    });

    it('rejects alert creation after the per-user quota is reached', async () => {
        mockPrisma.alert.count.mockResolvedValue(100);

        const res = await request(app)
            .post('/api/alerts')
            .send({ symbol: 'NABIL', condition: 'above', threshold: 100 })
            .expect(409);

        expect(res.body.error.message).toContain('Alert limit');
        expect(mockPrisma.alert.create).not.toHaveBeenCalled();
        expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('updates alerts with an owner-bound write', async () => {
        mockPrisma.alert.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.alert.findFirst.mockResolvedValue({ id: 1, userId: 1, enabled: false });

        const res = await request(app)
            .put('/api/alerts/1')
            .send({ enabled: false })
            .expect(200);

        expect(res.body.data.enabled).toBe(false);
        expect(mockPrisma.alert.updateMany).toHaveBeenCalledWith({
            where: { id: 1, userId: 1 },
            data: { enabled: false }
        });
        expect(mockPrisma.alert.update).not.toHaveBeenCalled();
    });

    it('returns 404 when an alert owner-bound write affects no rows', async () => {
        mockPrisma.alert.updateMany.mockResolvedValue({ count: 0 });

        const res = await request(app)
            .put('/api/alerts/1')
            .send({ enabled: false })
            .expect(404);

        expect(res.body.error.message).toBe('Alert not found');
        expect(mockPrisma.alert.findFirst).not.toHaveBeenCalled();
        expect(mockPrisma.alert.update).not.toHaveBeenCalled();
    });

    it('deletes alerts with an owner-bound delete', async () => {
        mockPrisma.alert.deleteMany.mockResolvedValue({ count: 1 });

        await request(app)
            .delete('/api/alerts/1')
            .expect(200);

        expect(mockPrisma.alert.deleteMany).toHaveBeenCalledWith({
            where: { id: 1, userId: 1 }
        });
        expect(mockPrisma.alert.delete).not.toHaveBeenCalled();
    });

    it('returns 404 when an alert owner-bound delete affects no rows', async () => {
        mockPrisma.alert.deleteMany.mockResolvedValue({ count: 0 });

        const res = await request(app)
            .delete('/api/alerts/1')
            .expect(404);

        expect(res.body.error.message).toBe('Alert not found');
        expect(mockPrisma.alert.delete).not.toHaveBeenCalled();
    });
});
