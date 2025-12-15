const logger = require('./logger');

/**
 * Error Handler Utilities
 * Standardized error handling and recovery
 */

/**
 * Handle fetch/API errors
 * @param {Error} error - The error object
 * @returns {Object} Parsed error information
 */
const handleFetchError = (error) => {
    const errorInfo = {
        type: 'FETCH_ERROR',
        message: error.message || 'Unknown fetch error',
        code: error.code || 'UNKNOWN',
        timestamp: new Date().toISOString()
    };

    if (error.response) {
        // HTTP error response
        errorInfo.status = error.response.status;
        errorInfo.statusText = error.response.statusText;
        errorInfo.type = 'HTTP_ERROR';
    } else if (error.request) {
        // No response received
        errorInfo.type = 'NETWORK_ERROR';
        errorInfo.message = 'No response received from server';
    } else if (error.code === 'ECONNABORTED') {
        errorInfo.type = 'TIMEOUT_ERROR';
        errorInfo.message = 'Request timed out';
    }

    logger.error(`Fetch Error: ${errorInfo.type} - ${errorInfo.message}`);
    return errorInfo;
};

/**
 * Handle database errors
 * @param {Error} error - The error object
 * @returns {Object} Parsed error information
 */
const handleDatabaseError = (error) => {
    const errorInfo = {
        type: 'DATABASE_ERROR',
        message: error.message || 'Unknown database error',
        code: error.code || 'UNKNOWN',
        timestamp: new Date().toISOString()
    };

    if (error.name === 'ValidationError') {
        errorInfo.type = 'VALIDATION_ERROR';
        errorInfo.fields = Object.keys(error.errors || {});
    } else if (error.code === 11000) {
        errorInfo.type = 'DUPLICATE_KEY_ERROR';
        errorInfo.message = 'Duplicate key error';
    } else if (error.name === 'CastError') {
        errorInfo.type = 'CAST_ERROR';
        errorInfo.message = `Invalid ${error.path}: ${error.value}`;
    }

    logger.error(`Database Error: ${errorInfo.type} - ${errorInfo.message}`);
    return errorInfo;
};

/**
 * Create standardized error response
 * @param {number} code - HTTP status code
 * @param {string} message - Error message
 * @param {Object} details - Additional details
 * @returns {Object} Standardized error response
 */
const createErrorResponse = (code, message, details = null) => {
    const response = {
        success: false,
        error: {
            code,
            message,
            timestamp: new Date().toISOString()
        }
    };

    if (details) {
        response.error.details = details;
    }

    return response;
};

/**
 * Log error and use fallback value
 * @param {Error} error - The error object
 * @param {*} fallback - Fallback value to return
 * @param {string} context - Context for logging
 * @returns {*} Fallback value
 */
const logAndRecover = (error, fallback, context = 'Operation') => {
    logger.error(`${context} failed: ${error.message}`);
    logger.debug(`Using fallback value for ${context}`);
    return fallback;
};

/**
 * Wrap async function with error handling
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Wrapped function
 */
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

module.exports = {
    handleFetchError,
    handleDatabaseError,
    createErrorResponse,
    logAndRecover,
    asyncHandler
};
