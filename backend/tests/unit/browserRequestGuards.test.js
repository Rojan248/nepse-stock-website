jest.mock('../../src/services/utils/logger', () => ({
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
}));

const loadGuards = (env = {}) => {
    jest.resetModules();
    process.env = { ...process.env, ...env };
    return require('../../src/middleware/browserRequestGuards');
};

const makeReq = ({ method = 'POST', url = '/api/auth/login', headers = {} } = {}) => {
    const normalizedHeaders = Object.fromEntries(
        Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
    );

    return {
        method,
        originalUrl: url,
        url,
        headers: normalizedHeaders,
        get: (name) => normalizedHeaders[name.toLowerCase()]
    };
};

const makeRes = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    vary: jest.fn()
});

describe('browser request guards', () => {
    const originalEnv = process.env;

    afterEach(() => {
        process.env = originalEnv;
        jest.resetModules();
    });

    it('blocks cross-site unsafe browser requests', () => {
        const { browserStateChangeGuard } = loadGuards();
        const req = makeReq({ headers: { 'Sec-Fetch-Site': 'cross-site' } });
        const res = makeRes();
        const next = jest.fn();

        browserStateChangeGuard(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
        expect(next).not.toHaveBeenCalled();
    });

    it('blocks unsafe requests from disallowed origins', () => {
        const { browserStateChangeGuard } = loadGuards({
            NODE_ENV: 'production',
            CORS_ORIGIN: 'https://app.example.com'
        });
        const req = makeReq({ headers: { Origin: 'https://attacker.example' } });
        const res = makeRes();
        const next = jest.fn();

        browserStateChangeGuard(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });

    it('allows same-origin or non-browser unsafe requests to continue', () => {
        const { browserStateChangeGuard } = loadGuards({
            NODE_ENV: 'production',
            CORS_ORIGIN: 'https://app.example.com'
        });
        const req = makeReq({ headers: { Origin: 'https://app.example.com' } });
        const res = makeRes();
        const next = jest.fn();

        browserStateChangeGuard(req, res, next);

        expect(res.status).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalled();
    });

    it('blocks same-site unsafe browser requests when no allowed Origin is present', () => {
        const { browserStateChangeGuard } = loadGuards({
            NODE_ENV: 'production',
            CORS_ORIGIN: 'https://app.example.com'
        });
        const req = makeReq({ headers: { 'Sec-Fetch-Site': 'same-site' } });
        const res = makeRes();
        const next = jest.fn();

        browserStateChangeGuard(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
        expect(next).not.toHaveBeenCalled();
    });

    it('varies unsafe API decisions by fetch metadata and origin headers', () => {
        const { browserStateChangeGuard } = loadGuards({
            NODE_ENV: 'production',
            CORS_ORIGIN: 'https://app.example.com'
        });
        const req = makeReq({ headers: { Origin: 'https://app.example.com' } });
        const res = makeRes();
        const next = jest.fn();

        browserStateChangeGuard(req, res, next);

        expect(res.vary).toHaveBeenCalledWith('Sec-Fetch-Site');
        expect(res.vary).toHaveBeenCalledWith('Origin');
        expect(next).toHaveBeenCalled();
    });

    it('rejects unsafe API requests with non-JSON bodies', () => {
        const { jsonApiBodyGuard } = loadGuards();
        const req = makeReq({
            headers: {
                'Content-Length': '31',
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        req.is = jest.fn((type) => type === 'application/json' ? false : undefined);
        const res = makeRes();
        const next = jest.fn();

        jsonApiBodyGuard(req, res, next);

        expect(res.status).toHaveBeenCalledWith(415);
        expect(next).not.toHaveBeenCalled();
    });

    it('allows JSON API request bodies', () => {
        const { jsonApiBodyGuard } = loadGuards();
        const req = makeReq({
            headers: {
                'Content-Length': '31',
                'Content-Type': 'application/json'
            }
        });
        req.is = jest.fn((type) => type === 'application/json');
        const res = makeRes();
        const next = jest.fn();

        jsonApiBodyGuard(req, res, next);

        expect(res.status).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalled();
    });

    it('ignores safe methods and non-API paths', () => {
        const { browserStateChangeGuard, jsonApiBodyGuard } = loadGuards();
        const next = jest.fn();

        browserStateChangeGuard(makeReq({ method: 'GET', headers: { 'Sec-Fetch-Site': 'cross-site' } }), makeRes(), next);
        jsonApiBodyGuard(makeReq({ method: 'POST', url: '/login', headers: { 'Content-Length': '10' } }), makeRes(), next);

        expect(next).toHaveBeenCalledTimes(2);
    });
});
