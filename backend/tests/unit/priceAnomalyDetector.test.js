const rewire = require('rewire');
const path = require('path');
let priceAnomalyDetector;

describe('priceAnomalyDetector Unit Tests', () => {
    let mockLogger;

    beforeEach(() => {
        jest.resetModules();

        priceAnomalyDetector = rewire(path.join(__dirname, '../../src/services/priceAnomalyDetector'));

        mockLogger = {
            debug: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn()
        };
        priceAnomalyDetector.__set__('logger', mockLogger);
    });

    const getPrivate = (name) => priceAnomalyDetector.__get__(name);

    const setExistingPrices = (pricesBySymbol) => {
        priceAnomalyDetector.__set__('prisma', {
            stock: {
                findMany: jest.fn().mockResolvedValue(
                    Object.entries(pricesBySymbol).map(([symbol, lastTradedPrice]) => ({ symbol, lastTradedPrice }))
                )
            }
        });
    };

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
            priceAnomalyDetector.__set__('prisma', {
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
