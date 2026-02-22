const logger = require('../services/utils/logger');
const crypto = require('crypto');

/**
 * Admin Authentication Middleware
 * Protects sensitive routes by requiring an API Key
 */
const requireAdminKey = (req, res, next) => {
    // Get key from headers (support various casing conventions)
    const apiKey = (req.headers['x-admin-key'] || req.headers['X-ADMIN-KEY'] || '').toString();
    const configuredKey = (process.env.ADMIN_API_KEY || '').toString();

    // If no key is configured on the server, BLOCK ALL ACCESS for safety
    // This forces the developer to set up the key
    if (!configuredKey) {
        logger.error('Access denied: ADMIN_API_KEY is not configured on server');
        return res.status(500).json({
            success: false,
            error: { message: 'Server configuration error: Admin key not set' }
        });
    }

    try {
        const inputBuffer = Buffer.from(apiKey);
        const secretBuffer = Buffer.from(configuredKey);

        // Constant-time comparison to prevent timing attacks
        if (inputBuffer.length === secretBuffer.length &&
            crypto.timingSafeEqual(inputBuffer, secretBuffer)) {
            return next();
        }
    } catch (error) {
        // Log error but don't expose details to client
        logger.error(`Error verifying admin key: ${error.message}`);
    }

    logger.warn(`Unauthorized admin access attempt from ${req.ip}`);
    return res.status(401).json({
        success: false,
        error: { message: 'Unauthorized: Invalid Admin Key' }
    });
};

module.exports = {
    requireAdminKey
};
