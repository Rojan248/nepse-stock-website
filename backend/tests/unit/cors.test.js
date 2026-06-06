jest.mock('../../src/services/utils/logger', () => ({
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
}));

describe('CORS origin policy', () => {
    const originalEnv = process.env;

    const loadCorsWithEnv = (env) => {
        jest.resetModules();
        process.env = { ...originalEnv, ...env };
        return require('../../src/middleware/cors');
    };

    afterEach(() => {
        process.env = originalEnv;
        jest.resetModules();
    });

    it('does not honor wildcard CORS origins in production', () => {
        const { getOrigins, isOriginAllowed } = loadCorsWithEnv({
            NODE_ENV: 'production',
            CORS_ORIGIN: '*'
        });

        expect(getOrigins()).toEqual([]);
        expect(isOriginAllowed('https://attacker.example')).toBe(false);
        expect(isOriginAllowed()).toBe(true);
    });

    it('allows only configured origins in production', () => {
        const { getOrigins, isOriginAllowed } = loadCorsWithEnv({
            NODE_ENV: 'production',
            CORS_ORIGIN: 'https://app.example.com, https://admin.example.com'
        });

        expect(getOrigins()).toEqual(['https://app.example.com', 'https://admin.example.com']);
        expect(isOriginAllowed('https://app.example.com')).toBe(true);
        expect(isOriginAllowed('https://attacker.example')).toBe(false);
    });

    it('keeps wildcard support for local development', () => {
        const { isOriginAllowed } = loadCorsWithEnv({
            NODE_ENV: 'development',
            CORS_ORIGIN: '*'
        });

        expect(isOriginAllowed('https://temporary-dev.example')).toBe(true);
    });

    it('rejects disallowed fallback preflight requests', () => {
        const { simpleCorsMiddleware } = loadCorsWithEnv({
            NODE_ENV: 'production',
            CORS_ORIGIN: 'https://app.example.com'
        });
        const req = {
            method: 'OPTIONS',
            headers: { origin: 'https://attacker.example' }
        };
        const res = {
            header: jest.fn(),
            sendStatus: jest.fn()
        };
        const next = jest.fn();

        simpleCorsMiddleware(req, res, next);

        expect(res.header).not.toHaveBeenCalled();
        expect(res.sendStatus).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });
});
