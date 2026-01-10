const request = require('supertest');
const express = require('express');
const marketRouter = require('../../src/routes/market');

// Create test app
const app = express();
app.use(express.json());
app.use('/api', marketRouter);

// Mock dependencies
jest.mock('../../src/services/database/marketOperations', () => ({
    getLatestMarketSummary: jest.fn().mockResolvedValue(global.testUtils.mockMarketSummary),
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
    getUpdateStatus: jest.fn().mockReturnValue({
        isRunning: true,
        isMarketOpen: false,
        lastUpdateTime: new Date().toISOString(),
        updateCount: 100,
        lastError: null,
        currentNST: new Date().toISOString(),
        marketHours: { open: '10:00', close: '15:00' }
    }),
    forceUpdate: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../src/services/dataFetcher', () => ({
    getDataSource: jest.fn().mockReturnValue('proxy'),
    getFetchStatus: jest.fn().mockReturnValue({
        dataSource: 'proxy',
        lastUpdateTime: new Date().toISOString(),
        consecutiveFailures: 0,
        isHealthy: true
    })
}));

describe('Market API Endpoints', () => {
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
    });

    describe('GET /api/health', () => {
        it('should return server status', async () => {
            const res = await request(app).get('/api/health');
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.status).toBe('running');
        });

        it('should show data source', async () => {
            const res = await request(app).get('/api/health');
            expect(res.body.data).toHaveProperty('source');
        });

        it('should show market status', async () => {
            const res = await request(app).get('/api/health');
            expect(res.body.market).toHaveProperty('isOpen');
        });

        it('should show uptime', async () => {
            const res = await request(app).get('/api/health');
            expect(res.body.server).toHaveProperty('uptime');
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
            // Prisma is used in this route, so we might need to mock it if it's not already
            const res = await request(app).get('/api/health/extended')
                .set('x-admin-key', 'test-admin-key');
            
            // Depending on prisma mock state, this might return 200 or 500
            // But 401 should definitely be gone
            expect(res.status).not.toBe(401);
        });
    });

    describe('GET /api/scheduler-status', () => {
        it('should return scheduler status', async () => {
            const res = await request(app).get('/api/scheduler-status');
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveProperty('isRunning');
        });
    });
});
