const { requireAdminKey } = require('../../src/middleware/auth');
const logger = require('../../src/services/utils/logger');

// Mock logger
jest.mock('../../src/services/utils/logger', () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
}));

describe('Auth Middleware - requireAdminKey', () => {
    let req, res, next;
    const ORIGINAL_ENV = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...ORIGINAL_ENV };
        req = {
            headers: {},
            ip: '127.0.0.1'
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        next = jest.fn();
    });

    afterAll(() => {
        process.env = ORIGINAL_ENV;
    });

    it('should call next() when API key matches', () => {
        process.env.ADMIN_API_KEY = 'secret-key';
        req.headers['x-admin-key'] = 'secret-key';

        requireAdminKey(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('should return 401 when API key does not match', () => {
        process.env.ADMIN_API_KEY = 'secret-key';
        req.headers['x-admin-key'] = 'wrong-key';

        requireAdminKey(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            error: { message: 'Unauthorized: Invalid Admin Key' }
        }));
    });

    it('should return 401 when API key is missing in request', () => {
        process.env.ADMIN_API_KEY = 'secret-key';
        // No header set

        requireAdminKey(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 500 when server has no API key configured', () => {
        delete process.env.ADMIN_API_KEY;
        req.headers['x-admin-key'] = 'some-key';

        requireAdminKey(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            error: { message: 'Server configuration error: Admin key not set' }
        }));
    });

    it('should handle different casing in headers (uppercase)', () => {
        process.env.ADMIN_API_KEY = 'secret-key';
        req.headers['X-ADMIN-KEY'] = 'secret-key'; // Uppercase header

        requireAdminKey(req, res, next);

        expect(next).toHaveBeenCalled();
    });
});
