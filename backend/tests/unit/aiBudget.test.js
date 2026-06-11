const mockRepository = {
    getEstimatedCostSince: jest.fn()
};

jest.mock('../../src/services/ai/summaryRepository', () => mockRepository);

const { enforceDailyBudget, getDailyBudgetState, normalizeBudgetUsd } = require('../../src/services/ai/aiBudget');

describe('AI daily budget guard', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('does not enforce a zero budget', async () => {
        const state = await getDailyBudgetState({ dailyBudgetUsd: 0 });

        expect(state.enforced).toBe(false);
        expect(state.allowed).toBe(true);
        expect(mockRepository.getEstimatedCostSince).not.toHaveBeenCalled();
    });

    it('blocks work once spent cost reaches the configured daily budget', async () => {
        mockRepository.getEstimatedCostSince.mockResolvedValue(0.5);

        const state = await enforceDailyBudget({
            dailyBudgetUsd: 0.5
        }, {
            now: new Date('2026-06-07T10:15:00.000Z')
        });

        expect(state.allowed).toBe(false);
        expect(state.reason).toBe('budget-exceeded');
        expect(state.remainingUsd).toBe(0);
        expect(mockRepository.getEstimatedCostSince).toHaveBeenCalledWith(expect.any(Date));
    });

    it('normalizes invalid budget values safely', () => {
        expect(normalizeBudgetUsd('bad')).toBe(0);
        expect(normalizeBudgetUsd(-2)).toBe(0);
        expect(normalizeBudgetUsd('0.25')).toBe(0.25);
    });
});
