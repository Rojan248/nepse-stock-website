const {
    NO_STORE_VALUE,
    isSensitiveApiRequest,
    sensitiveApiCacheGuard,
    setNoStoreHeaders
} = require('../../src/middleware/cacheControl');

const makeReq = ({ url = '/api/auth/me', headers = {} } = {}) => ({
    originalUrl: url,
    url,
    headers: Object.fromEntries(
        Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
    )
});

const makeRes = () => ({
    set: jest.fn(),
    vary: jest.fn()
});

describe('cache control middleware', () => {
    it.each([
        '/api/auth/me',
        '/api/watchlists/shared/public-slug',
        '/api/portfolios/1/summary',
        '/api/alerts',
        '/api/watchdog/reports',
        '/api/ai-summaries/admin/run',
        '/api/stocks/admin/cleanup',
        '/api/health/extended',
        '/api/scheduler-status',
        '/api/time-sync-status',
        '/api/force-update',
        '/api/sync-from-web',
        '/api/scrape-live'
    ])('marks %s as sensitive', (url) => {
        expect(isSensitiveApiRequest(makeReq({ url }))).toBe(true);
    });

    it('does not mark anonymous public market data as sensitive', () => {
        expect(isSensitiveApiRequest(makeReq({ url: '/api/stocks?limit=10' }))).toBe(false);
        expect(isSensitiveApiRequest(makeReq({ url: '/api/health' }))).toBe(false);
    });

    it('sets no-store headers with credential variance', () => {
        const res = makeRes();

        setNoStoreHeaders(res);

        expect(res.set).toHaveBeenCalledWith('Cache-Control', NO_STORE_VALUE);
        expect(res.set).toHaveBeenCalledWith('Pragma', 'no-cache');
        expect(res.set).toHaveBeenCalledWith('Expires', '0');
        expect(res.set).toHaveBeenCalledWith('Surrogate-Control', 'no-store');
        expect(res.vary).toHaveBeenCalledWith('Authorization');
        expect(res.vary).toHaveBeenCalledWith('Cookie');
    });

    it('protects sensitive API requests before route handling', () => {
        const req = makeReq({ url: '/api/auth/me' });
        const res = makeRes();
        const next = jest.fn();

        sensitiveApiCacheGuard(req, res, next);

        expect(res.set).toHaveBeenCalledWith('Cache-Control', NO_STORE_VALUE);
        expect(next).toHaveBeenCalledTimes(1);
    });

    it('protects any credential-bearing API request', () => {
        const req = makeReq({
            url: '/api/stocks?limit=10',
            headers: { Authorization: 'Bearer token' }
        });
        const res = makeRes();
        const next = jest.fn();

        sensitiveApiCacheGuard(req, res, next);

        expect(res.set).toHaveBeenCalledWith('Cache-Control', NO_STORE_VALUE);
        expect(next).toHaveBeenCalledTimes(1);
    });

    it('leaves anonymous public API requests cache-neutral', () => {
        const req = makeReq({ url: '/api/stocks?limit=10' });
        const res = makeRes();
        const next = jest.fn();

        sensitiveApiCacheGuard(req, res, next);

        expect(res.set).not.toHaveBeenCalled();
        expect(res.vary).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalledTimes(1);
    });
});
