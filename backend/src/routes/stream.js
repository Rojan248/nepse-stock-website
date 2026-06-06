const express = require('express');
const router = express.Router();
const streamManager = require('../services/streamManager');
const logger = require('../services/utils/logger');

router.get('/', (req, res) => {
    // Setup SSE HTTP headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
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
    });
});

module.exports = router;
