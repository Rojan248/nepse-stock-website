/**
 * Market Summary Database Operations - Firestore Implementation
 * Handles market summary data operations
 */

const { getDb } = require('./firebase');
const logger = require('../utils/logger');

const COLLECTION = 'marketSummary';
const CURRENT_DOC = 'current';
const HISTORY_COLLECTION = 'marketHistory';

/**
 * Save market summary (updates current document)
 */
const saveMarketSummary = async (summary) => {
    if (!summary) {
        return { success: false };
    }

    try {
        const db = getDb();
        const timestamp = new Date().toISOString();

        const data = {
            ...summary,
            timestamp,
            updatedAt: timestamp
        };

        // Save to current document
        await db.collection(COLLECTION).doc(CURRENT_DOC).set(data);

        // Also save to history (with timestamp as doc ID)
        const historyId = timestamp.replace(/[:.]/g, '-');
        await db.collection(HISTORY_COLLECTION).doc(historyId).set(data);

        logger.debug('Saved market summary to Firestore');

        return { success: true };
    } catch (error) {
        logger.error(`Error saving market summary: ${error.message}`);
        throw error;
    }
};

/**
 * Upsert market summary (same as save for Firestore)
 */
const upsertMarketSummary = async (summary) => {
    return saveMarketSummary(summary);
};

/**
 * Get latest market summary
 */
const getLatestMarketSummary = async () => {
    try {
        const db = getDb();
        const doc = await db.collection(COLLECTION).doc(CURRENT_DOC).get();

        if (!doc.exists) {
            return null;
        }

        return { id: doc.id, ...doc.data() };
    } catch (error) {
        logger.error(`Error getting market summary: ${error.message}`);
        return null;
    }
};

/**
 * Get market summary history
 */
const getMarketSummaryHistory = async (hours = 24) => {
    try {
        const db = getDb();
        const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

        const snapshot = await db.collection(HISTORY_COLLECTION)
            .where('timestamp', '>=', cutoff)
            .orderBy('timestamp', 'desc')
            .limit(100)
            .get();

        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        logger.error(`Error getting market history: ${error.message}`);
        return [];
    }
};

/**
 * Get market summary by date range
 */
const getMarketSummaryByDate = async (startDate, endDate) => {
    try {
        const db = getDb();

        let query = db.collection(HISTORY_COLLECTION)
            .orderBy('timestamp', 'desc');

        if (startDate) {
            query = query.where('timestamp', '>=', new Date(startDate).toISOString());
        }
        if (endDate) {
            query = query.where('timestamp', '<=', new Date(endDate).toISOString());
        }

        const snapshot = await query.limit(100).get();

        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        logger.error(`Error getting market summary by date: ${error.message}`);
        return [];
    }
};

/**
 * Clean old market summaries (keep last 7 days)
 */
const cleanOldSummaries = async (daysToKeep = 7) => {
    try {
        const db = getDb();
        const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString();

        const snapshot = await db.collection(HISTORY_COLLECTION)
            .where('timestamp', '<', cutoff)
            .get();

        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();

        logger.info(`Cleaned ${snapshot.size} old market summaries`);
        return snapshot.size;
    } catch (error) {
        logger.error(`Error cleaning old summaries: ${error.message}`);
        return 0;
    }
};

/**
 * Get market stats
 */
const getMarketStats = async () => {
    try {
        const db = getDb();
        const current = await getLatestMarketSummary();

        // Client SDK (compat) fallback for count()
        const historySnapshot = await db.collection(HISTORY_COLLECTION).get();

        return {
            latest: current,
            totalRecords: historySnapshot.size,
            hasData: current !== null
        };
    } catch (error) {
        logger.error(`Error getting market stats: ${error.message}`);
        return { latest: null, totalRecords: 0, hasData: false };
    }
};

module.exports = {
    saveMarketSummary,
    upsertMarketSummary,
    getLatestMarketSummary,
    getMarketSummaryHistory,
    getMarketSummaryByDate,
    cleanOldSummaries,
    getMarketStats
};
