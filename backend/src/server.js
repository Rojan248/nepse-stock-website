require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const { connectDB } = require('./services/database/connection');
const { corsMiddleware } = require('./middleware/cors');
const { hostHeaderGuard } = require('./middleware/hostHeaderGuard');
const { browserStateChangeGuard, jsonApiBodyGuard } = require('./middleware/browserRequestGuards');
const { jsonBodyShapeGuard } = require('./middleware/bodyShapeGuards');
const { sensitiveApiCacheGuard } = require('./middleware/cacheControl');
const { queryStringShapeGuard } = require('./middleware/queryStringGuards');
const { frontendStaticSafetyGuard } = require('./middleware/staticAssetGuards');
const { globalLimiter } = require('./middleware/rateLimiter');
const { notFoundHandler, errorHandler, validationErrorHandler } = require('./middleware/errorHandler');
const logger = require('./services/utils/logger');
const scheduler = require('./services/scheduler/updateScheduler');
const aiSummaryScheduler = require('./services/scheduler/aiSummaryScheduler');
const { validateRuntimeSecrets } = require('./services/utils/securityConfig');

// Import routes
const stocksRouter = require('./routes/stocks');
const iposRouter = require('./routes/ipos');
const marketRouter = require('./routes/market');
const watchdogRouter = require('./routes/watchdog');
const authRouter = require('./routes/auth');
const watchlistRouter = require('./routes/watchlists');
const portfolioRouter = require('./routes/portfolios');
const alertRouter = require('./routes/alerts');
const streamRouter = require('./routes/stream');
const aiSummariesRouter = require('./routes/aiSummaries');
const { parseTrustProxy } = require('./services/utils/proxyConfig');

/**
 * NEPSE Backend Server
 * Express server with local JSON storage, scheduled updates, and REST API
 */

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy only when explicitly configured. Enabling this on a directly
// exposed server lets clients spoof X-Forwarded-For and weaken IP limiters.
app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY));

// Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:"],
            connectSrc: ["'self'"],
        },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(hostHeaderGuard);
app.use(corsMiddleware);
app.use(sensitiveApiCacheGuard);
app.use(globalLimiter);
app.use(queryStringShapeGuard);
app.use(browserStateChangeGuard);
app.use(jsonApiBodyGuard);
app.use(express.json({ limit: '1mb' }));
app.use(jsonBodyShapeGuard);
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

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
app.use('/api/auth', authRouter);
app.use('/api/watchlists', watchlistRouter);
app.use('/api/portfolios', portfolioRouter);
app.use('/api/alerts', alertRouter);
app.use('/api/stocks', stocksRouter);
app.use('/api/ipos', iposRouter);
app.use('/api', marketRouter);
app.use('/api/watchdog', watchdogRouter);
app.use('/api/stream', streamRouter);
app.use('/api/ai-summaries', aiSummariesRouter);

// Root endpoint (handled by static files in production)
if (process.env.NODE_ENV !== 'production') {
    app.get('/', (req, res) => {
        res.json({
            success: true,
            message: 'NEPSE Stock API Server',
            version: '1.0.0',
            database: 'SQLite (Prisma)',
            endpoints: {
                stocks: '/api/stocks',
                ipos: '/api/ipos',
                marketSummary: '/api/market-summary',
                health: '/api/health'
            },
            documentation: '/api/docs'
        });
    });
} else {
    // Production: Serve frontend static files
    const frontendPath = path.join(__dirname, '../../frontend/dist');
    app.use(frontendStaticSafetyGuard);
    app.use(express.static(frontendPath, {
        dotfiles: 'deny',
        index: false
    }));

    // Catch-all: serve index.html for client-side routing
    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api')) {
            return next();
        }
        return res.sendFile(path.join(frontendPath, 'index.html'));
    });
}

// Error handling
app.use(notFoundHandler);
app.use(validationErrorHandler);
app.use(errorHandler);

/**
 * Start the server
 */
const startServer = async () => {
    try {
        validateRuntimeSecrets();

        // Ensure logs directory exists
        const logsDir = path.join(__dirname, '../logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }

        // Connect to database (Prisma)
        logger.info('Connecting to database (Prisma)...');
        await connectDB();

        // Initialize analytics service
        const analytics = require('./services/analytics');
        await analytics.initialize();


        // Start Express server
        const server = app.listen(PORT, '0.0.0.0', () => {
            logger.info(`Server running on http://0.0.0.0:${PORT}`);
            logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
        });

        if (process.env.DISABLE_BACKGROUND_JOBS === 'true') {
            logger.warn('Background schedulers disabled by DISABLE_BACKGROUND_JOBS=true');
        } else {
            logger.info('Starting data update scheduler...');
            scheduler.startScheduler();
            logger.info('Scheduler service started');
            aiSummaryScheduler.startScheduler();
        }

        // Graceful shutdown
        const gracefulShutdown = async (signal) => {
            logger.info(`${signal} received. Starting graceful shutdown...`);

            // Stop scheduler
            scheduler.stopScheduler();
            aiSummaryScheduler.stopScheduler();

            // Shutdown analytics
            const analytics = require('./services/analytics');
            await analytics.shutdown();

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

// Start the server if run directly
if (require.main === module) {
    startServer();
}

module.exports = app;
