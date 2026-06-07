const express = require('express');
const request = require('supertest');
const { errorHandler } = require('../../src/middleware/errorHandler');

const mockRepository = {
    getAiSummaryStatus: jest.fn(),
    getLatestStockSummary: jest.fn(),
    getStockSummaries: jest.fn(),
    getMarketSummaries: jest.fn()
};

jest.mock('../../src/services/ai/summaryRepository', () => mockRepository);
jest.mock('../../src/services/scheduler/aiSummaryScheduler', () => ({
    getStatus: jest.fn(() => ({
        enabled: false,
        running: false,
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        dailyBudgetUsd: 0.50,
        scheduledJobs: 0,
        lastRun: { error: 'provider stack trace' },
        lastError: 'secret provider detail'
    }))
}));
jest.mock('../../src/middleware/rateLimiter', () => ({
    adminLimiter: (req, res, next) => next()
}));
jest.mock('../../src/middleware/auth', () => ({
    requireAdminKey: (req, res, next) => next()
}));
jest.mock('../../src/services/utils/logger', () => ({
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
}));

const app = express();
app.use(express.json());
app.use('/api/ai-summaries', require('../../src/routes/aiSummaries'));
app.use(errorHandler);

describe('AI summary route hardening', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockRepository.getAiSummaryStatus.mockResolvedValue({
            lastRun: { error: 'database error detail' },
            stockSummaryCount: 3,
            marketSummaryCount: 2
        });
        mockRepository.getLatestStockSummary.mockResolvedValue({
            id: 9,
            symbol: 'NABIL',
            periodType: 'HOURLY',
            periodStart: '2026-06-06T10:00:00.000Z',
            summary: 'Stable',
            sentiment: 'neutral',
            confidence: 0.8,
            drivers: [],
            risks: [],
            inputHash: 'secret-input-hash',
            model: 'deepseek-v4-flash',
            promptTokens: 100,
            completionTokens: 50,
            estimatedCostUsd: 0.01,
            runId: 7
        });
        mockRepository.getStockSummaries.mockResolvedValue([{
            id: 9,
            symbol: 'NABIL',
            periodType: 'HOURLY',
            periodStart: '2026-06-06T10:00:00.000Z',
            summary: 'Stable',
            inputHash: 'secret-input-hash',
            model: 'deepseek-v4-flash',
            promptTokens: 100
        }]);
        mockRepository.getMarketSummaries.mockResolvedValue([{
            id: 4,
            periodType: 'DAILY',
            periodStart: '2026-06-06T00:00:00.000Z',
            summary: 'Market stable',
            inputHash: 'market-input-hash',
            model: 'deepseek-v4-flash',
            estimatedCostUsd: 0.01
        }]);
    });

    it('redacts provider and run error details from public status', async () => {
        const res = await request(app)
            .get('/api/ai-summaries/status')
            .expect(200);

        expect(res.body.data.scheduler).toEqual({
            enabled: false,
            running: false,
            scheduledJobs: 0
        });
        expect(res.body.data.summaries).toEqual({
            stockSummaryCount: 3,
            marketSummaryCount: 2
        });
        expect(JSON.stringify(res.body)).not.toContain('deepseek');
        expect(JSON.stringify(res.body)).not.toContain('provider stack trace');
    });

    it('rejects malformed stock summary symbols before repository lookup', async () => {
        const res = await request(app)
            .get('/api/ai-summaries/stocks/..%2Fsecret')
            .expect(400);

        expect(res.body.error.message).toContain('Invalid symbol');
        expect(mockRepository.getStockSummaries).not.toHaveBeenCalled();
    });

    it('clamps stock summary limits', async () => {
        await request(app)
            .get('/api/ai-summaries/stocks/NABIL?limit=999999')
            .expect(200);

        expect(mockRepository.getStockSummaries).toHaveBeenCalledWith('NABIL', {
            periodType: 'HOURLY',
            limit: 168
        });
    });

    it('rejects repeated stock summary limits before repository lookup', async () => {
        const res = await request(app)
            .get('/api/ai-summaries/stocks/NABIL?limit=10&limit=20')
            .expect(400);

        expect(res.body.error.message).toBe('limit must be a single integer');
        expect(mockRepository.getStockSummaries).not.toHaveBeenCalled();
    });

    it('rejects malformed admin job values before dispatching workers', async () => {
        const res = await request(app)
            .post('/api/ai-summaries/admin/run')
            .send({ job: ['market'] })
            .expect(400);

        expect(res.body.error.message).toBe('job must be stock or market');
    });

    it('redacts internal stock summary generation metadata', async () => {
        const res = await request(app)
            .get('/api/ai-summaries/stocks/NABIL/latest')
            .expect(200);

        expect(res.body.data.summary).toBe('Stable');
        expect(JSON.stringify(res.body)).not.toContain('secret-input-hash');
        expect(JSON.stringify(res.body)).not.toContain('deepseek-v4-flash');
        expect(JSON.stringify(res.body)).not.toContain('promptTokens');
        expect(JSON.stringify(res.body)).not.toContain('runId');
    });

    it('redacts internal market summary generation metadata', async () => {
        const res = await request(app)
            .get('/api/ai-summaries/market')
            .expect(200);

        expect(res.body.data[0].summary).toBe('Market stable');
        expect(JSON.stringify(res.body)).not.toContain('market-input-hash');
        expect(JSON.stringify(res.body)).not.toContain('estimatedCostUsd');
    });
});
