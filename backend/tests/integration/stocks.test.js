const request = require('supertest');
const express = require('express');

const mockNepseAxiosGet = jest.fn();

jest.mock('nepse-api-helper', () => ({
    nepseClient: {
        initialize: jest.fn().mockResolvedValue(undefined),
        getToken: jest.fn().mockResolvedValue('mock-token')
    },
    nepseAxios: {
        get: mockNepseAxiosGet
    },
    createHeaders: jest.fn(() => ({ Authorization: 'Bearer mock-token' })),
    BASE_URL: 'https://nepalstock.com.np'
}));

jest.mock('../../src/services/depthFetcher', () => ({
    getDepth: jest.fn().mockResolvedValue({ marketDepth: { buy: [], sell: [] }, floorsheet: [] })
}));

const stocksRouter = require('../../src/routes/stocks');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/stocks', stocksRouter);

// Mock the stock operations
jest.mock('../../src/services/database/stockOperations', () => ({
    getAllStocks: jest.fn().mockImplementation(({ compact } = {}) => {
        const stocks = [
            global.testUtils.mockStock,
            { ...global.testUtils.mockStock, symbol: 'TEST2', companyName: 'Test Company 2' }
        ];
        if (compact) {
            return Promise.resolve(stocks.map(s => {
                const { prices, trading, lastTradedPrice, openPrice, highPrice, lowPrice, percentageChange, timestamp, ...rest } = s;
                return rest;
            }));
        }
        return Promise.resolve(stocks);
    }),
    getStockBySymbol: jest.fn().mockImplementation((symbol) => {
        if (symbol === 'TEST') return Promise.resolve(global.testUtils.mockStock);
        return Promise.resolve(null);
    }),
    searchStocks: jest.fn().mockImplementation((query) => {
        if (query.toLowerCase().includes('test')) {
            return Promise.resolve([global.testUtils.mockStock]);
        }
        return Promise.resolve([]);
    }),
    getStocksBySector: jest.fn().mockImplementation((sector) => {
        if (sector.toLowerCase() === 'banking') {
            return Promise.resolve([global.testUtils.mockStock]);
        }
        return Promise.resolve([]);
    }),
    getStockCount: jest.fn().mockResolvedValue(2),
    getAllSectors: jest.fn().mockResolvedValue(['Banking', 'Insurance', 'Hydropower']),
    getTopGainers: jest.fn().mockResolvedValue([global.testUtils.mockStock]),
    getTopLosers: jest.fn().mockResolvedValue([{ ...global.testUtils.mockStock, change: -5, changePercent: -5 }]),
    getTopTraded: jest.fn().mockResolvedValue([global.testUtils.mockStock]),
    getUnchangedStocks: jest.fn().mockResolvedValue([global.testUtils.mockStock]),
    getRecentlyUpdated: jest.fn().mockResolvedValue([global.testUtils.mockStock]),
    cleanupInvalidStocks: jest.fn().mockResolvedValue({
        removed: 0,
        remaining: 1,
        removedSymbols: []
    })
}));

jest.mock('../../src/services/database/connection', () => ({
    prisma: {
        marketHistory: { findMany: jest.fn() },
        stockMetrics: { findMany: jest.fn() }
    }
}));

const stockOperations = require('../../src/services/database/stockOperations');
const depthFetcher = require('../../src/services/depthFetcher');
const { prisma } = require('../../src/services/database/connection');

