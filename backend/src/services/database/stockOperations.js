/**
 * Stock Database Operations - Firestore Implementation
 * Handles all stock-related database operations
 */

const { getDb } = require('./firebase');
const logger = require('../utils/logger');

const COLLECTION = 'stocks';

/**
 * Save/update multiple stocks (batch upsert)
 */
const saveStocks = async (stocks) => {
    if (!stocks || stocks.length === 0) {
        return { success: true, count: 0 };
    }

    try {
        const db = getDb();
        const batch = db.batch();
        let count = 0;

        for (const stock of stocks) {
            if (!stock.symbol) continue;

            const docRef = db.collection(COLLECTION).doc(stock.symbol);
            batch.set(docRef, {
                ...stock,
                updatedAt: new Date().toISOString(),
                timestamp: stock.timestamp || new Date().toISOString()
            }, { merge: true });
            count++;
        }

        await batch.commit();
        logger.debug(`Saved ${count} stocks to Firestore`);

        return { success: true, count };
    } catch (error) {
        logger.error(`Error saving stocks: ${error.message}`);
        throw error;
    }
};

/**
 * Get all stocks with optional pagination
 * Filters out stocks with no trading data (LTP = 0)
 */
const getAllStocks = async ({ skip = 0, limit = 500, sortBy = 'symbol', sortOrder = 1, includeZeroLtp = false } = {}) => {
    try {
        const db = getDb();
        const direction = sortOrder === -1 || sortOrder === 'desc' ? 'desc' : 'asc';

        let query = db.collection(COLLECTION).orderBy(sortBy, direction);

        const snapshot = await query.get();

        // Apply skip and limit in memory (Firestore doesn't have offset)
        let allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Filter out stocks with no trading data unless explicitly requested
        if (!includeZeroLtp) {
            allDocs = allDocs.filter(stock => stock.ltp > 0 || (stock.prices && stock.prices.ltp > 0));
        }
        
        const paginatedDocs = allDocs.slice(skip, skip + limit);

        return paginatedDocs;
    } catch (error) {
        logger.error(`Error getting stocks: ${error.message}`);
        return [];
    }
};

/**
 * Get stock by symbol
 */
const getStockBySymbol = async (symbol) => {
    try {
        const db = getDb();
        const doc = await db.collection(COLLECTION).doc(symbol.toUpperCase()).get();

        if (!doc.exists) {
            return null;
        }

        return { id: doc.id, ...doc.data() };
    } catch (error) {
        logger.error(`Error getting stock ${symbol}: ${error.message}`);
        return null;
    }
};

/**
 * Search stocks by symbol or company name
 * Only returns stocks with actual trading data
 */
const searchStocks = async (query) => {
    try {
        const db = getDb();
        const queryUpper = query.toUpperCase();
        const queryLower = query.toLowerCase();

        // Get all stocks and filter in memory (Firestore doesn't support LIKE queries)
        const snapshot = await db.collection(COLLECTION).get();

        const results = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(stock => {
                // First check if stock has trading data
                const ltp = stock.ltp || (stock.prices && stock.prices.ltp) || 0;
                if (ltp <= 0) return false;
                
                // Then check if it matches the query
                const symbol = (stock.symbol || '').toUpperCase();
                const name = (stock.companyName || '').toLowerCase();
                return symbol.includes(queryUpper) || name.includes(queryLower);
            })
            .slice(0, 50); // Limit results

        return results;
    } catch (error) {
        logger.error(`Error searching stocks: ${error.message}`);
        return [];
    }
};

/**
 * Get stocks by sector
 */
const getStocksBySector = async (sector) => {
    try {
        const db = getDb();

        const snapshot = await db.collection(COLLECTION)
            .where('sector', '==', sector)
            .get();

        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        logger.error(`Error getting stocks by sector: ${error.message}`);
        return [];
    }
};

/**
 * Get recently updated stocks
 */
const getRecentlyUpdated = async (seconds = 30) => {
    try {
        const db = getDb();
        const cutoff = new Date(Date.now() - seconds * 1000).toISOString();

        const snapshot = await db.collection(COLLECTION)
            .where('updatedAt', '>=', cutoff)
            .get();

        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        logger.error(`Error getting recent stocks: ${error.message}`);
        return [];
    }
};

/**
 * Get stock count (only counts stocks with trading data)
 */
const getStockCount = async (includeZeroLtp = false) => {
    try {
        const db = getDb();
        const snapshot = await db.collection(COLLECTION).get();
        
        if (includeZeroLtp) {
            return snapshot.size;
        }
        
        // Only count stocks with actual trading data
        const activeCount = snapshot.docs.filter(doc => {
            const data = doc.data();
            const ltp = data.ltp || (data.prices && data.prices.ltp) || 0;
            return ltp > 0;
        }).length;
        
        return activeCount;
    } catch (error) {
        logger.error(`Error getting stock count: ${error.message}`);
        return 0;
    }
};

/**
 * Get all sectors
 */
const getAllSectors = async () => {
    try {
        const db = getDb();
        const snapshot = await db.collection(COLLECTION).get();

        const sectors = new Set();
        snapshot.docs.forEach(doc => {
            const sector = doc.data().sector;
            if (sector) sectors.add(sector);
        });

        return Array.from(sectors).sort();
    } catch (error) {
        logger.error(`Error getting sectors: ${error.message}`);
        return [];
    }
};

/**
 * Get top gainers
 */
