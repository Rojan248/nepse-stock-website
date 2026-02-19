const request = require('supertest');

// Mock dependencies BEFORE requiring the app
jest.mock('../../src/services/database/connection', () => ({
    connectDB: jest.fn().mockResolvedValue(true),
    disconnectDB: jest.fn().mockResolvedValue(true),
    prisma: {
        stock: { count: jest.fn().mockResolvedValue(100) },
        marketHistory: { findMany: jest.fn().mockResolvedValue([]) }
    }
}));

jest.mock('../../src/services/scheduler/updateScheduler', () => ({
    startScheduler: jest.fn(),
    stopScheduler: jest.fn(),
    getUpdateStatus: jest.fn().mockReturnValue({ isRunning: true })
}));

jest.mock('../../src/services/scheduler', () => ({
    initScheduler: jest.fn()
}));

jest.mock('../../src/services/analytics', () => ({
    initialize: jest.fn(),
    shutdown: jest.fn()
}));

jest.mock('../../src/services/utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
}));

jest.mock('../../src/services/database/stockOperations', () => ({
    getAllStocks: jest.fn().mockResolvedValue([]),
    getStockCount: jest.fn().mockResolvedValue(0)
}));

// Set PORT to 0 to avoid EADDRINUSE
process.env.PORT = 0;

describe('Security Configuration', () => {
    let app;

    beforeAll(async () => {
        // Load app - this triggers startServer() but with mocks
        jest.isolateModules(() => {
            app = require('../../src/server');
        });
        // Give it a moment to initialize
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should have basic security headers (Helmet)', async () => {
        const res = await request(app).get('/api/health');

        // Check for Helmet headers
        expect(res.headers['x-dns-prefetch-control']).toBeDefined();
        expect(res.headers['x-frame-options']).toBeDefined();
        expect(res.headers['strict-transport-security']).toBeDefined();
        expect(res.headers['x-download-options']).toBeDefined();
        expect(res.headers['x-content-type-options']).toBeDefined();
        expect(res.headers['x-permitted-cross-domain-policies']).toBeDefined();
        expect(res.headers['referrer-policy']).toBeDefined();

        // CSP should be present
        expect(res.headers['content-security-policy']).toBeDefined();

        // X-Powered-By should be hidden
        expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('should have rate limiting headers on non-health endpoints', async () => {
         const res = await request(app).get('/api/stocks');

         // Verify rate limit headers are present
         expect(res.headers['ratelimit-limit']).toBeDefined();
         expect(res.headers['ratelimit-remaining']).toBeDefined();
         expect(res.headers['ratelimit-reset']).toBeDefined();
    });
});
