jest.mock('../../src/services/utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
}));

const libraryFetcher = require('../../src/services/scrapers/libraryFetcher');

describe('Library Fetcher', () => {
    const { fetchSecuritiesWithPrices } = libraryFetcher.__test__;
    const mockHeaders = { Authorization: 'Bearer mock-token' };

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('fetchSecuritiesWithPrices fetches sector 58 once', async () => {
        const mockAxiosGet = jest.fn().mockResolvedValue({
            data: [
                { symbol: 'NABIL', difference: 1.5, volume: 1000, turnover: 500000, totalTrades: 50 }
            ]
        });
        const fetchMissingSecuritiesFn = jest.fn().mockResolvedValue([]);

        await fetchSecuritiesWithPrices('mock-token', [], {
            createHeadersFn: () => mockHeaders,
            nepseAxiosClient: { get: mockAxiosGet },
            baseUrl: 'http://mock-base-url',
            httpsAgent: {},
            transformSecurityFn: (security) => security,
            isKnownSymbolFn: () => true,
            fetchMissingSecuritiesFn
        });

        expect(mockAxiosGet).toHaveBeenCalled();
        expect(mockAxiosGet).toHaveBeenCalledWith(
            expect.stringContaining('/api/nots/securityDailyTradeStat/58'),
            expect.objectContaining({
                headers: mockHeaders,
                timeout: 10000
            })
        );
    });

    it('fetchSecuritiesWithPrices handles sector fetch failure gracefully', async () => {
        const mockAxiosGet = jest.fn().mockRejectedValueOnce(new Error('fail'));
        const fetchMissingSecuritiesFn = jest.fn().mockResolvedValue([]);

        const result = await fetchSecuritiesWithPrices('mock-token', [], {
            createHeadersFn: () => mockHeaders,
            nepseAxiosClient: { get: mockAxiosGet },
            baseUrl: 'http://mock-base-url',
            httpsAgent: {},
            transformSecurityFn: (security) => security,
            isKnownSymbolFn: () => true,
            fetchMissingSecuritiesFn
        });

        expect(mockAxiosGet).toHaveBeenCalled();
        expect(result).toEqual([]);
    });

    it('fetchSecuritiesWithPrices trusts official Equity instrument type over static symbols', async () => {
        const mockAxiosGet = jest.fn().mockResolvedValue({
            data: [
                { symbol: 'NABIL' },
                { symbol: 'C30MF' },
                { symbol: 'SPDL' }
            ]
        });
        const fetchMissingSecuritiesFn = jest.fn().mockResolvedValue([]);

        const result = await fetchSecuritiesWithPrices('mock-token', [
            { symbol: 'NABIL', status: 'A', instrumentType: 'Equity' },
            { symbol: 'C30MF', status: 'A', instrumentType: 'Mutual Funds' },
            { symbol: 'SPDL', status: 'A', instrumentType: 'Equity' }
        ], {
            createHeadersFn: () => mockHeaders,
            nepseAxiosClient: { get: mockAxiosGet },
            baseUrl: 'http://mock-base-url',
            httpsAgent: {},
            transformSecurityFn: (security) => security,
            isKnownSymbolFn: () => false,
            fetchMissingSecuritiesFn
        });

        expect(result.map(s => s.symbol)).toEqual(['NABIL', 'SPDL']);
        expect(result.every(s => s.isOrdinaryShare)).toBe(true);
    });
});
