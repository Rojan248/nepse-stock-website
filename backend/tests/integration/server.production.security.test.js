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

    beforeEach(() => {
        jest.resetModules();
        process.env.NODE_ENV = 'production';
        process.env.PORT = 0;
        process.env.JWT_SECRET = 'test-production-jwt-secret-32-characters';
        process.env.ADMIN_API_KEY = 'test-production-admin-key-32-characters';

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
});
