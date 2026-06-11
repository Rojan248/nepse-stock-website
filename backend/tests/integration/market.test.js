const request = require('supertest');
const express = require('express');
const crypto = require('crypto');
const marketRouter = require('../../src/routes/market');
const marketOperations = require('../../src/services/database/marketOperations');
const scheduler = require('../../src/services/scheduler/updateScheduler');

// Create test app
const app = express();
app.use(express.json());
app.use('/api', marketRouter);

// Mock dependencies
jest.mock('../../src/services/database/marketOperations', () => ({
    getLatestMarketSummary: jest.fn().mockResolvedValue(global.testUtils.mockMarketSummary),
    getCumulativeMarketChanges: jest.fn().mockResolvedValue({'1W': 1.5, '1M': -2.1}),
    getMarketSummaryHistory: jest.fn().mockResolvedValue([global.testUtils.mockMarketSummary]),
    getMarketStats: jest.fn().mockResolvedValue({
        latest: global.testUtils.mockMarketSummary,
        totalRecords: 100,
        hasData: true
    })
}));

jest.mock('../../src/services/database/stockOperations', () => ({
    getStockCount: jest.fn().mockResolvedValue(250),
    getAllSectors: jest.fn().mockResolvedValue(['Banking', 'Insurance'])
}));

jest.mock('../../src/services/scheduler/updateScheduler', () => ({
    getUpdateStatus: jest.fn().mockImplementation(() => ({
        isRunning: true,
        isMarketOpen: false,
        lastUpdateTime: new Date().toISOString(),
        updateCount: 100,
        failureCount: 0,
        consecutiveFailures: 0,
        lastError: null,
        currentNST: new Date().toISOString(),
        marketHours: { open: '10:00', close: '15:00' },
        circuitBreaker: { isOpen: false, consecutiveFailures: 0 },
        alerting: { enabled: false }
    })),
    forceUpdate: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../src/services/dataFetcher', () => ({
    getDataSource: jest.fn().mockReturnValue('proxy'),
    getFetchStatus: jest.fn().mockImplementation(() => ({
        dataSource: 'proxy',
        lastUpdateTime: new Date().toISOString(),
        consecutiveFailures: 0,
        isHealthy: true
    }))
}));

jest.mock('../../src/middleware/rateLimiter', () => ({
    adminLimiter: (req, res, next) => next()
}));

jest.mock('../../src/services/database/connection', () => ({
    prisma: {
        stock: {
            findFirst: jest.fn().mockImplementation(() =>
                Promise.resolve({ updatedAt: new Date() })
            ),
            findMany: jest.fn().mockResolvedValue([]),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            upsert: jest.fn(),
            count: jest.fn().mockResolvedValue(0)
        },
        marketSummary: {
            findFirst: jest.fn(),
            findMany: jest.fn().mockResolvedValue([]),
            create: jest.fn()
        }
    },
    connectDB: jest.fn().mockResolvedValue(true),
    disconnectDB: jest.fn().mockResolvedValue(true),
    isConnected: jest.fn().mockReturnValue(true)
}));

describe('Market API Endpoints', () => {
    const ADMIN_KEY = crypto.randomBytes(32).toString('hex');
    const originalAdminKey = process.env.ADMIN_API_KEY;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    beforeAll(() => {
        process.env.ADMIN_API_KEY = ADMIN_KEY;
    });

    afterAll(() => {
        if (originalAdminKey === undefined) {
            delete process.env.ADMIN_API_KEY;
        } else {
            process.env.ADMIN_API_KEY = originalAdminKey;
        }
    });

    describe('GET /api/market-summary', () => {
        it('should return market summary', async () => {
            const res = await request(app).get('/api/market-summary');
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('indexValue');
        });

        it('should have all required fields', async () => {
            const res = await request(app).get('/api/market-summary');
            const data = res.body.data;
            expect(data).toHaveProperty('indexValue');
            expect(data).toHaveProperty('indexChange');
            expect(data).toHaveProperty('totalTransactions');
            expect(data).toHaveProperty('totalTurnover');
        });
    });

    describe('GET /api/market-history', () => {
        it('should return market history', async () => {
            const res = await request(app).get('/api/market-history?hours=24');
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
        });

        it('should reject repeated hours parameters before database lookup', async () => {
            const res = await request(app).get('/api/market-history?hours=24&hours=48');
            expect(res.status).toBe(400);
            expect(res.body.error.message).toBe('hours must be a single integer');
            expect(marketOperations.getMarketSummaryHistory).not.toHaveBeenCalled();
        });
    });

    describe('GET /api/health', () => {
        it('should return server status', async () => {
            const res = await request(app).get('/api/health');
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.status).toBe('healthy');
            expect(marketOperations.getMarketStats).not.toHaveBeenCalled();
        });

        it('should show market state', async () => {
            const res = await request(app).get('/api/health');
            expect(res.body.market).toHaveProperty('state');
        });
    });

    describe('GET /api/health/ready', () => {
        it('should avoid exposing raw fetch errors', async () => {
            const res = await request(app).get('/api/health/ready');

            expect(res.status).toBe(200);
            expect(res.body.fetcher).not.toHaveProperty('lastError');
            expect(res.body.fetcher).toHaveProperty('hasError', false);
        });

        it('should allow configured API-only probes when background jobs are disabled', async () => {
            const originalDisable = process.env.DISABLE_BACKGROUND_JOBS;
            try {
                process.env.DISABLE_BACKGROUND_JOBS = 'true';
                scheduler.getUpdateStatus.mockReturnValueOnce({
                    isRunning: false,
                    isMarketOpen: false,
                    lastUpdateTime: null,
                    updateCount: 0,
                    failureCount: 0,
                    consecutiveFailures: 0,
                    lastError: null,
                    currentNST: new Date().toISOString(),
                    marketHours: { open: '10:00', close: '15:00' },
                    circuitBreaker: { isOpen: false, consecutiveFailures: 0 },
                    alerting: { enabled: false }
                });

                const res = await request(app).get('/api/health/ready');

                expect(res.status).toBe(200);
                expect(res.body.warnings).toContain('background jobs are disabled by configuration');
            } finally {
                if (originalDisable === undefined) {
                    delete process.env.DISABLE_BACKGROUND_JOBS;
                } else {
                    process.env.DISABLE_BACKGROUND_JOBS = originalDisable;
                }
            }
        });
    });

    describe('GET /api/health/extended', () => {
        it('should reject requests without admin key', async () => {
            const res = await request(app).get('/api/health/extended');
            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });

        it('should reject requests with invalid admin key', async () => {
            const res = await request(app).get('/api/health/extended')
                .set('x-admin-key', 'wrong-key');
            expect(res.status).toBe(401);
        });

        it('should allow requests with valid admin key', async () => {
            const res = await request(app).get('/api/health/extended')
                .set('x-admin-key', ADMIN_KEY);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    describe('GET /api/scheduler-status', () => {
        it('should reject requests without admin key', async () => {
            const res = await request(app).get('/api/scheduler-status');
            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });

        it('should return scheduler status with valid admin key', async () => {
            const res = await request(app).get('/api/scheduler-status')
                .set('x-admin-key', ADMIN_KEY);
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveProperty('isRunning');
        });
    });

    describe('GET /api/time-sync-status', () => {
        it('should reject requests without admin key', async () => {
            const res = await request(app).get('/api/time-sync-status');
            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });

        it('should return time sync status with valid admin key', async () => {
            const res = await request(app).get('/api/time-sync-status')
                .set('x-admin-key', ADMIN_KEY);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });
});
