const request = require('supertest');
const express = require('express');
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
    getRecentlyUpdated: jest.fn().mockResolvedValue([global.testUtils.mockStock])
}));

const stockOperations = require('../../src/services/database/stockOperations');

describe('Stock API Endpoints', () => {
    beforeEach(() => {
        jest.clearAllMocks();
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
        });
    });

    describe('GET /api/stocks/:symbol/history', () => {
        it('should reject repeated days parameters before database lookup', async () => {
            const res = await request(app).get('/api/stocks/TEST/history?days=10&days=20');
            expect(res.status).toBe(400);
            expect(res.body.error.message).toBe('days must be a single integer');
        });
    });
});
