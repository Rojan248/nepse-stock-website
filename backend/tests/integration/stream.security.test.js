const express = require('express');
const request = require('supertest');

jest.mock('../../src/services/utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
}));

const streamRouter = require('../../src/routes/stream');

describe('SSE stream admission control', () => {
    const app = express();
    app.set('trust proxy', true);
    app.use('/api/stream', streamRouter);

    beforeEach(() => {
        streamRouter.__test__.resetStreamLimits();
        process.env.STREAM_MAX_CLIENTS = '2';
        process.env.STREAM_MAX_CLIENTS_PER_IP = '1';
    });

    afterEach(() => {
        streamRouter.__test__.resetStreamLimits();
        delete process.env.STREAM_MAX_CLIENTS;
        delete process.env.STREAM_MAX_CLIENTS_PER_IP;
    });

    it('rejects clients above the per-IP streaming limit before allocating a new stream', async () => {
        const release = streamRouter.__test__.registerStreamClient('203.0.113.9');

        const res = await request(app)
            .get('/api/stream')
            .set('X-Forwarded-For', '203.0.113.9')
            .expect(429);

        expect(res.headers['retry-after']).toBe('30');
        expect(res.body.error.reason).toBe('stream-ip-capacity-exceeded');
        expect(streamRouter.__test__.getStreamLimitSnapshot().activeClientCount).toBe(1);

        release();
        expect(streamRouter.__test__.getStreamLimitSnapshot().activeClientCount).toBe(0);
    });

    it('rejects clients above the total streaming limit', () => {
        process.env.STREAM_MAX_CLIENTS = '1';
        process.env.STREAM_MAX_CLIENTS_PER_IP = '5';
        const release = streamRouter.__test__.registerStreamClient('198.51.100.1');

        expect(streamRouter.__test__.getStreamAdmission('198.51.100.2')).toEqual({
            allowed: false,
            reason: 'stream-capacity-exceeded'
        });

        release();
    });
});
