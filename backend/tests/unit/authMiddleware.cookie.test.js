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
});
