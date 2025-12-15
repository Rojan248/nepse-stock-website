const crypto = require('crypto');
const logger = require('../services/utils/logger');
const { createErrorResponse } = require('../services/utils/errorHandler');

/**
 * IP Anonymization Utilities
 * 
 * Configuration (via environment variables):
 * - LOG_IPS: Set to 'true' to include anonymized IPs in logs. Default: false (no IP logged)
 * - LOG_IP_SALT: Optional salt for IP hashing. If not set, uses a default internal salt.
 * 
 * When LOG_IPS=true:
 * - IPv4: Last octet is zeroed (e.g., 192.168.1.100 → 192.168.1.0)
 * - IPv6: Last 80 bits are zeroed (preserves /48 prefix)
 * - Additionally, a short hash is appended for correlation without exposing the full IP
 */

const IP_SALT = process.env.LOG_IP_SALT || 'nepse-default-salt-2024';

/**
 * Anonymize an IP address for GDPR/CCPA compliance
 * @param {string} ip - Raw IP address
 * @returns {string|null} Anonymized IP or null if IP logging is disabled
 */
const anonymizeIP = (ip) => {
    // Check if IP logging is enabled
    if (process.env.LOG_IPS !== 'true') {
        return null;
    }

    if (!ip) return null;

    // Remove IPv6 prefix if present (e.g., ::ffff:192.168.1.1)
    const cleanIP = ip.replace(/^::ffff:/, '');

    // Generate a short hash for correlation (first 8 chars of SHA256)
    const hash = crypto.createHash('sha256')
        .update(cleanIP + IP_SALT)
        .digest('hex')
        .substring(0, 8);

    // Check if IPv4
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(cleanIP)) {
        // Zero out last octet for IPv4
        const parts = cleanIP.split('.');
        parts[3] = '0';
        return `${parts.join('.')} [${hash}]`;
    }

    // IPv6: zero out last 80 bits (keep /48 prefix)
    if (cleanIP.includes(':')) {
        const parts = cleanIP.split(':');
        // Keep first 3 groups, zero the rest
        const anonymized = parts.slice(0, 3).concat(['0', '0', '0', '0', '0']).join(':');
        return `${anonymized} [${hash}]`;
    }

    // Unknown format - just return hash
    return `[${hash}]`;
};

/**
 * Global Error Handler Middleware
 * Catches unhandled errors and returns standardized responses
 */

/**
 * Not Found Handler
 * Handles 404 errors for undefined routes
 */
const notFoundHandler = (req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    error.status = 404;
    next(error);
};

/**
 * Global Error Handler
 * Catches all errors and returns formatted response
 */
const errorHandler = (err, req, res, next) => {
    // Build log metadata (conditionally include IP)
    const logMeta = {
        stack: err.stack,
        url: req.originalUrl,
        method: req.method
    };

    // Only include IP if logging is enabled (anonymized)
    const anonymizedIP = anonymizeIP(req.ip);
    if (anonymizedIP) {
        logMeta.ip = anonymizedIP;
    }

    // Log the error
    logger.error(`Error: ${err.message}`, logMeta);

    // Determine status code
    let statusCode = err.status || err.statusCode || 500;

    // Handle specific error types
    if (err.name === 'ValidationError') {
        statusCode = 400;
    } else if (err.name === 'CastError') {
        statusCode = 400;
    } else if (err.code === 'ECONNREFUSED') {
        statusCode = 503;
    }

    // Don't expose stack trace in production
    const isDevelopment = process.env.NODE_ENV === 'development';

    const response = createErrorResponse(
        statusCode,
        err.message || 'Internal Server Error',
        isDevelopment ? { stack: err.stack } : null
    );

    res.status(statusCode).json(response);
};

/**
 * Async Handler Wrapper
 * Wraps async route handlers to catch errors
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

/**
 * Validation Error Handler
 * Handles validation errors
 */
const validationErrorHandler = (err, req, res, next) => {
    if (err.name !== 'ValidationError') {
        return next(err);
    }

    const errors = Object.values(err.errors).map(e => ({
        field: e.path,
        message: e.message
    }));

    const response = createErrorResponse(400, 'Validation Error', { errors });
    res.status(400).json(response);
};

module.exports = {
    notFoundHandler,
    errorHandler,
    asyncHandler,
    validationErrorHandler
};
