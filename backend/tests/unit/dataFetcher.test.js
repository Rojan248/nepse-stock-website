const rewire = require('rewire');
const path = require('path');
let dataFetcher;

describe('dataFetcher Unit Tests', () => {
    let mockLogger;

    beforeEach(() => {
        jest.resetModules();
        jest.useFakeTimers();

        dataFetcher = rewire(path.join(__dirname, '../../src/services/dataFetcher'));

        // Explicitly inject the fake timers into the rewired module
        dataFetcher.__set__('setTimeout', setTimeout);
        dataFetcher.__set__('clearTimeout', clearTimeout);

        mockLogger = {
            debug: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn()
        };
        dataFetcher.__set__('logger', mockLogger);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('fetchLiveMarketMeta', () => {
        it('should return the fastest valid result', async () => {
             const fetchLiveMarketMeta = dataFetcher.__get__('fetchLiveMarketMeta');
             const mockSources = [
                {
                    name: 'Slow Valid',
                    fetch: jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({}), 100))),
                    parse: jest.fn().mockReturnValue({ data: 'slow' })
                },
                {
                    name: 'Fast Valid',
                    fetch: jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({}), 10))),
                    parse: jest.fn().mockReturnValue({ data: 'fast' })
                }
            ];
            dataFetcher.__set__('MARKET_META_SOURCES', mockSources);

            const promise = fetchLiveMarketMeta();
            jest.advanceTimersByTime(200);
            const result = await promise;
            expect(result).toEqual({ data: 'fast' });
        });

        it('should ignore invalid parse results even if faster', async () => {
            const fetchLiveMarketMeta = dataFetcher.__get__('fetchLiveMarketMeta');
            const mockSources = [
                {
                    name: 'Fast Invalid',
                    fetch: jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({}), 10))),
                    parse: jest.fn().mockReturnValue(null) // Invalid
                },
                {
                    name: 'Slow Valid',
                    fetch: jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({}), 50))),
                    parse: jest.fn().mockReturnValue({ data: 'valid' })
                }
            ];
            dataFetcher.__set__('MARKET_META_SOURCES', mockSources);

            const promise = fetchLiveMarketMeta();
            jest.advanceTimersByTime(200);
            const result = await promise;
            expect(result).toEqual({ data: 'valid' });
            expect(mockLogger.debug).toHaveBeenCalledWith('Fast Invalid returned invalid data');
        });

        it('should return null when all sources fail', async () => {
            const fetchLiveMarketMeta = dataFetcher.__get__('fetchLiveMarketMeta');
            const mockSources = [
                {
                    name: 'Source 1',
                    fetch: jest.fn().mockRejectedValue(new Error('Fail 1')),
                    parse: jest.fn()
                },
                {
                    name: 'Source 2',
                    fetch: jest.fn().mockRejectedValue(new Error('Fail 2')),
                    parse: jest.fn()
                }
            ];
            dataFetcher.__set__('MARKET_META_SOURCES', mockSources);

            const result = await fetchLiveMarketMeta();
            expect(result).toBeNull();
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('All 2 market meta sources failed'));
        });

        it('should handle timeout correctly', async () => {
            const fetchLiveMarketMeta = dataFetcher.__get__('fetchLiveMarketMeta');
            const mockSources = [
                {
                    name: 'Timeout Source',
                    fetch: jest.fn().mockImplementation(() => new Promise(() => {})), // Never resolves
                    parse: jest.fn()
                }
            ];
            dataFetcher.__set__('MARKET_META_SOURCES', mockSources);

            const promise = fetchLiveMarketMeta();

            // Advance time to trigger timeout
            jest.advanceTimersByTime(7000);

            const result = await promise;
            expect(result).toBeNull(); // Should fail due to timeout and return null
            expect(mockLogger.debug).toHaveBeenCalledWith('Timeout waiting for Timeout Source');
        });
    });
});
