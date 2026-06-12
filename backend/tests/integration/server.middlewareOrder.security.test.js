const request = require('supertest');

const mockLogger = () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
});

const mockScheduler = () => ({
    startScheduler: jest.fn(),
    stopScheduler: jest.fn(),
    getUpdateStatus: jest.fn().mockReturnValue({ isRunning: false })
});

const mockModel = () => new Proxy({}, { get: () => jest.fn() });
const mockPrisma = () => new Proxy({}, {
    get(target, prop) {
        if (!target[prop]) target[prop] = mockModel();
        return target[prop];
    }
});

describe('API middleware ordering', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalJwtSecret = process.env.JWT_SECRET;
    const originalAdminApiKey = process.env.ADMIN_API_KEY;
    const originalCorsOrigin = process.env.CORS_ORIGIN;

    beforeEach(() => {
        jest.resetModules();
        process.env.NODE_ENV = 'production';
        process.env.JWT_SECRET = 'test-production-jwt-secret-32-characters';
        process.env.ADMIN_API_KEY = 'test-production-admin-key-32-characters';
        process.env.CORS_ORIGIN = 'https://app.example.com';

        jest.doMock('../../src/services/utils/logger', mockLogger);
        jest.doMock('../../src/services/database/connection', () => ({
            connectDB: jest.fn().mockResolvedValue(true),
            disconnectDB: jest.fn().mockResolvedValue(true),
            prisma: mockPrisma()
        }));
        jest.doMock('../../src/services/scheduler/updateScheduler', mockScheduler);
        jest.doMock('../../src/services/scheduler/aiSummaryScheduler', mockScheduler);
        jest.doMock('../../src/services/analytics', () => ({
            initialize: jest.fn(),
            shutdown: jest.fn(),
            recordSearch: jest.fn(),
            recordView: jest.fn()
        }));
        jest.doMock('../../src/services/utils/securityConfig', () => ({
            getSecretIssue: jest.fn(() => null),
            validateRuntimeSecrets: jest.fn()
        }));
        jest.doMock('../../src/middleware/rateLimiter', () => ({
            globalLimiter: (req, res) => res.status(429).json({
                success: false,
                error: { message: 'blocked before body parsing' }
            }),
            adminLimiter: (req, res, next) => next(),
            searchLimiter: (req, res, next) => next(),
            loginLimiter: (req, res, next) => next(),
            registrationLimiter: (req, res, next) => next(),
            refreshLimiter: (req, res, next) => next()
        }));
    });

    afterEach(() => {
        process.env.NODE_ENV = originalNodeEnv;
        if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = originalJwtSecret;
        if (originalAdminApiKey === undefined) delete process.env.ADMIN_API_KEY;
        else process.env.ADMIN_API_KEY = originalAdminApiKey;
        if (originalCorsOrigin === undefined) delete process.env.CORS_ORIGIN;
        else process.env.CORS_ORIGIN = originalCorsOrigin;
        jest.restoreAllMocks();
        jest.resetModules();
        jest.clearAllMocks();
    });

    it('applies the global limiter before JSON body parsing', async () => {
        const app = require('../../src/server');

        const res = await request(app)
            .post('/api/auth/login')
            .set('Content-Type', 'application/json')
            .send('{"email":')
            .expect(429);

        expect(res.body.error.message).toBe('blocked before body parsing');
    });

    it('applies sensitive cache headers before global limiter responses', async () => {
        const app = require('../../src/server');

        const res = await request(app)
            .post('/api/auth/login')
            .set('Content-Type', 'application/json')
            .send('{"email":')
            .expect(429);

        expect(res.headers['cache-control']).toContain('no-store');
        expect(res.headers['surrogate-control']).toBe('no-store');
    });

    it('applies the global limiter before API content-type rejection', async () => {
        const app = require('../../src/server');

        const res = await request(app)
            .post('/api/auth/login')
            .type('form')
            .send({ email: 'person@example.com', password: 'StrongPass123' })
            .expect(429);

        expect(res.body.error.message).toBe('blocked before body parsing');
    });
});
