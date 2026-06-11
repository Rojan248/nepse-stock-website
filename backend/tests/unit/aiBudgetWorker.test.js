const mockRepository = {
    getEstimatedCostSince: jest.fn(),
    createRun: jest.fn(),
    finishRun: jest.fn()
};

const mockLock = {
    acquireAiLock: jest.fn(),
    releaseAiLock: jest.fn()
};

const mockPayloadBuilder = {
    buildStockSummaryPayload: jest.fn(),
    buildMarketSummaryPayload: jest.fn()
};

jest.mock('../../src/services/ai/summaryRepository', () => mockRepository);
jest.mock('../../src/services/ai/aiSummaryLock', () => mockLock);
jest.mock('../../src/services/ai/summaryPayloadBuilder', () => mockPayloadBuilder);
jest.mock('../../src/services/utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
}));

const { runStockSummaries } = require('../../src/services/ai/stockSummaryWorker');
const { runMarketSummary } = require('../../src/services/ai/marketSummaryWorker');

describe('AI worker budget enforcement', () => {
    const config = {
        enabled: true,
        dailyBudgetUsd: 0.5,
        stockBatchSize: 10,
        reuseUnchangedSummaries: true
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockLock.acquireAiLock.mockResolvedValue(true);
        mockLock.releaseAiLock.mockResolvedValue(undefined);
        mockRepository.getEstimatedCostSince.mockResolvedValue(0.5);
    });

    it('skips stock generation without building payloads or calling the provider when budget is spent', async () => {
        const provider = {
            name: 'mock',
            model: 'test-model',
            generateStockSummaries: jest.fn()
        };

        const result = await runStockSummaries({ config, provider });

        expect(result).toMatchObject({ skipped: true, reason: 'budget-exceeded' });
        expect(mockPayloadBuilder.buildStockSummaryPayload).not.toHaveBeenCalled();
        expect(provider.generateStockSummaries).not.toHaveBeenCalled();
        expect(mockRepository.createRun).not.toHaveBeenCalled();
        expect(mockLock.releaseAiLock).toHaveBeenCalledWith('stock_HOURLY');
    });

    it('skips market generation without building payloads or calling the provider when budget is spent', async () => {
        const provider = {
            name: 'mock',
            model: 'test-model',
            generateMarketSummary: jest.fn()
        };

        const result = await runMarketSummary({ config, provider });

        expect(result).toMatchObject({ skipped: true, reason: 'budget-exceeded' });
        expect(mockPayloadBuilder.buildMarketSummaryPayload).not.toHaveBeenCalled();
        expect(provider.generateMarketSummary).not.toHaveBeenCalled();
        expect(mockRepository.createRun).not.toHaveBeenCalled();
        expect(mockLock.releaseAiLock).toHaveBeenCalledWith('market_DAILY');
    });
});
