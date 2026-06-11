const { prisma } = require('../database/connection');
const logger = require('../utils/logger');

const LOCK_DURATION_MS = 10 * 60 * 1000;

function isLockActive(existing, now) {
    if (!existing) return false;
    return existing.expiresAt > now;
}

function isLockHeldByOther(existing, owner, now) {
    return isLockActive(existing, now) && existing.owner !== owner;
}

const isUniqueConstraintError = (error) => error?.code === 'P2002';

async function acquireAiLock(owner, durationMs = LOCK_DURATION_MS) {
    const id = `AI_SUMMARY_${owner}`;
    const now = new Date();
    const expiresAt = new Date(Date.now() + durationMs);

    try {
        await prisma.lock.create({ data: { id, owner, expiresAt } });
        return true;
    } catch (error) {
        if (!isUniqueConstraintError(error)) {
            logger.error(`[AiSummaryLock] Failed to acquire ${id}: ${error.message}`);
            return false;
        }
    }

    try {
        const result = await prisma.lock.updateMany({
            where: {
                id,
                expiresAt: { lte: now }
            },
            data: { owner, expiresAt }
        });
        return result.count === 1;
    } catch (error) {
        logger.error(`[AiSummaryLock] Failed to refresh expired ${id}: ${error.message}`);
        return false;
    }
}

async function releaseAiLock(owner) {
    const id = `AI_SUMMARY_${owner}`;
    try {
        const existing = await prisma.lock.findUnique({ where: { id } });
        if (existing && existing.owner === owner) {
            await prisma.lock.delete({ where: { id } });
        }
    } catch (error) {
        logger.error(`[AiSummaryLock] Failed to release ${id}: ${error.message}`);
    }
}

module.exports = {
    acquireAiLock,
    releaseAiLock,
    isLockActive,
    isLockHeldByOther
};
