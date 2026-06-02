const { estimateDeepSeekCost, normalizeUsage } = require('../../src/services/ai/costEstimator');
const { stableJson, createInputHash } = require('../../src/services/ai/stableHash');
const { chunk, normalizeProviderItem } = require('../../src/services/ai/stockSummaryWorker');
const { summarizeSectors } = require('../../src/services/ai/summaryPayloadBuilder');
const { isTradingDateString } = require('../../src/services/ai/tradingCalendar');

jest.mock('../../src/services/utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
}));

describe('AI summary scaffold', () => {
    describe('costEstimator', () => {
        it('estimates DeepSeek V4 Flash cost from cache-aware usage', () => {
            const cost = estimateDeepSeekCost({
                prompt_cache_hit_tokens: 100000,
                prompt_cache_miss_tokens: 10000,
                completion_tokens: 5000
            });

            expect(cost).toBeCloseTo(0.00308, 8);
        });

        it('normalizes provider usage fields', () => {
            expect(normalizeUsage({
                prompt_cache_hit_tokens: 10,
                prompt_cache_miss_tokens: 20,
                completion_tokens: 30
            })).toEqual({
                promptTokens: 30,
                completionTokens: 30,
                promptCacheHitTokens: 10,
                promptCacheMissTokens: 20
            });
        });
    });

    describe('stable hashing', () => {
        it('creates the same hash for equivalent object key orders', () => {
            expect(stableJson({ b: 2, a: 1 })).toBe(stableJson({ a: 1, b: 2 }));
            expect(createInputHash({ b: 2, a: 1 })).toBe(createInputHash({ a: 1, b: 2 }));
        });
    });

    describe('stock worker helpers', () => {
        it('chunks stocks into bounded batches', () => {
            expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
        });

        it('fills safe defaults for missing provider items', () => {
            expect(normalizeProviderItem({ symbol: 'NABIL' }, null)).toMatchObject({
                symbol: 'NABIL',
                sentiment: 'neutral',
                drivers: [],
                risks: []
            });
        });
    });

    describe('market payload helpers', () => {
        it('summarizes sector breadth from compact stock snapshots', () => {
            const sectors = summarizeSectors([
                { sector: 'Banking', changePercent: 1, turnover: 100 },
                { sector: 'Banking', changePercent: -1, turnover: 50 },
                { sector: 'Hydro', changePercent: 0, turnover: 25 }
            ]);

            expect(sectors[0]).toMatchObject({ sector: 'Banking', count: 2, adv: 1, dec: 1, unchanged: 0, turnover: 150 });
            expect(sectors[1]).toMatchObject({ sector: 'Hydro', count: 1, unchanged: 1 });
        });

        it('treats Fridays, Saturdays, and configured holidays as non-trading days', () => {
            expect(isTradingDateString('2026-05-28')).toBe(true);
            expect(isTradingDateString('2026-05-29')).toBe(false);
            expect(isTradingDateString('2026-05-30')).toBe(false);
        });
    });
});
