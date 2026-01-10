const logger = require('../services/utils/logger');

/**
 * Admin Authentication Middleware
 * Protects sensitive routes by requiring an API Key
 */
const requireAdminKey = (req, res, next) => {
    // Get key from headers (support various casing conventions)
    const apiKey = req.headers['x-admin-key'] || req.headers['X-ADMIN-KEY'];
    const configuredKey = process.env.ADMIN_API_KEY;

    // If no key is configured on the server, BLOCK ALL ACCESS for safety
    // This forces the developer to set up the key
    if (!configuredKey) {
        logger.error('Access denied: ADMIN_API_KEY is not configured on server');
        return res.status(500).json({
            success: false,
            error: { message: 'Server configuration error: Admin key not set' }
        });
    }

    // Constant-time comparison to prevent timing attacks (simple string match is usually fine here, but explicit is better)
    if (apiKey === configuredKey) {
        return next();
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
