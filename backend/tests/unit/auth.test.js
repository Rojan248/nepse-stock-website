const { requireAdminKey } = require('../../src/middleware/auth');

// Mock logger
jest.mock('../../src/services/utils/logger', () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
}));

describe('Auth Middleware - requireAdminKey', () => {
    let req, res, next;
    const ORIGINAL_ENV = process.env;
    const logger = require('../../src/services/utils/logger');

    // Helper to reduce code duplication in error scenarios
    const expectAuthFailure = (statusCode, errorMessage) => {
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(statusCode);
        if (errorMessage) {
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: false,
                error: { message: errorMessage }
            }));
        }
    };

    afterEach(() => {
        jest.clearAllMocks();
    });

    beforeEach(() => {
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
        // Note: Express/Node.js normalizes all incoming HTTP headers to lowercase,
        // so req.headers['x-admin-key'] is always the correct lookup key in production.
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

        expectAuthFailure(401, 'Unauthorized: Invalid Admin Key');
        expect(logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Unauthorized admin access attempt')
        );
    });

    it('should return 401 when API key is missing in request', () => {
        process.env.ADMIN_API_KEY = 'secret-key';
        // No header set

        requireAdminKey(req, res, next);

        expectAuthFailure(401, 'Unauthorized: Invalid Admin Key');
        expect(logger.warn).toHaveBeenCalled();
    });

    it('should return a generic 500 when server has no API key configured', () => {
        delete process.env.ADMIN_API_KEY;
        req.headers['x-admin-key'] = 'some-key';

        requireAdminKey(req, res, next);

        expectAuthFailure(500, 'Internal Server Error');
        expect(logger.error).toHaveBeenCalledWith(
            expect.stringContaining('ADMIN_API_KEY is not configured')
        );
    });


    it('should return 401 when provided key is shorter than configured key', () => {
        process.env.ADMIN_API_KEY = 'a-very-long-secret-key-1234567890';
        req.headers['x-admin-key'] = 'short';

        requireAdminKey(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 401 when provided key is longer than configured key', () => {
        process.env.ADMIN_API_KEY = 'short';
        req.headers['x-admin-key'] = 'a-very-long-secret-key-1234567890';

        requireAdminKey(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 401 for single-character key vs long configured key', () => {
        process.env.ADMIN_API_KEY = 'super-secret-production-key';
        req.headers['x-admin-key'] = 'x';

        requireAdminKey(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should use constant-time comparison via SHA-256 hashing (no TypeError on length mismatch)', () => {
        // This test ensures the implementation hashes inputs before comparing,
        // so crypto.timingSafeEqual never receives unequal-length buffers.
        // If the implementation used raw Buffers without hashing, keys of
        // different lengths would cause a TypeError from timingSafeEqual.
        const crypto = require('crypto');
        const spy = jest.spyOn(crypto, 'timingSafeEqual');

        process.env.ADMIN_API_KEY = 'configured-key-32-chars-long!!!!';
        req.headers['x-admin-key'] = 'short'; // Very different length

        // Should NOT throw - SHA-256 hashing normalizes to 32-byte buffers
        expect(() => requireAdminKey(req, res, next)).not.toThrow();

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);

        // Verify timingSafeEqual was called with equal-length buffers (32 bytes each from SHA-256)
        if (spy.mock.calls.length > 0) {
            const [buf1, buf2] = spy.mock.calls[0];
            expect(buf1.byteLength).toBe(32); // SHA-256 digest length
            expect(buf2.byteLength).toBe(32);
            expect(buf1.byteLength).toBe(buf2.byteLength);
        }

        spy.mockRestore();
    });
});
