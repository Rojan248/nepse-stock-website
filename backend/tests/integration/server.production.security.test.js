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

describe('Production routing hardening', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalJwtSecret = process.env.JWT_SECRET;
    const originalAdminApiKey = process.env.ADMIN_API_KEY;
    const originalCorsOrigin = process.env.CORS_ORIGIN;
    const originalAllowedHosts = process.env.ALLOWED_HOSTS;

    beforeEach(() => {
        jest.resetModules();
        process.env.NODE_ENV = 'production';
        process.env.PORT = 0;
        process.env.JWT_SECRET = 'test-production-jwt-secret-32-characters';
        process.env.ADMIN_API_KEY = 'test-production-admin-key-32-characters';
        process.env.CORS_ORIGIN = 'https://app.example.com';
        delete process.env.ALLOWED_HOSTS;

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
    });

    afterEach(() => {
        process.env.NODE_ENV = originalNodeEnv;
        if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = originalJwtSecret;
        if (originalAdminApiKey === undefined) delete process.env.ADMIN_API_KEY;
        else process.env.ADMIN_API_KEY = originalAdminApiKey;
        if (originalCorsOrigin === undefined) delete process.env.CORS_ORIGIN;
        else process.env.CORS_ORIGIN = originalCorsOrigin;
        if (originalAllowedHosts === undefined) delete process.env.ALLOWED_HOSTS;
        else process.env.ALLOWED_HOSTS = originalAllowedHosts;
        jest.restoreAllMocks();
        jest.resetModules();
        jest.clearAllMocks();
    });

    it('returns 404 for unknown production API routes instead of leaving the request open', async () => {
        const app = require('../../src/server');

        const res = await request(app)
            .get('/api/definitely-missing')
            .expect(404);

        expect(res.body.success).toBe(false);
        expect(res.body.error.message).toContain('Not Found');
    });

    it('rejects cross-site browser state-changing requests before auth routes run', async () => {
        const app = require('../../src/server');

        const res = await request(app)
            .post('/api/auth/logout')
            .set('Sec-Fetch-Site', 'cross-site')
            .expect(403);

        expect(res.body.success).toBe(false);
        expect(res.body.error.message).toContain('Cross-site');
    });

    it('rejects form-encoded API bodies before they reach JSON routes', async () => {
        const app = require('../../src/server');

        const res = await request(app)
            .post('/api/auth/login')
            .type('form')
            .send({ email: 'person@example.com', password: 'StrongPass123' })
            .expect(415);

        expect(res.body.success).toBe(false);
        expect(res.body.error.message).toContain('application/json');
    });

    it('rejects Host override headers before API routes run', async () => {
        const app = require('../../src/server');

        const res = await request(app)
            .get('/api/health')
            .set('X-Forwarded-Host', 'attacker.example')
            .expect(400);

        expect(res.body.success).toBe(false);
        expect(res.body.error.message).toContain('Host override');
    });

    it('rejects unknown production hosts when ALLOWED_HOSTS is configured', async () => {
        process.env.ALLOWED_HOSTS = 'app.example.com';
        const app = require('../../src/server');

        const res = await request(app)
            .get('/api/health')
            .set('Host', 'attacker.example')
            .expect(400);

        expect(res.body.success).toBe(false);
        expect(res.body.error.message).toContain('Host is not allowed');
    });

    it.each([
        '/.env',
        '/package.json',
        '/assets/app.js.map',
        '/..%2fbackend/.env'
    ])('returns 404 for sensitive frontend static probe %s', async (probePath) => {
        const app = require('../../src/server');

        const res = await request(app)
            .get(probePath)
            .expect(404);

        expect(res.text).toBe('Not Found');
    });

    it('still serves the SPA shell for normal production frontend routes', async () => {
        const expressForSpy = require('express');
        const sendFileSpy = jest.spyOn(expressForSpy.response, 'sendFile')
            .mockImplementation(function sendMock(filePath) {
                return this.status(200).type('html').send(`<html>${filePath}</html>`);
            });

        const app = require('../../src/server');

        const res = await request(app)
            .get('/stock/NABIL')
            .expect(200);

        expect(sendFileSpy).toHaveBeenCalledWith(expect.stringContaining('index.html'));
        expect(res.text).toContain('index.html');
    });
});
