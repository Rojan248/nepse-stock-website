const rewire = require('rewire');
const path = require('path');
let marketMetaFetcher;

describe('marketMetaFetcher Unit Tests', () => {
    let mockLogger;

    beforeEach(() => {
        jest.resetModules();
        jest.useFakeTimers();

        marketMetaFetcher = rewire(path.join(__dirname, '../../src/services/fetchers/marketMetaFetcher'));

        // Explicitly inject the fake timers into the rewired module
        marketMetaFetcher.__set__('setTimeout', setTimeout);
        marketMetaFetcher.__set__('clearTimeout', clearTimeout);

        mockLogger = {
            debug: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn()
        };
        marketMetaFetcher.__set__('logger', mockLogger);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    const getPrivate = (name) => marketMetaFetcher.__get__(name);

    const delayedSource = (name, delayMs, parseResult) => ({
        name,
        fetch: jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({}), delayMs))),
        parse: jest.fn().mockReturnValue(parseResult)
    });

    const failingSource = (name, message) => ({
        name,
        fetch: jest.fn().mockRejectedValue(new Error(message)),
        parse: jest.fn()
    });

    const timeoutSource = (name) => ({
        name,
        fetch: jest.fn().mockImplementation(() => new Promise(() => {})),
        parse: jest.fn()
    });

    const runMarketMetaSources = (sources, advanceMs = 200) => {
        marketMetaFetcher.__set__('MARKET_META_SOURCES', sources);
        const promise = getPrivate('fetchLiveMarketMeta')();
        if (advanceMs != null) jest.advanceTimersByTime(advanceMs);
        return promise;
    };

    describe('fetchLiveMarketMeta', () => {
        it('should return the fastest valid result', async () => {
            const result = await runMarketMetaSources([
                delayedSource('Slow Valid', 100, { data: 'slow' }),
                delayedSource('Fast Valid', 10, { data: 'fast' })
            ]);

            expect(result).toEqual({ data: 'fast' });
        });

        it('should ignore invalid parse results even if faster', async () => {
            const result = await runMarketMetaSources([
                delayedSource('Fast Invalid', 10, null),
                delayedSource('Slow Valid', 50, { data: 'valid' })
            ]);

            expect(result).toEqual({ data: 'valid' });
            expect(mockLogger.debug).toHaveBeenCalledWith('Fast Invalid returned invalid data');
        });

        it('should return null when all sources fail', async () => {
            const result = await runMarketMetaSources([
                failingSource('Source 1', 'Fail 1'),
                failingSource('Source 2', 'Fail 2')
            ]);

            expect(result).toBeNull();
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('All 2 market meta sources failed'));
        });

        it('should handle timeout correctly', async () => {
            const result = await runMarketMetaSources([timeoutSource('Timeout Source')], 7000);

            expect(result).toBeNull();
            expect(mockLogger.debug).toHaveBeenCalledWith('Timeout waiting for Timeout Source');
        });
    });
});
