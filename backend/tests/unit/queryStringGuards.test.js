const { queryStringShapeGuard } = require('../../src/middleware/queryStringGuards');

const makeReq = (url) => ({
    originalUrl: url,
    url
});

const makeRes = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
});

describe('query string guards', () => {
    it('allows ordinary single-value query parameters', () => {
        const res = makeRes();
        const next = jest.fn();

        queryStringShapeGuard(makeReq('/api/stocks?limit=10&sortOrder=desc'), res, next);

        expect(res.status).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalledTimes(1);
    });

    it('does not police non-API frontend routes', () => {
        const res = makeRes();
        const next = jest.fn();

        queryStringShapeGuard(makeReq('/stock/NABIL?utm=one&utm=two'), res, next);

        expect(res.status).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalledTimes(1);
    });

    it('rejects duplicate query parameters before route parsing', () => {
        const res = makeRes();
        const next = jest.fn();

        queryStringShapeGuard(makeReq('/api/stocks?limit=10&limit=20'), res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            error: { message: 'Duplicate query parameter: limit' }
        });
        expect(next).not.toHaveBeenCalled();
    });

    it.each([
        '/api/stocks?sortBy%5Bfield%5D=symbol',
        '/api/stocks?__proto__=polluted',
        '/api/stocks?constructor=value',
        '/api/stocks?prototype=value'
    ])('rejects pollution-shaped query key %s', (url) => {
        const res = makeRes();
        const next = jest.fn();

        queryStringShapeGuard(makeReq(url), res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json.mock.calls[0][0].error.message).toContain('Invalid query parameter');
        expect(next).not.toHaveBeenCalled();
    });
});
