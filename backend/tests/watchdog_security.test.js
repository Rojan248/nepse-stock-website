const request = require('supertest');
const express = require('express');

// Set ADMIN_API_KEY before requiring the router so the auth middleware
// has access to it regardless of when it reads process.env
const ADMIN_KEY = 'test-admin-key';
process.env.ADMIN_API_KEY = ADMIN_KEY;

const watchdogRouter = require('../src/routes/watchdog');
const { errorHandler } = require('../src/middleware/errorHandler');

// Mock dependencies
jest.mock('../src/services/watchdog/WatchdogService', () => ({
    verify: jest.fn().mockResolvedValue({ status: 'OK' })
}));

jest.mock('fs', () => {
    return {
        existsSync: jest.fn(() => true),
        mkdirSync: jest.fn(),
        promises: {
            readFile: jest.fn().mockResolvedValue(JSON.stringify([{ status: 'OK' }])),
            writeFile: jest.fn().mockResolvedValue()
        },
        createWriteStream: jest.fn(() => ({
            on: jest.fn(),
            write: jest.fn(),
            end: jest.fn()
        }))
    };
});

// Mock logger
jest.mock('../src/services/utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    stream: { write: jest.fn() }
}));

// Mock Rate Limiter (to avoid actually limiting in tests, or we can just let it run)
// Since we are adding rate limiter, we might want to mock it to bypass or verify it's called.
// But express-rate-limit works fine in tests usually.
// For simplicity, we can mock it to just call next(), unless we want to test rate limiting explicitly.
// Given the scope, testing auth is priority. I'll mock rate limiter to avoid side effects.
jest.mock('../src/middleware/rateLimiter', () => ({
    adminLimiter: (req, res, next) => next(),
    searchLimiter: (req, res, next) => next(),
    globalLimiter: (req, res, next) => next()
}));

describe('Watchdog API Security Check', () => {
    let app;
    const ADMIN_KEY = 'test-admin-key';

    beforeAll(() => {
        process.env.ADMIN_API_KEY = ADMIN_KEY;
        app = express();
        app.use(express.json());
        // We need to re-require the router to ensure it picks up any changes if we were mocking middleware globally
        // But here we are testing the router logic itself.
        // Wait, the router imports middleware. If I change the router code to use middleware,
        // I need to make sure the test app uses the modified router.

        // Since I haven't modified the router code yet, this test will FAIL (expecting 401 but getting 200).
        // This is expected TDD.

        app.use('/api/watchdog', watchdogRouter);
        app.use(errorHandler);
    });

    afterAll(() => {
        delete process.env.ADMIN_API_KEY;
    });

    describe('Unauthorized Access', () => {
        it('should deny access to reports without API key', async () => {
            const res = await request(app).get('/api/watchdog/reports');
            expect(res.statusCode).toBe(401);
            expect(res.body.success).toBe(false);
        });

        it('should deny access to verify without API key', async () => {
            const res = await request(app).post('/api/watchdog/verify');
            expect(res.statusCode).toBe(401);
            expect(res.body.success).toBe(false);
        });

        it('should deny access with incorrect API key', async () => {
            const res = await request(app)
                .post('/api/watchdog/verify')
                .set('X-Admin-Key', 'wrong-key');
            expect(res.statusCode).toBe(401);
            expect(res.body.success).toBe(false);
        });
    });

    describe('Authorized Access', () => {
        it('should allow access to reports with correct API key', async () => {
            const res = await request(app)
                .get('/api/watchdog/reports')
                .set('X-Admin-Key', ADMIN_KEY);
            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should allow access to verify with correct API key', async () => {
            const res = await request(app)
                .post('/api/watchdog/verify')
                .set('X-Admin-Key', ADMIN_KEY);
            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });
});
