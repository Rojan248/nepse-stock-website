/**
 * Async Retry Utility with Exponential Backoff
 * Provides robust retry logic for NEPSE API calls
 */

const retry = require('async-retry');
const logger = require('./logger');

// Default retry configuration
const DEFAULT_OPTIONS = {
    retries: parseInt(process.env.MAX_RETRIES) || 5,
    minTimeout: parseInt(process.env.RETRY_MIN_TIMEOUT) || 2000,
    factor: parseFloat(process.env.RETRY_FACTOR) || 2,
    maxTimeout: 60000, // Max 1 minute between retries
    randomize: true,   // Add jitter to prevent thundering herd
};

/**
 * Check if the error is inherently non-retryable (validation, 404s, DNS)
 * @param {Error} error
 * @returns {boolean} True if the error should NOT be retried
 */
const isNonRetryableError = (error) => {
    return error.message?.includes('validation') ||
        error.message?.includes('invalid') ||
        error.code === 'ENOTFOUND';
};

/**
 * Wrap an async function with retry logic
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Override default options
 * @param {string} context - Description for logging (e.g., "fetchStocks")
 * @returns {Promise<any>} - Result of fn()
 */
const withRetry = async (fn, options = {}, context = 'operation') => {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let attempt = 0;

    return await retry(async (bail, attemptNumber) => {
        attempt = attemptNumber;

        logger.debug(`[Retry] ${context}: Attempt ${attemptNumber}/${opts.retries + 1}`);

        try {
            return await fn();
        } catch (error) {
            // Don't retry on certain errors (e.g., validation errors)
            if (isNonRetryableError(error)) {
                logger.error(`[Retry] ${context}: Non-retryable error: ${error.message}`);
                bail(error);
                return;
            }

            logger.warn(`[Retry] ${context}: Attempt ${attemptNumber} failed: ${error.message}`);
            throw error; // Will trigger retry
        }
    }, {
        ...opts,
        onRetry: (error, attemptNumber) => {
            const delay = Math.min(opts.minTimeout * Math.pow(opts.factor, attemptNumber - 1), opts.maxTimeout);
            logger.info(`[Retry] ${context}: Retry ${attemptNumber}/${opts.retries} in ${delay}ms...`);

            if (options.onRetry) {
                options.onRetry(error, attemptNumber);
            }
        }
    });
};

/**
 * Circuit Breaker State
 * Prevents hammering the API when it's clearly down
 */
const circuitBreaker = {
    failures: 0,
    lastFailure: null,
    isOpen: false,
    cooldownMs: parseInt(process.env.CIRCUIT_COOLDOWN_MS) || 30 * 60 * 1000, // 30 minutes
    threshold: parseInt(process.env.CIRCUIT_THRESHOLD) || 3,
};

/**
 * Check if circuit breaker allows requests
 * @returns {boolean} True if requests are allowed
 */
const isCircuitClosed = () => {
    if (!circuitBreaker.isOpen) return true;

    const elapsed = Date.now() - circuitBreaker.lastFailure;
    if (elapsed >= circuitBreaker.cooldownMs) {
        // Half-open: allow one attempt
        logger.info('[CircuitBreaker] Cooldown expired, allowing retry attempt');
        circuitBreaker.isOpen = false;
        circuitBreaker.failures = 0;
        return true;
    }

    const remainingMs = circuitBreaker.cooldownMs - elapsed;
    logger.warn(`[CircuitBreaker] Circuit OPEN. Remaining cooldown: ${Math.round(remainingMs / 1000)}s`);
    return false;
};

/**
 * Record a failure for circuit breaker
 */
const recordFailure = () => {
    circuitBreaker.failures++;
    circuitBreaker.lastFailure = Date.now();

    if (circuitBreaker.failures >= circuitBreaker.threshold) {
        circuitBreaker.isOpen = true;
        logger.error(`[CircuitBreaker] Circuit OPENED after ${circuitBreaker.failures} consecutive failures. Cooldown: ${circuitBreaker.cooldownMs / 1000}s`);
    }
};

/**
 * Record a success - resets circuit breaker
 */
const recordSuccess = () => {
    if (circuitBreaker.failures > 0 || circuitBreaker.isOpen) {
        logger.info('[CircuitBreaker] Success recorded, resetting circuit breaker');
    }
    circuitBreaker.failures = 0;
    circuitBreaker.isOpen = false;
    circuitBreaker.lastFailure = null;
};

/**
 * Get circuit breaker status
 */
const getCircuitStatus = () => ({
    isOpen: circuitBreaker.isOpen,
    consecutiveFailures: circuitBreaker.failures,
    lastFailure: circuitBreaker.lastFailure ? new Date(circuitBreaker.lastFailure).toISOString() : null,
    cooldownMs: circuitBreaker.cooldownMs,
    threshold: circuitBreaker.threshold,
});

module.exports = {
    withRetry,
    isCircuitClosed,
    recordFailure,
    recordSuccess,
    getCircuitStatus,
    DEFAULT_OPTIONS,
};
