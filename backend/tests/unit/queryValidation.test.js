const { clampInt, parseBooleanQuery, parseBoundedIntQuery } = require('../../src/services/utils/queryValidation');

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

    it('accepts strict boolean query strings', () => {
        expect(parseBooleanQuery('true', { defaultValue: false, label: 'activeOnly' })).toEqual({ value: true });
        expect(parseBooleanQuery('FALSE', { defaultValue: true, label: 'activeOnly' })).toEqual({ value: false });
    });

    it('rejects repeated boolean query parameters', () => {
        const result = parseBooleanQuery(['true', 'true'], {
            defaultValue: true,
            label: 'activeOnly'
        });

        expect(result.error).toBe('activeOnly must be a single boolean');
    });

    it('rejects non-boolean query strings', () => {
        const result = parseBooleanQuery('1', {
            defaultValue: false,
            label: 'compact'
        });

        expect(result.error).toBe('compact must be true or false');
    });
});
