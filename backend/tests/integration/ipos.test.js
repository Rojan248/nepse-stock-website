const request = require('supertest');
const express = require('express');
const iposRouter = require('../../src/routes/ipos');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/ipos', iposRouter);

// Mock the IPO operations
jest.mock('../../src/services/database/ipoOperations', () => ({
    getAllIPOs: jest.fn().mockResolvedValue([
        global.testUtils.mockIPO,
        { ...global.testUtils.mockIPO, companyName: 'Test IPO 2', status: 'open' }
    ]),
    getIPOByCompanyName: jest.fn().mockImplementation((name) => {
        if (name.toLowerCase().includes('test')) {
            return Promise.resolve(global.testUtils.mockIPO);
        }
        return Promise.resolve(null);
    }),
    getIPOsByStatus: jest.fn().mockImplementation((status) => {
        if (status === 'upcoming') {
            return Promise.resolve({ ipos: [global.testUtils.mockIPO], count: 1 });
        }
        return Promise.resolve({ ipos: [], count: 0 });
    }),
    getActiveIPOs: jest.fn().mockResolvedValue([global.testUtils.mockIPO]),
    searchIPOs: jest.fn().mockResolvedValue([global.testUtils.mockIPO]),
    getIPOCounts: jest.fn().mockResolvedValue({
        upcoming: 5,
        open: 2,
        closed: 3,
        completed: 10,
        total: 20
    })
}));

const ipoOperations = require('../../src/services/database/ipoOperations');
const { searchLimiter } = require('../../src/middleware/rateLimiter');

describe('IPO API Endpoints', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        searchLimiter.resetKey('::ffff:127.0.0.1');
        searchLimiter.resetKey('127.0.0.1');
    });

    describe('GET /api/ipos', () => {
        it('should return array of IPOs', async () => {
            const res = await request(app).get('/api/ipos');
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
        });

        it('should include statistics', async () => {
            const res = await request(app).get('/api/ipos');
            expect(res.body).toHaveProperty('statistics');
        });

        it('should reject repeated status filters before database lookup', async () => {
            const res = await request(app).get('/api/ipos?status=open&status=closed');
            expect(res.status).toBe(400);
            expect(res.body.error.message).toBe('status must be a single value');
            expect(ipoOperations.getAllIPOs).not.toHaveBeenCalled();
        });

        it('should normalize valid status filters', async () => {
            await request(app).get('/api/ipos?status=OPEN').expect(200);
            expect(ipoOperations.getAllIPOs).toHaveBeenCalledWith({
                skip: 0,
                limit: 100,
                status: 'open'
            });
        });
    });

    describe('GET /api/ipos/active', () => {
        it('should return active IPOs', async () => {
            const res = await request(app).get('/api/ipos/active');
            expect(res.status).toBe(200);
            expect(Array.isArray(res.body.data)).toBe(true);
        });
    });

    describe('GET /api/ipos/search', () => {
        it('should return matching IPOs for a valid query', async () => {
            const res = await request(app).get('/api/ipos/search?q=test');
            expect(res.status).toBe(200);
            expect(res.body.query).toBe('test');
        });

        it('should reject repeated query parameters as malformed input', async () => {
            const res = await request(app).get('/api/ipos/search?q=test&q=second');
            expect(res.status).toBe(400);
            expect(ipoOperations.searchIPOs).not.toHaveBeenCalled();
        });

        it('should rate limit repeated IPO search scans', async () => {
            for (let i = 0; i < 30; i++) {
                await request(app)
                    .get(`/api/ipos/search?q=test${i}`)
                    .expect(200);
            }

            const res = await request(app)
                .get('/api/ipos/search?q=overflow')
                .expect(429);

            expect(res.body.error.message).toContain('Search rate limit exceeded');
            expect(ipoOperations.searchIPOs).toHaveBeenCalledTimes(30);
        });
    });

    describe('GET /api/ipos/status/:status', () => {
        it('should return IPOs with valid status', async () => {
            const res = await request(app).get('/api/ipos/status/upcoming');
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveLength(1);
            expect(res.body.data[0]).toHaveProperty('companyName', 'Test IPO Company');
            expect(res.body.count).toBe(1);
        });

        it('should normalize status path casing', async () => {
            await request(app).get('/api/ipos/status/UPCOMING').expect(200);
            expect(ipoOperations.getIPOsByStatus).toHaveBeenCalledWith('upcoming');
        });

        it('should reject invalid status', async () => {
            const res = await request(app).get('/api/ipos/status/invalid');
            expect(res.status).toBe(400);
        });
    });

    describe('GET /api/ipos/:companyName', () => {
        it('should return IPO for valid company', async () => {
            const res = await request(app).get('/api/ipos/Test%20IPO%20Company');
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveProperty('companyName');
        });

        it('should return 404 for non-existent company', async () => {
            const res = await request(app).get('/api/ipos/NonExistent%20Company');
            expect(res.status).toBe(404);
        });
    });

    describe('GET /api/ipos/counts', () => {
        it('should return IPO counts by status', async () => {
            const res = await request(app).get('/api/ipos/counts');
            expect(res.status).toBe(200);
            expect(res.body.data).toHaveProperty('upcoming');
            expect(res.body.data).toHaveProperty('open');
            expect(res.body.data).toHaveProperty('closed');
            expect(res.body.data).toHaveProperty('completed');
        });
    });
});