const getTopGainers = async (limit = 10) => {
    try {
        const db = getDb();

        const snapshot = await db.collection(COLLECTION)
            .orderBy('changePercent', 'desc')
            .limit(limit)
            .get();

        return snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(stock => stock.changePercent > 0);
    } catch (error) {
        logger.error(`Error getting top gainers: ${error.message}`);
        return [];
    }
};

/**
 * Get top losers
 */
const getTopLosers = async (limit = 10) => {
    try {
        const db = getDb();

        const snapshot = await db.collection(COLLECTION)
            .orderBy('changePercent', 'asc')
            .limit(limit)
            .get();

        return snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(stock => stock.changePercent < 0);
    } catch (error) {
        logger.error(`Error getting top losers: ${error.message}`);
        return [];
    }
};

/**
 * Clear all stocks from database (use with caution)
 */
const clearAllStocks = async () => {
    try {
        const db = getDb();
        const snapshot = await db.collection(COLLECTION).get();
        
        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        await batch.commit();
        logger.info(`Cleared ${snapshot.size} stocks from database`);
        
        return { success: true, deleted: snapshot.size };
    } catch (error) {
        logger.error(`Error clearing stocks: ${error.message}`);
        throw error;
    }
};

/**
 * Delete stocks that don't have trading data (LTP = 0 or null)
 * Handles batches of max 500 (Firestore limit)
 */
const deleteInactiveStocks = async () => {
    try {
        const db = getDb();
        const snapshot = await db.collection(COLLECTION).get();
        
        // Find all inactive stocks
        const inactiveDocs = snapshot.docs.filter(doc => {
            const data = doc.data();
            const ltp = data.ltp || (data.prices && data.prices.ltp) || 0;
            return ltp === 0 || ltp === null || ltp === undefined;
        });
        
        let deleteCount = 0;
        
        // Delete in batches of 500 (Firestore limit)
        const batchSize = 500;
        for (let i = 0; i < inactiveDocs.length; i += batchSize) {
            const batch = db.batch();
            const batchDocs = inactiveDocs.slice(i, i + batchSize);
            
            batchDocs.forEach(doc => {
                batch.delete(doc.ref);
                deleteCount++;
            });
            
            await batch.commit();
        }
        
        if (deleteCount > 0) {
            logger.info(`Deleted ${deleteCount} inactive stocks from database`);
        }
        
        return { success: true, deleted: deleteCount };
    } catch (error) {
        logger.error(`Error deleting inactive stocks: ${error.message}`);
        throw error;
    }
};

/**
 * Cleanup inactive stocks and return stats
 * Returns: { removed: number, remaining: number }
 */
const cleanupInactiveStocks = async () => {
    try {
        const db = getDb();
        const snapshot = await db.collection(COLLECTION).get();
        
        // Find all inactive stocks (LTP = 0, null, or missing)
        const inactiveDocs = snapshot.docs.filter(doc => {
            const data = doc.data();
            const ltp = data.ltp || (data.prices && data.prices.ltp) || 0;
            return ltp === 0 || ltp === null || ltp === undefined;
        });
        
        let removed = 0;
        
        // Delete in batches of 500 (Firestore limit)
        const batchSize = 500;
        for (let i = 0; i < inactiveDocs.length; i += batchSize) {
            const batch = db.batch();
            const batchDocs = inactiveDocs.slice(i, i + batchSize);
            
            batchDocs.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            await batch.commit();
            removed += batchDocs.length;
        }
        
        // Count remaining stocks
        const remaining = snapshot.size - removed;
        
        logger.info(`Cleanup complete: removed ${removed} inactive stocks, ${remaining} remaining`);
        
        return { removed, remaining };
    } catch (error) {
        logger.error(`Error in cleanupInactiveStocks: ${error.message}`);
        throw error;
    }
};

/**
 * Remove stocks not in the official NEPSE list
 * @param {Set<string>} validSymbols - Set of valid symbols from NEPSE API
 */
const cleanupInvalidStocks = async (validSymbols) => {
    try {
        const db = getDb();
        const snapshot = await db.collection(COLLECTION).get();
        
        // Find stocks not in valid NEPSE list
        const invalidDocs = snapshot.docs.filter(doc => {
            const data = doc.data();
            const symbol = data.symbol || doc.id;
            return !validSymbols.has(symbol);
        });
        
        let removed = 0;
        const removedSymbols = [];
        
        // Delete in batches of 500 (Firestore limit)
        const batchSize = 500;
        for (let i = 0; i < invalidDocs.length; i += batchSize) {
            const batch = db.batch();
            const batchDocs = invalidDocs.slice(i, i + batchSize);
            
            batchDocs.forEach(doc => {
                removedSymbols.push(doc.data().symbol || doc.id);
                batch.delete(doc.ref);
            });
            
            await batch.commit();
            removed += batchDocs.length;
        }
        
        // Count remaining stocks
        const remaining = snapshot.size - removed;
        
        logger.info(`Cleanup complete: removed ${removed} invalid stocks, ${remaining} remaining`);
        
        return { removed, remaining, removedSymbols };
    } catch (error) {
        logger.error(`Error in cleanupInvalidStocks: ${error.message}`);
        throw error;
    }
};

module.exports = {
    saveStocks,
    getAllStocks,
    getStockBySymbol,
    searchStocks,
    getStocksBySector,
    getRecentlyUpdated,
    getStockCount,
    getAllSectors,
    getTopGainers,
    getTopLosers,
    clearAllStocks,
    deleteInactiveStocks,
    cleanupInactiveStocks,
    cleanupInvalidStocks
};
