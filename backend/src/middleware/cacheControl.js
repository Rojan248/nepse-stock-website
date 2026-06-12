const API_PREFIX = '/api';
const SENSITIVE_API_PREFIXES = [
    '/api/auth',
    '/api/watchlists',
    '/api/portfolios',
    '/api/alerts',
    '/api/watchdog',
    '/api/ai-summaries/admin',
    '/api/stocks/admin',
    '/api/health/extended',
    '/api/scheduler-status',
    '/api/time-sync-status',
    '/api/force-update',
    '/api/sync-from-web',
    '/api/scrape-live'
];

const NO_STORE_VALUE = 'no-store, no-cache, must-revalidate, private, max-age=0, s-maxage=0';

const getRequestPath = (req) => {
    const originalUrl = req.originalUrl || req.url || '';
    return originalUrl.split('?')[0];
};

const isApiRequest = (req) => {
    const path = getRequestPath(req);
    return path === API_PREFIX || path.startsWith(`${API_PREFIX}/`);
};

const hasCredentials = (req) => Boolean(req.headers.authorization || req.headers.cookie);

const isSensitiveApiRequest = (req) => {
    const path = getRequestPath(req);
    return SENSITIVE_API_PREFIXES.some((prefix) => (
        path === prefix || path.startsWith(`${prefix}/`)
    ));
};

const setNoStoreHeaders = (res) => {
    res.set('Cache-Control', NO_STORE_VALUE);
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
    res.vary('Authorization');
    res.vary('Cookie');
};

const sensitiveApiCacheGuard = (req, res, next) => {
    if (isApiRequest(req) && (isSensitiveApiRequest(req) || hasCredentials(req))) {
        setNoStoreHeaders(res);
    }

    next();
};

module.exports = {
    NO_STORE_VALUE,
    isSensitiveApiRequest,
    sensitiveApiCacheGuard,
    setNoStoreHeaders
};
