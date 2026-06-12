const rateLimit = require('express-rate-limit');
const logger = require('../services/utils/logger');

/**
 * Rate Limiting Middleware
 * Protects against DoS attacks and API abuse
 *
 * NOTE: All limiters use the default in-memory store, which is suitable for
 * single-instance deployments. For multi-process or clustered environments,
 * replace with a shared store (e.g., rate-limit-redis) so counters are
 * consistent across instances.
 * TODO: Switch to Redis-backed store when scaling beyond a single process.
 */

// Global rate limiter: 100 requests per minute per IP
const globalLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in headers
    legacyHeaders: false,
    message: {
        success: false,
        error: {
            message: 'Too many requests. Please try again later.',
            retryAfter: 60
        }
    },
    handler: (req, res, next, options) => {
        logger.warn(`[RateLimit] Global limit exceeded: ${req.ip} - ${req.method} ${req.path}`);
        res.status(429).json(options.message);
    },
    skip: (req) => {
        // Skip rate limiting for health checks (monitoring systems)
        return req.path === '/api/health';
    }
});

// Strict rate limiter for admin routes: 5 requests per minute per IP
const adminLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // Only 5 requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: {
            message: 'Admin rate limit exceeded. Please wait before retrying.',
            retryAfter: 60
        }
    },
    handler: (req, res, next, options) => {
        logger.warn(`[RateLimit] Admin limit exceeded: ${req.ip} - ${req.method} ${req.path}`);
        res.status(429).json(options.message);
    }
});

// Search/Analytics rate limiter: 30 requests per minute (prevents analytics spam)
const searchLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: {
            message: 'Search rate limit exceeded. Please slow down.',
            retryAfter: 60
        }
    },
    handler: (req, res, next, options) => {
        logger.warn(`[RateLimit] Search limit exceeded: ${req.ip}`);
        res.status(429).json(options.message);
    }
});

// Public share lookup limiter: keeps unauthenticated shared-link probing bounded.
const shareLookupLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: {
            message: 'Too many shared watchlist lookups. Please try again later.',
            retryAfter: 900
        }
    },
    handler: (req, res, next, options) => {
        logger.warn(`[RateLimit] Shared watchlist lookup limit exceeded: ${req.ip}`);
        res.status(429).json(options.message);
    }
});

// Login brute-force protection: 5 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: {
            message: 'Too many login attempts. Please try again in 15 minutes.',
            retryAfter: 900
        }
    },
    handler: (req, res, next, options) => {
        logger.warn(`[RateLimit] Login brute-force limit exceeded: ${req.ip}`);
        res.status(429).json(options.message);
    }
});

// Registration rate limiter: 3 requests per hour per IP
const registrationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: {
            message: 'Too many registration attempts from this IP. Please try again in an hour.',
            retryAfter: 3600
        }
    },
    handler: (req, res, next, options) => {
        logger.warn(`[RateLimit] Registration limit exceeded: ${req.ip}`);
        res.status(429).json(options.message);
    }
});

// Refresh token rate limiter: 10 requests per 15 minutes per IP
const refreshLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: {
            message: 'Too many token refresh requests. Please slow down.',
            retryAfter: 900
        }
    },
    handler: (req, res, next, options) => {
        logger.warn(`[RateLimit] Refresh token limit exceeded: ${req.ip}`);
        res.status(429).json(options.message);
    }
});

module.exports = {
    globalLimiter,
    adminLimiter,
    searchLimiter,
    shareLookupLimiter,
    loginLimiter,
    registrationLimiter,
    refreshLimiter
};
