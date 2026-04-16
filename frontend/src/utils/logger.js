/**
 * Frontend Logger Utility
 * Wraps console methods to allow for future centralization or disabling in production.
 */

const IS_PROD = import.meta.env.PROD;

const logger = {
    info: (...args) => {
        if (!IS_PROD) console.log('[INFO]', ...args);
    },
    warn: (...args) => {
        if (!IS_PROD) console.warn('[WARN]', ...args);
    },
    error: (...args) => {
        // Errors are typically wanted even in production console for debugging
        console.error('[ERROR]', ...args);
    },
    debug: (...args) => {
        if (!IS_PROD) console.debug('[DEBUG]', ...args);
    }
};

export default logger;
