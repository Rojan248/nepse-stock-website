const { isOriginAllowed } = require('./cors');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const isApiRequest = (req) => {
    const path = req.originalUrl || req.url || '';
    return path === '/api' || path.startsWith('/api/');
};

const isUnsafeMethod = (req) => !SAFE_METHODS.has(req.method);

const hasRequestBody = (req) => {
    if (req.headers['transfer-encoding']) return true;

    const contentLength = Number.parseInt(req.headers['content-length'] || '0', 10);
    return Number.isFinite(contentLength) && contentLength > 0;
};

const reject = (res, status, message) => res.status(status).json({
    success: false,
    error: { message }
});

const browserStateChangeGuard = (req, res, next) => {
    if (!isApiRequest(req) || !isUnsafeMethod(req)) return next();

    res.vary('Sec-Fetch-Site');
    res.vary('Origin');

    const fetchSite = String(req.get('Sec-Fetch-Site') || '').toLowerCase();
    const origin = req.get('Origin');

    if (fetchSite === 'cross-site') {
        return reject(res, 403, 'Cross-site state-changing requests are not allowed');
    }

    if (fetchSite === 'same-site' && !origin) {
        return reject(res, 403, 'Same-site state-changing requests require an allowed Origin');
    }

    if (origin && !isOriginAllowed(origin)) {
        return reject(res, 403, 'Request origin is not allowed');
    }

    return next();
};

const jsonApiBodyGuard = (req, res, next) => {
    if (!isApiRequest(req) || !isUnsafeMethod(req) || !hasRequestBody(req)) {
        return next();
    }

    if (!req.is('application/json')) {
        return reject(res, 415, 'API requests with a body must use application/json');
    }

    return next();
};

module.exports = {
    browserStateChangeGuard,
    jsonApiBodyGuard
};
