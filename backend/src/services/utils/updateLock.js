/**
 * Distributed mutex lock using SQLite/Prisma to prevent race conditions 
 * between multiple Node.js instances (e.g. Scheduler and Watchdog).
 */

const { prisma } = require('../database/connection');
const logger = require('./logger');

const LOCK_ID = 'NEPSE_UPDATE_LOCK';
const LOCK_DURATION_MS = 60000; // 1 minute lock

/**
 * Acquire the update lock
 * @param {string} owner - Identifier for who is acquiring the lock (e.g. 'scheduler', 'watchdog')
 * @returns {Promise<boolean>} True if lock was acquired, false if already held
 */
const acquireLock = async (owner) => {
    const now = new Date();
    
    try {
        // Find existing lock
        const existingLock = await prisma.lock.findUnique({
            where: { id: LOCK_ID }
        });

        // Check if lock exists and is active
        if (existingLock && existingLock.expiresAt > now) {
            if (existingLock.owner === owner) {
                // Already held by this owner, extend it
                await prisma.lock.update({
                    where: { id: LOCK_ID },
                    data: { expiresAt: new Date(Date.now() + LOCK_DURATION_MS) }
                });
                return true;
            }
            logger.debug(`[UpdateLock] Lock denied to '${owner}' - held by '${existingLock.owner}'`);
            return false;
        }

        // Lock doesn't exist or is expired, acquire it (upsert)
        await prisma.lock.upsert({
            where: { id: LOCK_ID },
            create: {
                id: LOCK_ID,
                owner,
                expiresAt: new Date(Date.now() + LOCK_DURATION_MS)
            },
            update: {
                owner,
                expiresAt: new Date(Date.now() + LOCK_DURATION_MS)
            }
        });

        logger.debug(`[UpdateLock] Lock acquired by '${owner}' (expires in ${LOCK_DURATION_MS / 1000}s)`);
        return true;
    } catch (error) {
        logger.error(`[UpdateLock] Failed to acquire lock: ${error.message}`);
        return false;
    }
};

/**
 * Release the update lock
 * @param {string} owner - Identifier for who is releasing (must match acquirer)
 */
const releaseLock = async (owner) => {
    try {
        const existingLock = await prisma.lock.findUnique({
            where: { id: LOCK_ID }
        });

        if (existingLock && existingLock.owner === owner) {
            await prisma.lock.delete({
                where: { id: LOCK_ID }
            });
            logger.debug(`[UpdateLock] Lock released by '${owner}'`);
        }
    } catch (error) {
        logger.error(`[UpdateLock] Failed to release lock: ${error.message}`);
    }
};

/**
 * Check if any lock is active (regardless of owner)
 * @returns {Promise<boolean>} True if any lock is active
 */
const isAnyLockActive = async () => {
    try {
        const existingLock = await prisma.lock.findUnique({
            where: { id: LOCK_ID }
        });
        return !!(existingLock && existingLock.expiresAt > new Date());
    } catch (error) {
        return false;
    }
};

/**
 * Get current lock status
 * @returns {Promise<Object>} Lock status
 */
const getLockStatus = async () => {
    const existingLock = await prisma.lock.findUnique({
        where: { id: LOCK_ID }
    });
    
    const active = !!(existingLock && existingLock.expiresAt > new Date());
    
    return {
        isLocked: active,
        lockOwner: active ? existingLock.owner : null,
        lockExpiry: active ? existingLock.expiresAt.toISOString() : null,
        remainingMs: active ? Math.max(0, existingLock.expiresAt.getTime() - Date.now()) : 0
    };
};

module.exports = {
    acquireLock,
    releaseLock,
    isAnyLockActive,
    getLockStatus
};
