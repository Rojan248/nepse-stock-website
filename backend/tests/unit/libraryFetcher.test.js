const rewire = require('rewire');
const libraryFetcher = rewire('../../src/services/scrapers/libraryFetcher');

// Mock dependencies
const mockAxiosGet = jest.fn();
const mockHeaders = {};

// Setup mocks via rewire
libraryFetcher.__set__('nepseAxios', {
    get: mockAxiosGet
});
libraryFetcher.__set__('createHeaders', () => mockHeaders);
libraryFetcher.__set__('BASE_URL', 'http://mock-base-url');
libraryFetcher.__set__('nepseHttpsAgent', {});
libraryFetcher.__set__('transformSecurity', (s) => s); // Simple pass-through
libraryFetcher.__set__('isEquitySecurity', () => true);
libraryFetcher.__set__('fetchMissingSecurities', async () => []); // Mock missing securities fetch

describe('Library Fetcher (rewired)', () => {
    const fetchSecuritiesWithPrices = libraryFetcher.__get__('fetchSecuritiesWithPrices');

    beforeEach(() => {
        mockAxiosGet.mockReset();
        mockAxiosGet.mockResolvedValue({ data: [] });
    });

    test('fetchSecuritiesWithPrices fetches sector 58', async () => {
        const token = 'mock-token';
        const companyList = [];

        await fetchSecuritiesWithPrices(token, companyList);

        // Verify the call to sector 58
        expect(mockAxiosGet).toHaveBeenCalledWith(
            expect.stringContaining('/api/nots/securityDailyTradeStat/58'),
            expect.objectContaining({
                headers: mockHeaders,
                timeout: 10000
            })
        );
    });
});