describe('Stock API Endpoints', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockNepseAxiosGet.mockResolvedValue({ data: [{ symbol: 'NABIL' }] });
        prisma.marketHistory.findMany.mockResolvedValue([]);
        prisma.stockMetrics.findMany.mockResolvedValue([]);
    });

    describe('GET /api/stocks', () => {
        it('should return array of stocks', async () => {
            const res = await request(app).get('/api/stocks');
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
        });

        it('should support pagination with skip and limit', async () => {
            const res = await request(app).get('/api/stocks?skip=0&limit=10');
            expect(res.status).toBe(200);
            expect(res.body.pagination).toBeDefined();
        });

        it('should reject repeated pagination parameters before fetching stocks', async () => {
            const res = await request(app).get('/api/stocks?limit=10&limit=20');
            expect(res.status).toBe(400);
            expect(res.body.error.message).toBe('limit must be a single integer');
            expect(stockOperations.getAllStocks).not.toHaveBeenCalled();
        });

        it('should return correct response schema', async () => {
            const res = await request(app).get('/api/stocks');
            expect(res.body).toHaveProperty('success');
            expect(res.body).toHaveProperty('data');
            expect(res.body).toHaveProperty('count');
        });

        it('should return compact response when requested', async () => {
            const res = await request(app).get('/api/stocks?compact=true');
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            const stock = res.body.data[0];
            expect(stock).toHaveProperty('ltp');
            expect(stock).not.toHaveProperty('prices');
            expect(stock).not.toHaveProperty('lastTradedPrice');
            expect(stock).not.toHaveProperty('trading');
        });

        it('should reject repeated activeOnly booleans before fetching stocks', async () => {
            const res = await request(app).get('/api/stocks?activeOnly=true&activeOnly=true');
            expect(res.status).toBe(400);
            expect(res.body.error.message).toBe('activeOnly must be a single boolean');
            expect(stockOperations.getAllStocks).not.toHaveBeenCalled();
        });

        it('should reject invalid compact booleans before fetching stocks', async () => {
            const res = await request(app).get('/api/stocks?compact=maybe');
            expect(res.status).toBe(400);
            expect(res.body.error.message).toBe('compact must be true or false');
            expect(stockOperations.getAllStocks).not.toHaveBeenCalled();
        });
    });

    describe('GET /api/stocks/:symbol', () => {
        it('should return single stock for valid symbol', async () => {
            const res = await request(app).get('/api/stocks/TEST');
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.symbol).toBe('TEST');
        });

        it('should return 404 for non-existent symbol', async () => {
            const res = await request(app).get('/api/stocks/NOTEXIST');
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
        });

        it('should return stock with all required fields', async () => {
            const res = await request(app).get('/api/stocks/TEST');
            const stock = res.body.data;
            expect(stock).toHaveProperty('symbol');
            expect(stock).toHaveProperty('companyName');
            expect(stock).toHaveProperty('ltp');
            expect(stock).toHaveProperty('prices');
            expect(stock).toHaveProperty('volume');
        });

        it('should reject invalid symbol format', async () => {
            const res = await request(app).get('/api/stocks/TEST@123');
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error.message).toBe('Invalid symbol format');
        });
    });

    describe('GET /api/stocks/search', () => {
        it('should return matching stocks', async () => {
            const res = await request(app).get('/api/stocks/search?q=test');
            expect(res.status).toBe(200);
            expect(res.body.data.length).toBeGreaterThan(0);
        });

        it('should return empty array if no match', async () => {
            const res = await request(app).get('/api/stocks/search?q=xyz123');
            expect(res.status).toBe(200);
            expect(res.body.data).toEqual([]);
        });

        it('should require search query', async () => {
            const res = await request(app).get('/api/stocks/search');
            expect(res.status).toBe(400);
        });

        it('should reject repeated query parameters as malformed input', async () => {
            const res = await request(app).get('/api/stocks/search?q=test&q=second');
            expect(res.status).toBe(400);
            expect(stockOperations.searchStocks).not.toHaveBeenCalled();
        });
    });

    describe('GET /api/stocks/sector/:sector', () => {
        it('should return stocks in sector', async () => {
            const res = await request(app).get('/api/stocks/sector/Banking');
            expect(res.status).toBe(200);
            expect(res.body.data.length).toBeGreaterThan(0);
        });

        it('should return empty if sector not found', async () => {
            const res = await request(app).get('/api/stocks/sector/NonExistent');
            expect(res.status).toBe(200);
            expect(res.body.data).toEqual([]);
        });

        it('should reject invalid sector format', async () => {
            const res = await request(app).get('/api/stocks/sector/Banking$;DROP TABLE');
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error.message).toBe('Invalid sector format');
        });

        it('should reject overlong sector path values', async () => {
            const longSector = 'A'.repeat(81);
            const res = await request(app).get(`/api/stocks/sector/${longSector}`);
            expect(res.status).toBe(400);
            expect(res.body.error.message).toBe('Sector must be 80 characters or less');
            expect(stockOperations.getStocksBySector).not.toHaveBeenCalled();
        });
    });

    describe('GET /api/stocks/sectors', () => {
        it('should return list of sectors', async () => {
            const res = await request(app).get('/api/stocks/sectors');
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    describe('GET /api/stocks/top-gainers', () => {
        it('should return top gaining stocks', async () => {
            const res = await request(app).get('/api/stocks/top-gainers');
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
        });

        it('should clamp oversized limits', async () => {
            await request(app).get('/api/stocks/top-gainers?limit=999999').expect(200);
            expect(stockOperations.getTopGainers).toHaveBeenCalledWith(100);
        });

        it('should reject numeric-prefix limits', async () => {
            const res = await request(app).get('/api/stocks/top-gainers?limit=10abc');
            expect(res.status).toBe(400);
            expect(res.body.error.message).toBe('limit must be an integer');
            expect(stockOperations.getTopGainers).not.toHaveBeenCalled();
        });
    });

    describe('GET /api/stocks/top-losers', () => {
        it('should return top losing stocks', async () => {
            const res = await request(app).get('/api/stocks/top-losers');
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    describe('GET /api/stocks/:symbol/depth', () => {
        it('should reject invalid depth symbols before fetching depth', async () => {
            const res = await request(app).get('/api/stocks/BAD%40/depth');
            expect(res.status).toBe(400);
            expect(res.body.error.message).toBe('Invalid symbol format');
            expect(depthFetcher.getDepth).not.toHaveBeenCalled();
        });

        it('should reject unknown depth symbols before external helper calls', async () => {
            const res = await request(app).get('/api/stocks/NOTAREAL/depth');
            expect(res.status).toBe(404);
            expect(res.body.error.message).toBe('Stock not found');
            expect(depthFetcher.getDepth).not.toHaveBeenCalled();
        });

        it('should fetch depth for known ordinary-share symbols', async () => {
            const res = await request(app).get('/api/stocks/NABIL/depth');
            expect(res.status).toBe(200);
            expect(depthFetcher.getDepth).toHaveBeenCalledWith('NABIL');
        });
    });

    describe('POST /api/stocks/admin/validate', () => {
        it('should bound NEPSE validation requests with timeout and no redirects', async () => {
            const originalAdminApiKey = process.env.ADMIN_API_KEY;
            process.env.ADMIN_API_KEY = 'admin-key-for-route-tests-32-chars';

            try {
                await request(app)
                    .post('/api/stocks/admin/validate')
                    .set('x-admin-key', 'admin-key-for-route-tests-32-chars')
                    .expect(200);

                expect(mockNepseAxiosGet).toHaveBeenCalledWith(
                    'https://nepalstock.com.np/api/nots/securityDailyTradeStat/58',
                    expect.objectContaining({
                        headers: { Authorization: 'Bearer mock-token' },
                        timeout: 10000,
                        maxRedirects: 0
                    })
                );
                expect(stockOperations.cleanupInvalidStocks).toHaveBeenCalledWith(new Set(['NABIL']));
            } finally {
                if (originalAdminApiKey === undefined) delete process.env.ADMIN_API_KEY;
                else process.env.ADMIN_API_KEY = originalAdminApiKey;
            }
        });
    });

    describe('GET /api/stocks/:symbol/history', () => {
        it('should reject repeated days parameters before database lookup', async () => {
            const res = await request(app).get('/api/stocks/TEST/history?days=10&days=20');
            expect(res.status).toBe(400);
            expect(res.body.error.message).toBe('days must be a single integer');
        });

        it('should only fetch metrics for returned history dates', async () => {
            const olderDate = new Date('2026-06-01T00:00:00.000Z');
            const newerDate = new Date('2026-06-02T00:00:00.000Z');
            prisma.marketHistory.findMany.mockResolvedValue([
                {
                    date: newerDate,
                    openPrice: 110,
                    highPrice: 120,
                    lowPrice: 105,
                    closePrice: 115,
                    volume: 1000
                },
                {
                    date: olderDate,
                    openPrice: 100,
                    highPrice: 110,
                    lowPrice: 95,
                    closePrice: 108,
                    volume: 900
                }
            ]);
            prisma.stockMetrics.findMany.mockResolvedValue([
                {
                    date: olderDate,
                    trendMetrics: JSON.stringify({ ma20: 101, ma50: 98 })
                }
            ]);

            const res = await request(app).get('/api/stocks/NABIL/history?days=2');

            expect(res.status).toBe(200);
            expect(prisma.marketHistory.findMany).toHaveBeenCalledWith({
                where: { symbol: 'NABIL' },
                orderBy: { date: 'desc' },
                take: 2
            });
            expect(prisma.stockMetrics.findMany).toHaveBeenCalledWith({
                where: {
                    symbol: 'NABIL',
                    date: { in: [olderDate, newerDate] }
                },
                orderBy: { date: 'asc' }
            });
            expect(res.body.count).toBe(2);
        });
    });
});
