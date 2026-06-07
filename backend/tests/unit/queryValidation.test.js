const { clampInt, parseBoundedIntQuery } = require('../../src/services/utils/queryValidation');

describe('queryValidation', () => {
    it('accepts missing integers with the configured default', () => {
        expect(parseBoundedIntQuery(undefined, {
            min: 1,
            max: 100,
            defaultValue: 10,
            label: 'limit'
        })).toEqual({ value: 10 });
    });

    it('clamps valid integer strings to bounds', () => {
        expect(parseBoundedIntQuery('999', {
            min: 1,
            max: 100,
            defaultValue: 10,
            label: 'limit'
        })).toEqual({ value: 100 });
    });

    it('rejects repeated integer parameters instead of coercing the first value', () => {
        const result = parseBoundedIntQuery(['10', '20'], {
            min: 1,
            max: 100,
            defaultValue: 10,
            label: 'limit'
        });

        expect(result.error).toBe('limit must be a single integer');
    });

    it('rejects numeric prefixes that parseInt would otherwise accept', () => {
        const result = parseBoundedIntQuery('10abc', {
            min: 1,
            max: 100,
            defaultValue: 10,
            label: 'limit'
        });

        expect(result.error).toBe('limit must be an integer');
    });

    it('keeps legacy clampInt default fallback for internal callers', () => {
        expect(clampInt('10abc', 1, 100, 10)).toBe(10);
    });
});
