/**
 * IPO Database Operations - Firestore Implementation
 * Handles all IPO-related database operations
 */

const { getDb } = require('./firebase');
const logger = require('../utils/logger');

const COLLECTION = 'ipos';

/**
 * Save/update multiple IPOs (batch upsert)
 */
const saveIPOs = async (ipos) => {
    if (!ipos || ipos.length === 0) {
        return { success: true, count: 0 };
    }

    try {
        const db = getDb();
        const batch = db.batch();
        let count = 0;

        for (const ipo of ipos) {
            if (!ipo.companyName) continue;

            // Use company name as doc ID (sanitized)
            const docId = ipo.companyName.replace(/[\/\.]/g, '_');
            const docRef = db.collection(COLLECTION).doc(docId);

            batch.set(docRef, {
                ...ipo,
                updatedAt: new Date().toISOString(),
                timestamp: ipo.timestamp || new Date().toISOString()
            }, { merge: true });
            count++;
        }

        await batch.commit();
        logger.debug(`Saved ${count} IPOs to Firestore`);

        return { success: true, count };
    } catch (error) {
        logger.error(`Error saving IPOs: ${error.message}`);
        throw error;
    }
};

/**
 * Get all IPOs with optional filters
 */
const getAllIPOs = async ({ skip = 0, limit = 100, status = null } = {}) => {
    try {
        const db = getDb();
        let query = db.collection(COLLECTION);

        if (status) {
            query = query.where('status', '==', status);
        }

        const snapshot = await query.get();

        // Apply pagination in memory
        const allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const paginatedDocs = allDocs.slice(skip, skip + limit);

        return paginatedDocs;
    } catch (error) {
        logger.error(`Error getting IPOs: ${error.message}`);
        return [];
    }
};

/**
 * Get IPOs by status
 */
const getIPOsByStatus = async (status) => {
    try {
        const db = getDb();

        const snapshot = await db.collection(COLLECTION)
            .where('status', '==', status)
            .get();

        const ipos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        return { ipos, count: ipos.length };
    } catch (error) {
        logger.error(`Error getting IPOs by status: ${error.message}`);
        return { ipos: [], count: 0 };
    }
};

/**
 * Get IPO by company name
 */
const getIPOByCompanyName = async (companyName) => {
    try {
        const db = getDb();

        // Try exact match first (with sanitized ID)
        const docId = companyName.replace(/[\/\.]/g, '_');
        const doc = await db.collection(COLLECTION).doc(docId).get();

        if (doc.exists) {
            return { id: doc.id, ...doc.data() };
        }

        // Try searching by field
        const snapshot = await db.collection(COLLECTION)
            .where('companyName', '==', companyName)
            .limit(1)
            .get();

        if (snapshot.empty) {
            return null;
        }

        const firstDoc = snapshot.docs[0];
        return { id: firstDoc.id, ...firstDoc.data() };
    } catch (error) {
        logger.error(`Error getting IPO ${companyName}: ${error.message}`);
        return null;
    }
};

/**
 * Search IPOs
 */
const searchIPOs = async (query) => {
    try {
        const db = getDb();
        const queryLower = query.toLowerCase();

        // Get all and filter in memory
        const snapshot = await db.collection(COLLECTION).get();

        const results = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(ipo => {
                const name = (ipo.companyName || '').toLowerCase();
                const sector = (ipo.sector || '').toLowerCase();
                const issueManager = (ipo.issueManager || '').toLowerCase();
                return name.includes(queryLower) ||
                    sector.includes(queryLower) ||
                    issueManager.includes(queryLower);
            })
            .slice(0, 50);

        return results;
    } catch (error) {
        logger.error(`Error searching IPOs: ${error.message}`);
        return [];
    }
};

/**
 * Get active (open) IPOs
 */
const getActiveIPOs = async () => {
    try {
        const db = getDb();

        const snapshot = await db.collection(COLLECTION)
            .where('status', 'in', ['open', 'upcoming'])
            .get();

        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        logger.error(`Error getting active IPOs: ${error.message}`);
        return [];
    }
};

/**
 * Get IPO counts by status
 */
const getIPOCounts = async () => {
    try {
        const db = getDb();
        const snapshot = await db.collection(COLLECTION).get();

        const counts = {
            upcoming: 0,
            open: 0,
            closed: 0,
            completed: 0,
            total: snapshot.size
        };

        snapshot.docs.forEach(doc => {
            const status = doc.data().status;
            if (counts.hasOwnProperty(status)) {
                counts[status]++;
            }
        });

        return counts;
    } catch (error) {
        logger.error(`Error getting IPO counts: ${error.message}`);
        return { upcoming: 0, open: 0, closed: 0, completed: 0, total: 0 };
    }
};

module.exports = {
    saveIPOs,
    getAllIPOs,
    getIPOsByStatus,
    getIPOByCompanyName,
    searchIPOs,
    getActiveIPOs,
    getIPOCounts
};
