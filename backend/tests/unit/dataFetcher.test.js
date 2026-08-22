const rewire = require('rewire');
const path = require('path');
let dataFetcher;

describe('dataFetcher Unit Tests', () => {
    let mockLogger;

    beforeEach(() => {
        jest.resetModules();

        dataFetcher = rewire(path.join(__dirname, '../../src/services/dataFetcher'));

        mockLogger = {
            debug: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn()
        };
        dataFetcher.__set__('logger', mockLogger);
    });

    const getPrivate = (name) => dataFetcher.__get__(name);

    const recordAttempt = (...args) => getPrivate('recordSourceAttempt')(...args);

    const getSourceStats = (source) => getPrivate('sourceStats')[source];

    const expectSourceStats = (source, expected) => {
        expect(getSourceStats(source)).toMatchObject(expected);
    };

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
});
