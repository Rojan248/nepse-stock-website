/**
 * Simple mutex lock to prevent race conditions between Scheduler and Watchdog
 * When Watchdog is correcting data, the Scheduler should not overwrite it
 */

const logger = require('./logger');

let isLocked = false;
let lockOwner = null;
let lockExpiry = null;

const LOCK_DURATION_MS = 60000; // 1 minute lock

/** Helper to check if lock is expired */
const isLockExpired = () => isLocked && lockExpiry && Date.now() >= lockExpiry;

/** Helper to check if lock is currently active */
const isLockActive = () => isLocked && lockExpiry && Date.now() < lockExpiry;

/**
 * Acquire the update lock
 * @param {string} owner - Identifier for who is acquiring the lock
 * @returns {boolean} True if lock was acquired, false if already held
 */
const acquireLock = (owner) => {
    // Check if lock is held and not expired
    if (isLockActive()) {
        logger.debug(`[UpdateLock] Lock denied to '${owner}' - held by '${lockOwner}'`);
        return false;
    }

    // Acquire lock
    isLocked = true;
    lockOwner = owner;
    lockExpiry = Date.now() + LOCK_DURATION_MS;
    logger.debug(`[UpdateLock] Lock acquired by '${owner}' (expires in ${LOCK_DURATION_MS / 1000}s)`);
    return true;
};

/**
 * Release the update lock
 * @param {string} owner - Identifier for who is releasing (must match acquirer)
 */
const releaseLock = (owner) => {
    if (lockOwner === owner) {
        logger.debug(`[UpdateLock] Lock released by '${owner}'`);
        isLocked = false;
        lockOwner = null;
        lockExpiry = null;
    }
};

/**
 * Check if lock is held by a specific owner
 * @param {string} owner - Owner to check
 * @returns {boolean} True if locked by this owner
 */
const isLockedBy = (owner) => {
    // Also check expiry
    if (isLockExpired()) {
        // Lock expired, auto-release
        logger.debug(`[UpdateLock] Lock expired, auto-releasing from '${lockOwner}'`);
        isLocked = false;
        lockOwner = null;
        lockExpiry = null;
        return false;
    }
    return lockOwner === owner && isLocked;
};

/**
 * Check if any lock is active (regardless of owner)
 * @returns {boolean} True if any lock is active
 */
const isAnyLockActive = () => {
    // Check expiry
    if (isLockExpired()) {
        isLocked = false;
        lockOwner = null;
        lockExpiry = null;
        return false;
    }
    return isLocked;
};

/**
 * Get current lock status
 * @returns {Object} Lock status
 */
const getLockStatus = () => ({
    isLocked: isAnyLockActive(),
    lockOwner,
    lockExpiry: lockExpiry ? new Date(lockExpiry).toISOString() : null,
    remainingMs: lockExpiry ? Math.max(0, lockExpiry - Date.now()) : 0
});

module.exports = {
    acquireLock,
    releaseLock,
    isLockedBy,
    isAnyLockActive,
    getLockStatus
};
