const mockRepository = {
    getEstimatedCostSince: jest.fn(),
    createRun: jest.fn(),
    finishRun: jest.fn(),
    findReusableStockSummary: jest.fn(),
    upsertStockSummary: jest.fn()
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
        mockRepository.createRun.mockResolvedValue({ id: 1 });
        mockRepository.findReusableStockSummary.mockResolvedValue(null);
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

    it('stops stock generation before the next paid provider call would exceed budget', async () => {
        mockRepository.getEstimatedCostSince.mockResolvedValue(0.49);
        mockPayloadBuilder.buildStockSummaryPayload.mockResolvedValue({
            market: null,
            stocks: [{ symbol: 'NABIL', inputHash: 'hash', changePercent: 1 }],
            periodType: 'HOURLY',
            periodStart: new Date('2026-06-07T10:00:00.000Z'),
            periodEnd: new Date('2026-06-07T11:00:00.000Z')
        });
        const provider = {
            name: 'deepseek',
            model: 'test-model',
            generateStockSummaries: jest.fn()
        };

        const result = await runStockSummaries({
            config: {
                ...config,
                dailyBudgetUsd: 0.5,
                maxStockOutputTokens: 100000
            },
            provider
        });

        expect(result).toMatchObject({ reason: 'budget-exceeded', generatedStocks: 0 });
        expect(provider.generateStockSummaries).not.toHaveBeenCalled();
        expect(mockRepository.finishRun).toHaveBeenCalledWith(1, expect.objectContaining({
            status: 'BUDGET_STOPPED',
            generatedStocks: 0
        }));
    });

    it('stops market generation before a paid provider call would exceed budget', async () => {
        mockRepository.getEstimatedCostSince.mockResolvedValue(0.49);
        mockPayloadBuilder.buildMarketSummaryPayload.mockResolvedValue({
            market: { indexChangePercent: 1 },
            topGainers: [],
            topLosers: [],
            mostTraded: [],
            sectorBreadth: [],
            inputHash: 'hash'
        });
        const provider = {
            name: 'deepseek',
            model: 'test-model',
            generateMarketSummary: jest.fn()
        };

        const result = await runMarketSummary({
            config: {
                ...config,
                dailyBudgetUsd: 0.5,
                maxMarketOutputTokens: 100000
            },
            provider
        });

        expect(result).toMatchObject({ skipped: true, reason: 'budget-exceeded' });
        expect(provider.generateMarketSummary).not.toHaveBeenCalled();
        expect(mockRepository.createRun).not.toHaveBeenCalled();
    });
});
