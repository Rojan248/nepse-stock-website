const cors = require('cors');
const logger = require('../services/utils/logger');

/**
 * CORS Middleware Configuration
 * Allows cross-origin requests from frontend
 */

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests from configured origin
        const allowedOrigins = [
            process.env.CORS_ORIGIN || 'http://localhost:3000',
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:5173', // Vite default
            'http://127.0.0.1:5173'
        ];

        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) {
            return callback(null, true);
        }

        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            logger.warn(`CORS blocked request from origin: ${origin}`);
            callback(null, false);
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    maxAge: 86400 // 24 hours
};

/**
 * Create CORS middleware
 * @returns {Function} CORS middleware function
 */
const corsMiddleware = cors(corsOptions);

/**
 * Simple CORS headers middleware (fallback)
 */
const simpleCorsMiddleware = (req, res, next) => {
    res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');

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
