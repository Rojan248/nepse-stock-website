const request = require('supertest');
const express = require('express');
const crypto = require('crypto');

// We intentionally do NOT mock the rate limiter here to test its real functionality.

// Mock watchdog service and fs to avoid real work
jest.mock('../../src/services/watchdog/WatchdogService', () => ({
    verify: jest.fn().mockResolvedValue({ status: 'OK' })
}));
jest.mock('fs', () => ({
    promises: {
        readFile: jest.fn().mockResolvedValue(JSON.stringify([])),
        writeFile: jest.fn().mockResolvedValue()
    }
}));
jest.mock('../../src/services/utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
}));

const watchdogRouter = require('../../src/routes/watchdog');
const app = express();
// Admin limiter uses trust proxy by default if behind one, mock IP for testing
app.set('trust proxy', 1);
app.use(express.json());
app.use('/api/watchdog', watchdogRouter);

describe('Watchdog API Rate Limiting', () => {
    const ADMIN_KEY = crypto.randomBytes(32).toString('hex');
    const originalAdminKey = process.env.ADMIN_API_KEY;

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

    it('should enforce 429 rate limit after 5 requests', async () => {
        // The adminLimiter is configured for 5 requests per 15 mins.
        // We will make 5 successful requests.
        for (let i = 0; i < 5; i++) {
            const res = await request(app)
                .post('/api/watchdog/verify')
                .set('x-admin-key', ADMIN_KEY)
                .set('x-forwarded-for', '192.168.1.100'); // Ensure consistent IP for rate limiter

            expect(res.status).toBe(200);
        }

        // The 6th request should hit the rate limit.
        const res = await request(app)
            .post('/api/watchdog/verify')
            .set('x-admin-key', ADMIN_KEY)
            .set('x-forwarded-for', '192.168.1.100');

        expect(res.status).toBe(429);
    });
});
