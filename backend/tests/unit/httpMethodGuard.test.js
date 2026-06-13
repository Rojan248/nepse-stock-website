const { API_ALLOWED_METHODS, apiMethodGuard } = require('../../src/middleware/httpMethodGuard');

const makeReq = ({ method = 'GET', url = '/api/stocks' } = {}) => ({
    method,
    originalUrl: url,
    url
});

const makeRes = () => {
    const res = {
        headers: {},
        set: jest.fn((name, value) => {
            res.headers[name.toLowerCase()] = value;
            return res;
        }),
        status: jest.fn(() => res),
        json: jest.fn(() => res)
    };
    return res;
};

describe('apiMethodGuard', () => {
    it.each(API_ALLOWED_METHODS)('allows intended API method %s', (method) => {
        const next = jest.fn();

        apiMethodGuard(makeReq({ method }), makeRes(), next);

        expect(next).toHaveBeenCalledTimes(1);
    });

    it.each(['HEAD', 'TRACE', 'CONNECT', 'PATCH'])('rejects unsupported API method %s', (method) => {
        const res = makeRes();
        const next = jest.fn();

        apiMethodGuard(makeReq({ method }), res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.set).toHaveBeenCalledWith('Allow', 'GET, POST, PUT, DELETE, OPTIONS');
        expect(res.status).toHaveBeenCalledWith(405);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: { message: 'HTTP method not allowed for API routes' }
        });
    });

    it('does not police non-API frontend routes', () => {
        const next = jest.fn();

        apiMethodGuard(makeReq({ method: 'HEAD', url: '/stock/NABIL' }), makeRes(), next);

        expect(next).toHaveBeenCalledTimes(1);
    });
});
