const marketOperations = require('../../src/services/database/marketOperations');
const stockOperations = require('../../src/services/database/stockOperations');

jest.mock('../../src/services/database/stockOperations');

describe('marketOperations', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getTopMovers', () => {
        it('should aggregate top movers from stockOperations', async () => {
            const mockStocks = [{ symbol: 'TEST' }];
            stockOperations.getTopTurnover.mockResolvedValue(mockStocks);
            stockOperations.getTopTransactions.mockResolvedValue(mockStocks);
            stockOperations.getTopVolume.mockResolvedValue(mockStocks);
            stockOperations.getTopGainers.mockResolvedValue(mockStocks);
            stockOperations.getTopLosers.mockResolvedValue(mockStocks);
            stockOperations.getLastStockUpdateTime.mockResolvedValue('2023-01-01T00:00:00.000Z');

            const result = await marketOperations.getTopMovers();

            expect(result.turnover).toEqual(mockStocks);
            expect(result.trade).toEqual(mockStocks);
            expect(result.volume).toEqual(mockStocks);
            expect(result.gainers).toEqual(mockStocks);
            expect(result.losers).toEqual(mockStocks);
            expect(result.updatedAt).toEqual('2023-01-01T00:00:00.000Z');

            expect(stockOperations.getTopTurnover).toHaveBeenCalledWith(10);
            expect(stockOperations.getTopTransactions).toHaveBeenCalledWith(10);
            expect(stockOperations.getTopVolume).toHaveBeenCalledWith(10);
            expect(stockOperations.getTopGainers).toHaveBeenCalledWith(10);
            expect(stockOperations.getTopLosers).toHaveBeenCalledWith(10);
            expect(stockOperations.getLastStockUpdateTime).toHaveBeenCalled();
        });

        it('should handle errors gracefully', async () => {
            stockOperations.getTopTurnover.mockRejectedValue(new Error('DB Error'));

            const result = await marketOperations.getTopMovers();

            expect(result.turnover).toEqual([]);
            expect(result.trade).toEqual([]);
            expect(result.volume).toEqual([]);
            expect(result.gainers).toEqual([]);
            expect(result.losers).toEqual([]);
            expect(result.updatedAt).toBeNull();
        });
    });

    describe('saveTopMovers', () => {
        it('should be a no-op', async () => {
            const result = await marketOperations.saveTopMovers({});
            expect(result).toEqual({ success: true });
        });
    });
});
