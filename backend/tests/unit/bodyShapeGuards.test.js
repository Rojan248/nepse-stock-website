const {
    inspectJsonShape,
    jsonBodyShapeGuard
} = require('../../src/middleware/bodyShapeGuards');

const makeReq = ({ method = 'POST', url = '/api/auth/login', body = {}, headers = { 'content-length': '2' } } = {}) => ({
    method,
    originalUrl: url,
    url,
    body,
    headers
});

const makeRes = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
});

describe('body shape guards', () => {
    it('accepts ordinary JSON API request bodies', () => {
        expect(inspectJsonShape({
            symbols: ['NABIL', 'NICA'],
            alert: { condition: 'above', threshold: 500 }
        })).toEqual({ ok: true });
    });

    it.each([
        '{"__proto__":{"admin":true}}',
        '{"constructor":{"prototype":{"admin":true}}}',
        '{"profile":{"prototype":{"polluted":true}}}'
    ])('rejects prototype pollution key payload %s', (payload) => {
        const result = inspectJsonShape(JSON.parse(payload));

        expect(result.error).toContain('Invalid JSON body property');
    });

    it('rejects top-level arrays', () => {
        expect(inspectJsonShape(['NABIL'])).toEqual({
            error: 'JSON body must be an object'
        });
    });

    it('rejects deeply nested JSON bodies', () => {
        let body = { value: 'leaf' };
        for (let index = 0; index < 20; index++) {
            body = { child: body };
        }

        expect(inspectJsonShape(body)).toEqual({
            error: 'JSON body is too deeply nested'
        });
    });

    it('blocks malformed API JSON bodies before route handling', () => {
        const req = makeReq({
            body: JSON.parse('{"__proto__":{"admin":true}}')
        });
        const res = makeRes();
        const next = jest.fn();

        jsonBodyShapeGuard(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json.mock.calls[0][0].error.message).toBe('Invalid JSON body property: __proto__');
        expect(next).not.toHaveBeenCalled();
    });

    it('does not police safe methods or non-API routes', () => {
        const res = makeRes();
        const next = jest.fn();

        jsonBodyShapeGuard(makeReq({ method: 'GET', body: ['ignored'] }), res, next);
        jsonBodyShapeGuard(makeReq({ url: '/stock/NABIL', body: ['ignored'] }), res, next);

        expect(res.status).not.toHaveBeenCalled();
        expect(next).toHaveBeenCalledTimes(2);
    });
});
