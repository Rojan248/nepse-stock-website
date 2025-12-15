require('dotenv').config();

const express = require('express');
const { connectDB } = require('./services/database/connection');
const { corsMiddleware } = require('./middleware/cors');
const { notFoundHandler, errorHandler, validationErrorHandler } = require('./middleware/errorHandler');
const logger = require('./services/utils/logger');
const scheduler = require('./services/scheduler/updateScheduler');

// Import routes
const stocksRouter = require('./routes/stocks');
const iposRouter = require('./routes/ipos');
const marketRouter = require('./routes/market');

/**
 * NEPSE Backend Server
 * Express server with local JSON storage, scheduled updates, and REST API
 */

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy (for accurate IP logging behind reverse proxy)
app.set('trust proxy', 1);

// Middleware
app.use(corsMiddleware);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        if (req.path !== '/api/health') { // Don't log health checks
            logger.debug(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
        }
    });
    next();
});

// API Routes
app.use('/api/stocks', stocksRouter);
app.use('/api/ipos', iposRouter);
app.use('/api', marketRouter);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'NEPSE Stock API Server',
        version: '1.0.0',
        database: 'Local JSON Storage',
        endpoints: {
            stocks: '/api/stocks',
            ipos: '/api/ipos',
            marketSummary: '/api/market-summary',
            health: '/api/health'
        },
        documentation: '/api/docs'
    });
});

// Error handling
app.use(notFoundHandler);
app.use(validationErrorHandler);
app.use(errorHandler);

/**
 * Start the server
 */
const startServer = async () => {
    try {
        // Connect to local JSON storage
        logger.info('Initializing local JSON storage...');
        await connectDB();

        // Start Express server
        const server = app.listen(PORT, () => {
            logger.info(`Server running on http://localhost:${PORT}`);
            logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
        });

        // Start the scheduler
        logger.info('Starting data update scheduler...');
        scheduler.startScheduler();

        // Graceful shutdown
        const gracefulShutdown = async (signal) => {
            logger.info(`${signal} received. Starting graceful shutdown...`);

            // Stop scheduler
            scheduler.stopScheduler();

            // Close server
            server.close(() => {
                logger.info('HTTP server closed');
            });

            // Disconnect from database
            const { disconnectDB } = require('./services/database/connection');
            await disconnectDB();

            logger.info('Graceful shutdown completed');
            process.exit(0);
        };

        // Handle shutdown signals
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));

        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            logger.error(`Uncaught Exception: ${error.message}`);
            logger.error(error.stack);
            gracefulShutdown('uncaughtException');
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
        });

    } catch (error) {
        logger.error(`Failed to start server: ${error.message}`);
        process.exit(1);
    }
};

// Start the server
startServer();

module.exports = app;
