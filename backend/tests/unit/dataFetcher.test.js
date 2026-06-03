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

    const getPrivate = (name) => dataFetcher.__get__(name);

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
        dataFetcher.__set__('MARKET_META_SOURCES', sources);
        const promise = getPrivate('fetchLiveMarketMeta')();
        if (advanceMs != null) jest.advanceTimersByTime(advanceMs);
        return promise;
    };

    const recordAttempt = (...args) => getPrivate('recordSourceAttempt')(...args);

    const getSourceStats = (source) => getPrivate('sourceStats')[source];

    const expectSourceStats = (source, expected) => {
        expect(getSourceStats(source)).toMatchObject(expected);
    };

    const setExistingPrices = (pricesBySymbol) => {
        dataFetcher.__set__('prisma', {
            stock: {
                findMany: jest.fn().mockResolvedValue(
                    Object.entries(pricesBySymbol).map(([symbol, lastTradedPrice]) => ({ symbol, lastTradedPrice }))
                )
            }
        });
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

    describe('recordSourceAttempt', () => {
        it('should record a successful source attempt', () => {
            recordAttempt('library', 'success', 42);

            expectSourceStats('library', {
                attempts: 1,
                successes: 1,
                failures: 0,
                invalid: 0,
                lastDurationMs: 42,
                lastError: null
            });
            expect(getSourceStats('library').lastSuccessAt).toBe(getSourceStats('library').lastAttemptAt);
        });

        it('should record invalid data without counting it as a source failure', () => {
            recordAttempt('proxy', 'invalid', 11, new Error('invalid data'));

            expectSourceStats('proxy', {
                attempts: 1,
                successes: 0,
                failures: 0,
                invalid: 1,
                lastDurationMs: 11,
                lastError: 'invalid data'
            });
        });

        it('should count rate limit failures separately', () => {
            recordAttempt('custom', 'failure', 100, new Error('HTTP 429 Too Many Requests'));

            expectSourceStats('custom', {
                attempts: 1,
                successes: 0,
                failures: 1,
                invalid: 0,
                lastDurationMs: 100,
                lastError: 'HTTP 429 Too Many Requests'
            });
            expect(dataFetcher.__get__('rateLimitEvents')).toBe(1);
        });
    });

    describe('hasPriceAnomalies', () => {
        it('should return false when incoming prices are within the anomaly threshold', async () => {
            setExistingPrices({ NABIL: 100 });

            const result = await getPrivate('hasPriceAnomalies')([{ symbol: 'NABIL', lastTradedPrice: 110 }]);

            expect(result).toBe(false);
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        it('should return true when one stock moves beyond the anomaly threshold', async () => {
            setExistingPrices({ NABIL: 100 });

            const result = await getPrivate('hasPriceAnomalies')([{ symbol: 'NABIL', lastTradedPrice: 120 }]);

            expect(result).toBe(true);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('NABIL moved 20.0%'));
        });

        it('should fail safe when database lookup fails', async () => {
            dataFetcher.__set__('prisma', {
                stock: {
                    findMany: jest.fn().mockRejectedValue(new Error('DB down'))
                }
            });

            const result = await getPrivate('hasPriceAnomalies')([{ symbol: 'NABIL', lastTradedPrice: 120 }]);

            expect(result).toBe(false);
            expect(mockLogger.error).toHaveBeenCalledWith('Anomaly detection failed: DB down');
        });
    });
});
