const {
    getAllowedHosts,
    hasHostOverrideHeader,
    hostHeaderGuard,
    hostMatchesAllowed,
    isSafeHostHeader,
    normalizeAllowedHost
} = require('../../src/middleware/hostHeaderGuard');

const makeRes = () => {
    const res = {
        status: jest.fn(() => res),
        json: jest.fn(() => res)
    };
    return res;
};

describe('host header guard', () => {
    const originalAllowedHosts = process.env.ALLOWED_HOSTS;

    afterEach(() => {
        if (originalAllowedHosts === undefined) delete process.env.ALLOWED_HOSTS;
        else process.env.ALLOWED_HOSTS = originalAllowedHosts;
        jest.clearAllMocks();
    });

    it('rejects host override headers used in Host header attacks', () => {
        const req = {
            headers: {
                host: 'app.example.com',
                'x-forwarded-host': 'attacker.example'
            }
        };
        const res = makeRes();
        const next = jest.fn();

        hostHeaderGuard(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: { message: 'Host override headers are not accepted' }
        });
        expect(next).not.toHaveBeenCalled();
    });

    it('rejects malformed Host values before routing', () => {
        const req = { headers: { host: 'good.example.com/path' } };
        const res = makeRes();
        const next = jest.fn();

        hostHeaderGuard(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: { message: 'Invalid Host header' }
        });
        expect(next).not.toHaveBeenCalled();
    });

    it('enforces ALLOWED_HOSTS when configured', () => {
        process.env.ALLOWED_HOSTS = 'https://app.example.com, api.example.com:8443';
        const req = { headers: { host: 'attacker.example' } };
        const res = makeRes();
        const next = jest.fn();

        hostHeaderGuard(req, res, next);

        expect(getAllowedHosts()).toEqual(['app.example.com', 'api.example.com:8443']);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: { message: 'Host is not allowed' }
        });
        expect(next).not.toHaveBeenCalled();
    });

    it('allows safe hosts and optional ports', () => {
        process.env.ALLOWED_HOSTS = 'app.example.com:443';
        const req = { headers: { host: 'app.example.com:443' } };
        const res = makeRes();
        const next = jest.fn();

        hostHeaderGuard(req, res, next);

        expect(res.status).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalledTimes(1);
    });

    it('exposes pure helpers for syntax and allowlist checks', () => {
        expect(isSafeHostHeader('localhost:3000')).toBe(true);
        expect(isSafeHostHeader('[::1]:3000')).toBe(true);
        expect(isSafeHostHeader('bad host')).toBe(false);
        expect(isSafeHostHeader('example.com:99999')).toBe(false);
        expect(hasHostOverrideHeader({ forwarded: 'host=attacker.example' })).toBe(true);
        expect(normalizeAllowedHost('https://App.Example.com/path')).toBe('app.example.com');
        expect(hostMatchesAllowed('app.example.com', ['app.example.com'])).toBe(true);
    });
});
