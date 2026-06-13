const API_ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
const API_ALLOWED_METHOD_SET = new Set(API_ALLOWED_METHODS);
const API_ALLOW_HEADER = API_ALLOWED_METHODS.join(', ');

const isApiRequest = (req) => {
    const path = req.originalUrl || req.url || '';
    return path === '/api' || path.startsWith('/api/');
};

const apiMethodGuard = (req, res, next) => {
    if (!isApiRequest(req) || API_ALLOWED_METHOD_SET.has(req.method)) {
        return next();
    }

    return res
        .set('Allow', API_ALLOW_HEADER)
        .status(405)
        .json({
            success: false,
            error: { message: 'HTTP method not allowed for API routes' }
        });
};

module.exports = {
    API_ALLOWED_METHODS,
    apiMethodGuard
};
