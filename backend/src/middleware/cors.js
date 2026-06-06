const cors = require('cors');
const logger = require('../services/utils/logger');

/**
 * CORS Middleware Configuration
 * Allows cross-origin requests from frontend
 */

const getOrigins = () => {
    const envOrigins = process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(',').map(o => o.trim()).filter(Boolean)
        : [];
    
    // In production, strictly rely on environment variables
    if (process.env.NODE_ENV === 'production') {
        return envOrigins.filter(origin => origin !== '*');
    }

    // In development, allow common localhost ports
    return [...new Set([
        ...envOrigins,
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5173', // Vite default
        'http://127.0.0.1:5173'
    ])];
};

const isOriginAllowed = (origin) => {
    const allowedOrigins = getOrigins();

    // Allow requests with no origin (browser navigation, mobile apps, curl, health checks)
    if (!origin) {
        return true;
    }

    // Wildcard is only accepted outside production because credentials are enabled.
    if (process.env.NODE_ENV !== 'production' && allowedOrigins.includes('*')) {
        return true;
    }

    return allowedOrigins.includes(origin);
};

const corsOptions = {
    origin: function (origin, callback) {
        if (isOriginAllowed(origin)) {
            if (!origin) {
                logger.debug('[CORS] Request without Origin header (Allowed)');
            }
            return callback(null, true);
        }

        logger.warn(`CORS blocked request from origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Admin-Key'],
    credentials: true,
    maxAge: 86400 // 24 hours
};

/**
 * Create CORS middleware
 * @returns {Function} CORS middleware function
 */
const corsMiddleware = cors(corsOptions);

/**
 * Simple CORS headers middleware (fallback/legacy)
 */
const simpleCorsMiddleware = (req, res, next) => {
    // Only use if standard CORS middleware is bypassed
    const origin = req.headers.origin;

    if (origin && isOriginAllowed(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Admin-Key');
        res.header('Access-Control-Allow-Credentials', 'true');
    }

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }

    next();
};

module.exports = {
    corsMiddleware,
    getOrigins,
    isOriginAllowed,
    simpleCorsMiddleware
};
