const request = require('supertest');
const express = require('express');

// Mock dependencies to prevent side effects
jest.mock('../src/services/database/connection', () => ({
    connectDB: jest.fn(),
    disconnectDB: jest.fn()
}));

jest.mock('../src/services/scheduler/updateScheduler', () => ({
    startScheduler: jest.fn(),
    stopScheduler: jest.fn()
}));

jest.mock('../src/services/scheduler', () => ({
    initScheduler: jest.fn()
}));

// Mock routers to avoid deep dependency issues
const mockRouter = express.Router();
mockRouter.get('/', (req, res) => res.json({ success: true }));

jest.mock('../src/routes/stocks', () => mockRouter);
jest.mock('../src/routes/ipos', () => mockRouter);
jest.mock('../src/routes/market', () => mockRouter);
jest.mock('../src/routes/watchdog', () => mockRouter);

// Import the app
const app = require('../src/server');

describe('Security Headers', () => {
    it('should have Content-Security-Policy header', async () => {
        const res = await request(app).get('/api/stocks');
        expect(res.headers['content-security-policy']).toBeDefined();
    });

    it('should have RateLimit headers', async () => {
        const res = await request(app).get('/api/stocks');
        // express-rate-limit sets X-RateLimit-* or RateLimit-* headers
        // Note: globalLimiter is configured with standardHeaders: true (Draft-6/7)
        // which returns RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset
        const hasRateLimit =
            res.headers['ratelimit-limit'] ||
            res.headers['x-ratelimit-limit'];

        expect(hasRateLimit).toBeDefined();
    });
});
