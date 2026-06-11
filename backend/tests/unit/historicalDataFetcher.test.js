const { __test__ } = require('../../src/services/historicalDataFetcher');

jest.mock('../../src/services/utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
}));

describe('Historical data fetcher request hardening', () => {
    it('does not disable TLS verification and refuses redirects', () => {
        const options = __test__.buildPreviousTradingDayRequestOptions({ Authorization: 'Bearer token' });

        expect(options.maxRedirects).toBe(0);
        expect(options.timeout).toBe(10000);
        expect(options.httpsAgent.options.rejectUnauthorized).not.toBe(false);
    });
});
