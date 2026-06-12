describe('auth middleware refresh cookie flags', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalJwtSecret = process.env.JWT_SECRET;

    afterEach(() => {
        process.env.NODE_ENV = originalNodeEnv;
        if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = originalJwtSecret;
        jest.resetModules();
    });

    it('sets refresh cookies as httpOnly and SameSite Strict', () => {
        process.env.NODE_ENV = 'test';
        process.env.JWT_SECRET = 'test-jwt-secret-for-cookie-flags-32';
        const { setRefreshCookie } = require('../../src/middleware/authMiddleware');
        const res = { cookie: jest.fn() };

        setRefreshCookie(res, 'refresh-token');

        expect(res.cookie).toHaveBeenCalledWith('refreshToken', 'refresh-token', expect.objectContaining({
            httpOnly: true,
            sameSite: 'strict',
            path: '/api/auth'
        }));
    });

    it('sets production refresh cookies with __Host prefix requirements', () => {
        process.env.NODE_ENV = 'production';
        process.env.JWT_SECRET = 'test-jwt-secret-for-cookie-flags-32';
        const { setRefreshCookie } = require('../../src/middleware/authMiddleware');
        const res = { cookie: jest.fn() };

        setRefreshCookie(res, 'refresh-token');

        expect(res.cookie).toHaveBeenCalledWith('__Host-refreshToken', 'refresh-token', expect.objectContaining({
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            path: '/'
        }));
        expect(res.cookie.mock.calls[0][2]).not.toHaveProperty('domain');
    });

    it('clears refresh cookies with matching SameSite Strict attributes', () => {
        process.env.NODE_ENV = 'test';
        process.env.JWT_SECRET = 'test-jwt-secret-for-cookie-flags-32';
        const { clearRefreshCookie } = require('../../src/middleware/authMiddleware');
        const res = { clearCookie: jest.fn() };

        clearRefreshCookie(res);

        expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', expect.objectContaining({
            httpOnly: true,
            sameSite: 'strict',
            path: '/api/auth'
        }));
    });

    it('clears production host-prefixed and legacy refresh cookies', () => {
        process.env.NODE_ENV = 'production';
        process.env.JWT_SECRET = 'test-jwt-secret-for-cookie-flags-32';
        const { clearRefreshCookie } = require('../../src/middleware/authMiddleware');
        const res = { clearCookie: jest.fn() };

        clearRefreshCookie(res);

        expect(res.clearCookie).toHaveBeenCalledWith('__Host-refreshToken', expect.objectContaining({
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            path: '/'
        }));
        expect(res.clearCookie.mock.calls[0][1]).not.toHaveProperty('domain');
        expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', expect.objectContaining({
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            path: '/api/auth'
        }));
    });

    it('ignores legacy refresh cookie names in production', () => {
        process.env.NODE_ENV = 'production';
        process.env.JWT_SECRET = 'test-jwt-secret-for-cookie-flags-32';
        const { getRefreshTokenFromRequest } = require('../../src/middleware/authMiddleware');

        expect(getRefreshTokenFromRequest({
            cookies: { refreshToken: 'legacy-token' }
        })).toBeNull();
        expect(getRefreshTokenFromRequest({
            cookies: {
                refreshToken: 'legacy-token',
                '__Host-refreshToken': 'host-token'
            }
        })).toBe('host-token');
    });
});
