const logger = require('../services/utils/logger');
const { createErrorResponse } = require('../services/utils/errorHandler');

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
    // Log the error
    logger.error(`Error: ${err.message}`, {
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip
    });

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
 * Specifically handles Mongoose validation errors
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
