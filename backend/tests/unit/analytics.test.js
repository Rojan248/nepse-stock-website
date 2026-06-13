const analytics = require('../../src/services/analytics');

describe('analytics service', () => {
    beforeEach(() => {
        analytics.scores = new Map();
        analytics.isDirty = false;
    });

    it('records exact stock-symbol searches from returned matches', () => {
        analytics.recordSearch('test', [{ symbol: 'TEST' }]);

        expect(analytics.scores.get('TEST')).toMatchObject({
            views: 0,
            searches: 1,
            score: 2
        });
        expect(analytics.isDirty).toBe(true);
    });

    it('ignores broad, empty-result, and malformed search terms', () => {
        analytics.recordSearch('bank', [{ symbol: 'NABIL' }]);
        analytics.recordSearch('ZZZZ', []);
        analytics.recordSearch('NABIL-BANK', [{ symbol: 'NABIL' }]);

        expect(analytics.scores.size).toBe(0);
        expect(analytics.isDirty).toBe(false);
    });

    it('does not record searches unless matched stocks are supplied', () => {
        analytics.recordSearch('NABIL');

        expect(analytics.scores.size).toBe(0);
    });
});
