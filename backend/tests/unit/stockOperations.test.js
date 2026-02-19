
jest.mock('../../src/services/database/connection', () => {
    const mockStock = {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        deleteMany: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
    };

    const mockPrisma = {
        stock: mockStock,
        $transaction: jest.fn((callback) => {
             if (typeof callback === 'function') {
                 // Pass a mock transaction client (which is just the prisma client in this mock)
                 return callback({ stock: mockStock });
             }
             return Promise.resolve(callback);
        }),
    };

    return { prisma: mockPrisma };
});

const stockOperations = require('../../src/services/database/stockOperations');
const { prisma } = require('../../src/services/database/connection');

describe('stockOperations', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getTopTurnover', () => {
        it('should fetch stocks sorted by turnover desc', async () => {
            prisma.stock.findMany.mockResolvedValue([]);
            await stockOperations.getTopTurnover(10);
            expect(prisma.stock.findMany).toHaveBeenCalledWith(expect.objectContaining({
                orderBy: { turnover: 'desc' },
                take: 10
            }));
        });
    });

    describe('getTopVolume', () => {
        it('should fetch stocks sorted by volume desc', async () => {
            prisma.stock.findMany.mockResolvedValue([]);
            await stockOperations.getTopVolume(10);
            expect(prisma.stock.findMany).toHaveBeenCalledWith(expect.objectContaining({
                orderBy: { volume: 'desc' },
                take: 10
            }));
        });
    });

    describe('getTopTransactions', () => {
        it('should fetch stocks sorted by totalTrades desc', async () => {
            prisma.stock.findMany.mockResolvedValue([]);
            await stockOperations.getTopTransactions(10);
            expect(prisma.stock.findMany).toHaveBeenCalledWith(expect.objectContaining({
                orderBy: { totalTrades: 'desc' },
                take: 10
            }));
        });
    });

    describe('getLastStockUpdateTime', () => {
        it('should return the latest updatedAt', async () => {
            const mockDate = new Date('2023-01-01T00:00:00.000Z');
            prisma.stock.findFirst.mockResolvedValue({ updatedAt: mockDate });

            const result = await stockOperations.getLastStockUpdateTime();

            expect(result).toEqual(mockDate.toISOString());
            expect(prisma.stock.findFirst).toHaveBeenCalledWith(expect.objectContaining({
                orderBy: { updatedAt: 'desc' },
                select: { updatedAt: true }
            }));
        });

        it('should return null if no stocks', async () => {
            prisma.stock.findFirst.mockResolvedValue(null);
            const result = await stockOperations.getLastStockUpdateTime();
            expect(result).toBeNull();
        });
    });
});
