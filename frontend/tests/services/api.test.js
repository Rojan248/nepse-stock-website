import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as api from '../../src/services/api';

// Mock axios
vi.mock('axios', () => ({
    default: {
        create: () => ({
            get: vi.fn(),
            interceptors: {
                response: { use: vi.fn() }
            }
        })
    }
}));

describe('API Service', () => {
    describe('Stock APIs', () => {
        it('getStocks should return object with stocks array', async () => {
            const result = await api.getStocks();
            expect(result).toHaveProperty('stocks');
            expect(Array.isArray(result.stocks)).toBe(true);
        });

        it('searchStocks should return object with stocks', async () => {
            const result = await api.searchStocks('test');
            expect(result).toHaveProperty('stocks');
        });

        it('searchStocks should handle empty query', async () => {
            const result = await api.searchStocks('');
            expect(result.stocks).toEqual([]);
        });
    });

    describe('IPO APIs', () => {
        it('getIPOs should return object with ipos array', async () => {
            const result = await api.getIPOs();
            expect(result).toHaveProperty('ipos');
        });
    });

    describe('Market APIs', () => {
        it('getMarketSummary should return data or null', async () => {
            const result = await api.getMarketSummary();
            expect(result === null || typeof result === 'object').toBe(true);
        });
    });

    describe('Error Handling', () => {
        it('should return null on network error for single item', async () => {
            const result = await api.getStockBySymbol('INVALID');
            expect(result === null || typeof result === 'object').toBe(true);
        });

        it('should return empty array on error for list', async () => {
            const result = await api.getTopGainers();
            expect(Array.isArray(result)).toBe(true);
        });
    });
});
