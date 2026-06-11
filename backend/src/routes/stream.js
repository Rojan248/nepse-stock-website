const express = require('express');
const router = express.Router();
const streamManager = require('../services/streamManager');
const logger = require('../services/utils/logger');

const STREAM_RETRY_AFTER_SECONDS = 30;
const DEFAULT_MAX_CLIENTS = 20;
const DEFAULT_MAX_CLIENTS_PER_IP = 5;

let activeClientCount = 0;
const activeClientsByIp = new Map();

const parseStreamLimit = (name, fallback, max) => {
    const value = Number.parseInt(process.env[name], 10);
    if (!Number.isFinite(value) || value < 1) return fallback;
    return Math.min(value, max);
};

const getStreamLimits = () => ({
    maxClients: parseStreamLimit('STREAM_MAX_CLIENTS', DEFAULT_MAX_CLIENTS, 1000),
    maxClientsPerIp: parseStreamLimit('STREAM_MAX_CLIENTS_PER_IP', DEFAULT_MAX_CLIENTS_PER_IP, 100)
});

const normalizeClientIp = (ip) => String(ip || 'unknown').replace(/^::ffff:/, '');
const getClientIp = (req) => normalizeClientIp(req.ip || req.socket?.remoteAddress);

function getStreamAdmission(ip, limits = getStreamLimits()) {
    const currentIpCount = activeClientsByIp.get(ip) || 0;
    if (activeClientCount >= limits.maxClients) {
        return { allowed: false, reason: 'stream-capacity-exceeded' };
    }
    if (currentIpCount >= limits.maxClientsPerIp) {
        return { allowed: false, reason: 'stream-ip-capacity-exceeded' };
    }
    return { allowed: true };
}

function registerStreamClient(ip) {
    activeClientCount += 1;
    activeClientsByIp.set(ip, (activeClientsByIp.get(ip) || 0) + 1);

    let released = false;
    return () => {
        if (released) return;
        released = true;
        activeClientCount = Math.max(0, activeClientCount - 1);
        const nextIpCount = Math.max(0, (activeClientsByIp.get(ip) || 0) - 1);
        if (nextIpCount === 0) activeClientsByIp.delete(ip);
        else activeClientsByIp.set(ip, nextIpCount);
    };
}

function rejectStream(res, reason) {
    return res
        .status(429)
        .set('Retry-After', String(STREAM_RETRY_AFTER_SECONDS))
        .json({
            success: false,
            error: {
                message: 'Too many streaming clients',
                reason
            }
        });
}

function resetStreamLimits() {
    activeClientCount = 0;
    activeClientsByIp.clear();
}

function getStreamLimitSnapshot() {
    return {
        activeClientCount,
        activeClientsByIp: Object.fromEntries(activeClientsByIp.entries()),
        limits: getStreamLimits()
    };
}

router.get('/', (req, res) => {
    const clientIp = getClientIp(req);
    const limits = getStreamLimits();
    const admission = getStreamAdmission(clientIp, limits);
    if (!admission.allowed) {
        logger.warn(`SSE client rejected from ${clientIp}: ${admission.reason}`);
        return rejectStream(res, admission.reason);
    }

    streamManager.setMaxListeners(Math.max(streamManager.getMaxListeners(), limits.maxClients));
    const unregisterClient = registerStreamClient(clientIp);

    // Setup SSE HTTP headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
    });

    const clientId = Date.now();
    logger.info(`SSE client connected: ${clientId}`);

    // Send an initial heartbeat to confirm connection
    res.write(`data: ${JSON.stringify({ type: 'connected', time: new Date() })}\n\n`);

    // Define the event handler
    const updateHandler = (payload) => {
        // SSE format requires double newline after data payload
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    // Keep connection alive with a ping comment every 30 seconds
    const pingInterval = setInterval(() => {
        res.write(': ping\n\n');
    }, 30000);

    // Listen to market update events
    streamManager.on('marketUpdated', updateHandler);

    // Provide cleanup on client disconnect
    req.on('close', () => {
        logger.info(`SSE client disconnected: ${clientId}`);
        clearInterval(pingInterval);
        streamManager.off('marketUpdated', updateHandler);
        unregisterClient();
    });
});

router.__test__ = {
    getStreamAdmission,
    getStreamLimitSnapshot,
    registerStreamClient,
    resetStreamLimits,
    parseStreamLimit
};

module.exports = router;
