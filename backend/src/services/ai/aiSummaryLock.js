const { prisma } = require('../database/connection');
const logger = require('../utils/logger');

const LOCK_DURATION_MS = 10 * 60 * 1000;

function isLockHeldByOther(existing, owner, now) {
    if (!existing) return false;
    if (existing.expiresAt <= now) return false;
    return existing.owner !== owner;
}

async function acquireAiLock(owner, durationMs = LOCK_DURATION_MS) {
    const id = `AI_SUMMARY_${owner}`;
    const now = new Date();
    const expiresAt = new Date(Date.now() + durationMs);

    try {
        const existing = await prisma.lock.findUnique({ where: { id } });
        if (isLockHeldByOther(existing, owner, now)) return false;

        await prisma.lock.upsert({
            where: { id },
            create: { id, owner, expiresAt },
            update: { owner, expiresAt }
        });
        return true;
    } catch (error) {
        logger.error(`[AiSummaryLock] Failed to acquire ${id}: ${error.message}`);
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
    isLockHeldByOther
};
