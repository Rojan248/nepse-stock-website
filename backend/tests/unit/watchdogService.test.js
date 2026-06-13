describe('WatchdogService database lifecycle', () => {
    beforeEach(() => {
        jest.resetModules();
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.resetModules();
    });

    it('uses the shared Prisma connection instead of creating a standalone client', async () => {
        const findFirst = jest.fn().mockResolvedValue({
            timestamp: new Date('2026-06-13T00:00:00.000Z'),
            nepseIndex: 2500,
            totalTurnover: 100000,
            totalTransactions: 1000,
            totalVolume: 50000,
            advancedCompanies: 80,
            declinedCompanies: 40,
            unchangedCompanies: 20
        });
        const prisma = {
            marketSummary: { findFirst },
            stock: { findMany: jest.fn() },
            $transaction: jest.fn()
        };
        const PrismaClient = jest.fn(() => {
            throw new Error('WatchdogService must use the shared prisma singleton');
        });

        jest.doMock('@prisma/client', () => ({ PrismaClient }));
        jest.doMock('../../src/services/database/connection', () => ({ prisma }));
        jest.doMock('../../src/services/utils/logger', () => ({
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn()
        }));
        jest.doMock('../../src/services/watchdog/providers/MerolaganiProvider', () => ({}));
        jest.doMock('../../src/services/watchdog/providers/NepseAlphaProvider', () => ({}));
        jest.doMock('../../src/services/watchdog/providers/ShareSansarProvider', () => ({}));
        jest.doMock('../../src/services/dataFetcher', () => ({
            fetchPreviousTradingDayData: jest.fn()
        }));
        jest.doMock('../../src/services/utils/updateLock', () => ({
            acquireLock: jest.fn(),
            releaseLock: jest.fn()
        }));

        const watchdogService = require('../../src/services/watchdog/WatchdogService');
        const localData = await watchdogService.getLocalData();

        expect(PrismaClient).not.toHaveBeenCalled();
        expect(findFirst).toHaveBeenCalledWith({ orderBy: { timestamp: 'desc' } });
        expect(localData.source).toBe('Local Database');
        expect(localData.data.breadth).toEqual({
            advanced: 80,
            declined: 40,
            unchanged: 20
        });
    });
});
