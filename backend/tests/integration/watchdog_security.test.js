const request = require('supertest');
const express = require('express');

// Mock dependencies BEFORE requiring the router
jest.mock('../../src/services/watchdog/WatchdogService', () => ({
    verify: jest.fn().mockResolvedValue({
        status: 'OK',
        discrepancies: [],
        local: { source: 'Local', data: {} },
        external: []
    })
}));

jest.mock('fs', () => ({
    promises: {
        readFile: jest.fn().mockResolvedValue(JSON.stringify([{
            timestamp: new Date(),
            status: 'OK',
            discrepancies: []
        }])),
        writeFile: jest.fn().mockResolvedValue()
    }
}));

// Mock logger to avoid clutter
jest.mock('../../src/services/utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
}));

// Mock rate limiter to avoid 429 during tests
jest.mock('../../src/middleware/rateLimiter', () => ({
    adminLimiter: (req, res, next) => next(),
    searchLimiter: (req, res, next) => next(),
    globalLimiter: (req, res, next) => next()
}));

// Now require the router
const watchdogRouter = require('../../src/routes/watchdog');

// Create test app
const app = express();
app.use(express.json());
// Add router
app.use('/api/watchdog', watchdogRouter);

describe('Watchdog API Security', () => {
    // Ensure admin key is set for tests
    const ADMIN_KEY = process.env.ADMIN_API_KEY || 'test-admin-key';

    describe('POST /api/watchdog/verify', () => {
        it('should reject requests without admin key', async () => {
            const res = await request(app).post('/api/watchdog/verify');

            // Should be 401, but currently 200 (VULNERABILITY)
            // We assert what we WANT (401), so this test should fail initially
            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });

        it('should reject requests with invalid admin key', async () => {
            const res = await request(app).post('/api/watchdog/verify')
                .set('x-admin-key', 'wrong-key');

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });

        it('should allow requests with valid admin key', async () => {
            // Note: Since the endpoint is currently insecure, this will pass with 200.
            // After fix, it should still pass with 200 (because we provide the key).
            const res = await request(app).post('/api/watchdog/verify')
                .set('x-admin-key', ADMIN_KEY);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.status).toBe('OK');
        });
    });

    describe('GET /api/watchdog/reports', () => {
        it('should reject requests without admin key', async () => {
            const res = await request(app).get('/api/watchdog/reports');

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });

        it('should reject requests with invalid admin key', async () => {
            const res = await request(app).get('/api/watchdog/reports')
                .set('x-admin-key', 'wrong-key');

            expect(res.status).toBe(401);
        });

        it('should allow requests with valid admin key', async () => {
            const res = await request(app).get('/api/watchdog/reports')
                .set('x-admin-key', ADMIN_KEY);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
        });
    });
});
