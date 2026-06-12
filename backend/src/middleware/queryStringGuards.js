const DANGEROUS_QUERY_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const getRequestPath = (req) => {
    const originalUrl = req.originalUrl || req.url || '';
    return originalUrl.split('?')[0];
};

const getRawQueryString = (req) => {
    const originalUrl = req.originalUrl || req.url || '';
    const queryStart = originalUrl.indexOf('?');
    if (queryStart === -1) return '';
    return originalUrl.slice(queryStart + 1);
};

const isApiRequest = (req) => {
    const path = getRequestPath(req);
    return path === '/api' || path.startsWith('/api/');
};

const hasBracketSyntax = (key) => key.includes('[') || key.includes(']');

const isDangerousKey = (key) => DANGEROUS_QUERY_KEYS.has(key.toLowerCase());

const rejectQuery = (res, message) => res.status(400).json({
    success: false,
    error: { message }
});

const queryStringShapeGuard = (req, res, next) => {
    if (!isApiRequest(req)) return next();

    const rawQuery = getRawQueryString(req);
    if (!rawQuery) return next();

    const seen = new Set();
    for (const key of new URLSearchParams(rawQuery).keys()) {
        if (hasBracketSyntax(key) || isDangerousKey(key)) {
            return rejectQuery(res, `Invalid query parameter: ${key}`);
        }
        if (seen.has(key)) {
            return rejectQuery(res, `Duplicate query parameter: ${key}`);
        }
        seen.add(key);
    }

    return next();
};

module.exports = {
    queryStringShapeGuard
};
