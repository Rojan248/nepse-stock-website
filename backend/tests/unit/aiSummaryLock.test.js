const mockPrisma = {
    lock: {
        create: jest.fn(),
        updateMany: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn()
    }
};

jest.mock('../../src/services/database/connection', () => ({
    prisma: mockPrisma
}));

jest.mock('../../src/services/utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
}));

const { acquireAiLock, isLockActive, isLockHeldByOther } = require('../../src/services/ai/aiSummaryLock');

describe('AI summary lock', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('treats any unexpired lock as active, including the same owner', () => {
        const now = new Date('2026-06-07T10:00:00.000Z');
        const existing = {
            owner: 'stock_HOURLY',
            expiresAt: new Date('2026-06-07T10:05:00.000Z')
        };

        expect(isLockActive(existing, now)).toBe(true);
        expect(isLockHeldByOther(existing, 'stock_HOURLY', now)).toBe(false);
    });

    it('does not acquire a duplicate active lock after a unique-key collision', async () => {
        mockPrisma.lock.create.mockRejectedValue({ code: 'P2002' });
        mockPrisma.lock.updateMany.mockResolvedValue({ count: 0 });

        await expect(acquireAiLock('stock_HOURLY')).resolves.toBe(false);

        expect(mockPrisma.lock.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                id: 'AI_SUMMARY_stock_HOURLY',
                expiresAt: expect.objectContaining({ lte: expect.any(Date) })
            })
        }));
    });

    it('acquires an expired lock with a conditional refresh', async () => {
        mockPrisma.lock.create.mockRejectedValue({ code: 'P2002' });
        mockPrisma.lock.updateMany.mockResolvedValue({ count: 1 });

        await expect(acquireAiLock('stock_HOURLY')).resolves.toBe(true);
    });
});
