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
        delete: jest.fn()
    },
    portfolio: {
        count: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
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
        findFirst: jest.fn()
    },
    watchlist: {
        count: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn()
    },
    watchlistItem: {
        count: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
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

describe('authenticated user route validation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockPrisma.alert.count.mockResolvedValue(0);
        mockPrisma.portfolio.count.mockResolvedValue(0);
        mockPrisma.trade.count.mockResolvedValue(0);
        mockPrisma.watchlist.count.mockResolvedValue(0);
        mockPrisma.watchlistItem.count.mockResolvedValue(0);
        mockPrisma.watchlistItem.findMany.mockResolvedValue([]);
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

    it('rejects string booleans on alert updates instead of coercing them', async () => {
        const res = await request(app)
            .put('/api/alerts/1')
            .send({ enabled: 'false' })
            .expect(400);

        expect(res.body.error.message).toContain('boolean');
        expect(mockPrisma.alert.findFirst).not.toHaveBeenCalled();
        expect(mockPrisma.alert.update).not.toHaveBeenCalled();
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
});
