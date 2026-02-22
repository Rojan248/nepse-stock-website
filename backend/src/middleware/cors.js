const cors = require('cors');
const logger = require('../services/utils/logger');

/**
 * CORS Middleware Configuration
 * Allows cross-origin requests from frontend
 */

const getOrigins = () => {
    const envOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(o => o.trim()) : [];
    
    // In production, strictly rely on environment variables
    if (process.env.NODE_ENV === 'production') {
        return envOrigins;
    }

    // In development, allow common localhost ports
    return [
        ...envOrigins,
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5173', // Vite default
        'http://127.0.0.1:5173'
    ];
};

const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = getOrigins();

        // Allow requests with no origin (browser navigation, mobile apps, curl, health checks)
        if (!origin) {
            logger.debug('[CORS] Request without Origin header (Allowed)');
            return callback(null, true);
        }

        // Wildcard: allow all origins when CORS_ORIGIN=*
        if (allowedOrigins.includes('*')) {
            return callback(null, true);
        }

        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            logger.warn(`CORS blocked request from origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
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
    const allowedOrigins = getOrigins();

    if (origin && allowedOrigins.includes(origin)) {
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
    simpleCorsMiddleware
};