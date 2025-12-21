/**
 * Local JSON File Storage
 * Provides in-memory storage with JSON file persistence
 * Data is persisted to disk and loaded into memory for fast access
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

// Data directory for JSON files
const DATA_DIR = path.join(__dirname, '..', '..', '..', 'data');

// In-memory data store
const store = {
    stocks: new Map(),
    marketSummary: null,
    marketHistory: [],
    ipos: new Map(),
    topMovers: {
        turnover: [],
        trade: [],
        volume: [],
        gainers: [],
        losers: []
    }
};

// File paths
const FILES = {
    stocks: path.join(DATA_DIR, 'stocks.json'),
    marketSummary: path.join(DATA_DIR, 'marketSummary.json'),
    marketHistory: path.join(DATA_DIR, 'marketHistory.json'),
    ipos: path.join(DATA_DIR, 'ipos.json'),
    topMovers: path.join(DATA_DIR, 'topMovers.json')
};

// Debounce timers for saving
const saveTimers = {};
// Write locks to prevent race conditions between debounced and immediate writes
const writeLocks = {};
const SAVE_DEBOUNCE = 2000; // 2 seconds

/**
 * Generate a safe, normalized key from a company name
 * - Normalizes unicode to NFKD form
 * - Replaces non-alphanumeric characters with underscores
 * - Converts to lowercase
 * - Collapses consecutive underscores
 * - Trims leading/trailing underscores
 * @param {string} companyName - The company name to normalize
 * @param {string} fallbackId - Fallback ID if name is empty/missing
 * @param {Map} existingKeys - Map of existing keys to check for collisions
 * @returns {string} A safe, unique key
 */
const generateSafeKey = (companyName, fallbackId = null, existingKeys = null) => {
    if (!companyName || typeof companyName !== 'string') {
        return fallbackId || `ipo_${Date.now()}`;
    }

    // Normalize unicode (NFKD decomposes characters)
    let key = companyName.normalize('NFKD');

    // Remove diacritical marks (combining characters)
    key = key.replace(/[\u0300-\u036f]/g, '');

    // Replace all non-alphanumeric ASCII characters with underscores
    key = key.replace(/[^A-Za-z0-9]/g, '_');

    // Convert to lowercase
    key = key.toLowerCase();

    // Collapse consecutive underscores
    key = key.replace(/_+/g, '_');

    // Trim leading/trailing underscores
    key = key.replace(/^_+|_+$/g, '');

    // If key is empty after processing, use fallback
    if (!key) {
        return fallbackId || `ipo_${Date.now()}`;
    }

    // Check for collisions if existingKeys map is provided
    if (existingKeys && existingKeys.has(key)) {
        // Append fallbackId or timestamp to make unique
        const suffix = fallbackId || Date.now().toString(36);
        key = `${key}_${suffix}`;
    }

    return key;
};

/**
 * Clear pending timer for a key
 * @param {string} key - The storage key
 */
const clearPendingTimer = (key) => {
    if (saveTimers[key]) {
        clearTimeout(saveTimers[key]);
        saveTimers[key] = null;
    }
};

/**
 * Acquire write lock for a key
 * @param {string} key - The storage key
 * @returns {boolean} True if lock acquired, false if already locked
 */
const acquireWriteLock = (key) => {
    if (writeLocks[key]) {
        return false; // Already locked
    }
    writeLocks[key] = true;
    return true;
};

/**
 * Release write lock for a key
 * @param {string} key - The storage key
 */
const releaseWriteLock = (key) => {
    writeLocks[key] = false;
};

/**
 * Perform the actual file write
 * @param {string} key - The storage key
 * @param {any} data - Data to write
 * @param {boolean} isImmediate - Whether this is an immediate write
 */
const performWrite = (key, data, isImmediate = false) => {
    try {
        ensureDataDir();
        const filePath = FILES[key];
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        logger.debug(`Saved ${key} to ${filePath}${isImmediate ? ' (immediate)' : ''}`);
    } catch (error) {
        logger.error(`Error saving ${key}: ${error.message}`);
        throw error;
    }
};

/**
 * Ensure data directory exists
 */
const ensureDataDir = () => {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        logger.info(`Created data directory: ${DATA_DIR}`);
    }
};

/**
 * Load data from JSON file
 */
const loadFile = (filePath, defaultValue = null) => {
    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        logger.error(`Error loading ${filePath}: ${error.message}`);
    }
    return defaultValue;
};

/**
 * Save data to JSON file (debounced)
 * Will not execute if a write lock is held (immediate write in progress)
 */
const saveFile = (key, data) => {
    // Clear any existing pending timer
    clearPendingTimer(key);

    // Debounce the save
    saveTimers[key] = setTimeout(() => {
        // Check if write lock is held (immediate write in progress)
        if (writeLocks[key]) {
            logger.debug(`Skipping debounced write for ${key} - immediate write in progress`);
            return;
        }

        // Acquire lock for debounced write
        if (!acquireWriteLock(key)) {
            logger.debug(`Could not acquire lock for debounced write of ${key}`);
            return;
        }

        try {
            performWrite(key, data, false);
        } finally {
            releaseWriteLock(key);
        }
    }, SAVE_DEBOUNCE);
};

/**
 * Force immediate save (used on shutdown)
 * Cancels any pending debounced writes and acquires lock before writing
 */
const saveFileImmediate = (key, data) => {
    // Clear any pending debounced timer to prevent stale writes
    clearPendingTimer(key);

    // Acquire write lock
    acquireWriteLock(key);

    try {
        performWrite(key, data, true);
    } finally {
        releaseWriteLock(key);
    }
};

/**
 * Initialize local storage - load all data from disk
 */
const initializeLocalStorage = () => {
    ensureDataDir();

    // Load stocks
    const stocksData = loadFile(FILES.stocks, []);
    if (Array.isArray(stocksData)) {
        stocksData.forEach(stock => {
            if (stock.symbol) {
                store.stocks.set(stock.symbol, stock);
            }
        });
    }
    logger.info(`Loaded ${store.stocks.size} stocks from local storage`);

    // Load market summary
    store.marketSummary = loadFile(FILES.marketSummary, null);
    logger.info(`Loaded market summary: ${store.marketSummary ? 'yes' : 'no'}`);

    // Load market history
    store.marketHistory = loadFile(FILES.marketHistory, []);
    logger.info(`Loaded ${store.marketHistory.length} market history records`);

    // Load IPOs
    const iposData = loadFile(FILES.ipos, []);
    if (Array.isArray(iposData)) {
        iposData.forEach(ipo => {
            const key = generateSafeKey(ipo.companyName, ipo.id, store.ipos);
            if (key) {
                store.ipos.set(key, ipo);
            }
        });
    }
    // Load Top Movers
    store.topMovers = loadFile(FILES.topMovers, {
        turnover: [],
        trade: [],
        volume: []
    });
    logger.info(`Loaded top movers: ${store.topMovers.updatedAt ? 'yes' : 'no'}`);

    return true;
}

/**
 * Save all data to disk immediately
 */
const saveAllData = () => {
    saveFileImmediate('stocks', Array.from(store.stocks.values()));
    saveFileImmediate('marketSummary', store.marketSummary);
    saveFileImmediate('marketHistory', store.marketHistory);
    saveFileImmediate('ipos', Array.from(store.ipos.values()));
    saveFileImmediate('topMovers', store.topMovers);
    logger.info('All data saved to local storage');
};

// ==================== Stock Operations ====================

const stockOps = {
    /**
     * Save/update multiple stocks
     */
    saveStocks: (stocks) => {
        if (!stocks || stocks.length === 0) {
            return { success: true, count: 0 };
        }

        let count = 0;
        const timestamp = new Date().toISOString();

        for (const stock of stocks) {
            if (!stock.symbol) continue;

            // Strip isTopGainer/isTopLoser flags - these should be computed at query time
            const { isTopGainer, isTopLoser, ...cleanStock } = stock;

            const existing = store.stocks.get(stock.symbol) || {};

            // Validation Gate: Check for valid LTP
            const newLtp = cleanStock.ltp || (cleanStock.prices && cleanStock.prices.ltp) || 0;
            const hasValidLtp = newLtp > 0;

            if (hasValidLtp) {
                // If we have valid price, update everything
                store.stocks.set(stock.symbol, {
                    ...existing,
                    ...cleanStock,
                    updatedAt: timestamp,
                    timestamp: cleanStock.timestamp || timestamp
                });
            } else {
                // Database Shield: New data has invalid/zero price.
                // Preserve existing price data but update other fields if available
                const preservedStock = {
                    ...cleanStock, // New data (might have volume adjustments even if price is 0?)
                    // Overwrite with existing price data if present
                    ltp: existing.ltp || cleanStock.ltp,
                    change: existing.change || cleanStock.change,
                    changePercent: existing.changePercent || cleanStock.changePercent,
                    prices: existing.prices || cleanStock.prices
                };

                // If existing record had valid data, ensure we don't zero it out
                if (existing.ltp > 0) {
                    logger.debug(`Preserving LTP for ${stock.symbol}: New=${newLtp}, Old=${existing.ltp}`);
                }

                store.stocks.set(stock.symbol, {
                    ...existing,
                    ...preservedStock,
                    updatedAt: timestamp
                });
            }
            count++;
        }

        // Trigger debounced save
        saveFile('stocks', Array.from(store.stocks.values()));

        return { success: true, count };
    },

    /**
     * Get all stocks with pagination
     */
    getAllStocks: ({ skip = 0, limit = 500, sortBy = 'symbol', sortOrder = 1, includeZeroLtp = true } = {}) => {
        let stocks = Array.from(store.stocks.values());

        // Filter out zero LTP stocks unless requested
        if (!includeZeroLtp) {
            stocks = stocks.filter(stock => {
                const ltp = stock.ltp || (stock.prices && stock.prices.ltp) || 0;
                return ltp > 0;
            });
        }

        // Sort
        const direction = sortOrder === -1 || sortOrder === 'desc' ? -1 : 1;
        stocks.sort((a, b) => {
            const aVal = a[sortBy] || '';
            const bVal = b[sortBy] || '';
            if (typeof aVal === 'string') {
                return direction * aVal.localeCompare(bVal);
            }
            return direction * ((aVal || 0) - (bVal || 0));
        });

        // Paginate
        return stocks.slice(skip, skip + limit);
    },

    /**
     * Get stock by symbol
     */
    getStockBySymbol: (symbol) => {
        const stock = store.stocks.get(symbol.toUpperCase());
        return stock ? { id: stock.symbol, ...stock } : null;
    },

    /**
     * Search stocks
     */
    searchStocks: (query) => {
        const queryUpper = query.toUpperCase();
        const queryLower = query.toLowerCase();

        return Array.from(store.stocks.values())
            .filter(stock => {
                const symbol = (stock.symbol || '').toUpperCase();
                const name = (stock.companyName || '').toLowerCase();
                return symbol.includes(queryUpper) || name.includes(queryLower);
            })
            .slice(0, 50);
    },

    /**
     * Get stocks by sector
     */
    getStocksBySector: (sector) => {
        return Array.from(store.stocks.values())
            .filter(stock => stock.sector === sector);
    },

    /**
     * Get recently updated stocks
     */
    getRecentlyUpdated: (seconds = 30) => {
        const cutoff = new Date(Date.now() - seconds * 1000).toISOString();
        return Array.from(store.stocks.values())
            .filter(stock => stock.updatedAt >= cutoff);
    },

    /**
     * Get stock count
     */
    getStockCount: (includeZeroLtp = false) => {
        if (includeZeroLtp) {
            return store.stocks.size;
        }
        return Array.from(store.stocks.values())
            .filter(stock => {
                const ltp = stock.ltp || (stock.prices && stock.prices.ltp) || 0;
                return ltp > 0;
            }).length;
    },

    /**
     * Get all sectors
     */
    getAllSectors: () => {
        const sectors = new Set();
        store.stocks.forEach(stock => {
            if (stock.sector) sectors.add(stock.sector);
        });
        return Array.from(sectors).sort();
    },

    /**
     * Get top gainers
     */
    getTopGainers: (limit = 10) => {
        return Array.from(store.stocks.values())
            .filter(stock => (stock.changePercent || 0) > 0)
            .sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0))
            .slice(0, limit);
    },

    /**
     * Get top losers
     */
    getTopLosers: (limit = 10) => {
        return Array.from(store.stocks.values())
            .filter(stock => (stock.changePercent || 0) < 0)
            .sort((a, b) => (a.changePercent || 0) - (b.changePercent || 0))
            .slice(0, limit);
    },

    /**
     * Get stocks with no change
     */
    getUnchangedStocks: (limit = 10) => {
        return Array.from(store.stocks.values())
            .filter(stock => {
                const ltp = stock.ltp || (stock.prices && stock.prices.ltp) || 0;
                return ltp > 0 && (stock.changePercent === 0 || stock.change === 0);
            })
            .slice(0, limit);
    },

    /**
     * Get top traded stocks (by volume/turnover)
     */
    getTopTraded: (limit = 10) => {
        return Array.from(store.stocks.values())
            .filter(stock => {
                const ltp = stock.ltp || (stock.prices && stock.prices.ltp) || 0;
                return ltp > 0;
            })
            .sort((a, b) => {
                const aVol = a.volume || a.totalTradedQuantity || 0;
                const bVol = b.volume || b.totalTradedQuantity || 0;
                return bVol - aVol;
            })
            .slice(0, limit);
    },

    /**
     * Clear all stocks
     */
    clearAllStocks: () => {
        const count = store.stocks.size;
        store.stocks.clear();
        saveFile('stocks', []);
        return { success: true, deleted: count };
    },

    /**
     * Delete inactive stocks (LTP = 0)
     */
    deleteInactiveStocks: () => {
        let deleteCount = 0;
        store.stocks.forEach((stock, symbol) => {
            const ltp = stock.ltp || (stock.prices && stock.prices.ltp) || 0;
            if (ltp === 0 || ltp === null || ltp === undefined) {
                store.stocks.delete(symbol);
                deleteCount++;
            }
        });
        if (deleteCount > 0) {
            saveFile('stocks', Array.from(store.stocks.values()));
        }
        return { success: true, deleted: deleteCount };
    },

    /**
     * Cleanup inactive stocks
     */
    cleanupInactiveStocks: () => {
        const initial = store.stocks.size;
        const result = stockOps.deleteInactiveStocks();
        return { removed: result.deleted, remaining: initial - result.deleted };
    },

    /**
     * Remove stocks not in valid NEPSE list
     */
    cleanupInvalidStocks: (validSymbols) => {
        const initial = store.stocks.size;
        const removedSymbols = [];

        store.stocks.forEach((stock, symbol) => {
            if (!validSymbols.has(symbol)) {
                removedSymbols.push(symbol);
                store.stocks.delete(symbol);
            }
        });

        if (removedSymbols.length > 0) {
            saveFile('stocks', Array.from(store.stocks.values()));
        }

        return {
            removed: removedSymbols.length,
            remaining: store.stocks.size,
            removedSymbols
        };
    }
};

// ==================== Market Operations ====================

const marketOps = {
    /**
     * Save market summary
     */
    saveMarketSummary: (summary) => {
        if (!summary) return { success: false };

        const timestamp = new Date().toISOString();
        const data = {
            ...summary,
            timestamp,
            updatedAt: timestamp
        };

        store.marketSummary = data;
        saveFile('marketSummary', data);

        // Add to history
        store.marketHistory.unshift(data);
        // Keep last 1000 records
        if (store.marketHistory.length > 1000) {
            store.marketHistory = store.marketHistory.slice(0, 1000);
        }
        saveFile('marketHistory', store.marketHistory);

        return { success: true };
    },

    /**
     * Upsert market summary (same as save)
     */
    upsertMarketSummary: (summary) => {
        return marketOps.saveMarketSummary(summary);
    },

    /**
     * Get latest market summary
     */
    getLatestMarketSummary: () => {
        return store.marketSummary ? { id: 'current', ...store.marketSummary } : null;
    },

    /**
     * Get market summary history
     */
    getMarketSummaryHistory: (hours = 24) => {
        const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
        return store.marketHistory
            .filter(h => h.timestamp >= cutoff)
            .slice(0, 100);
    },

    /**
     * Get market summary by date range
     */
    getMarketSummaryByDate: (startDate, endDate) => {
        let filtered = store.marketHistory;

        if (startDate) {
            const start = new Date(startDate).toISOString();
            filtered = filtered.filter(h => h.timestamp >= start);
        }
        if (endDate) {
            const end = new Date(endDate).toISOString();
            filtered = filtered.filter(h => h.timestamp <= end);
        }

        return filtered.slice(0, 100);
    },

    /**
     * Clean old summaries
     */
    cleanOldSummaries: (daysToKeep = 7) => {
        const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString();
        const initial = store.marketHistory.length;
        store.marketHistory = store.marketHistory.filter(h => h.timestamp >= cutoff);
        const deleted = initial - store.marketHistory.length;
        if (deleted > 0) {
            saveFile('marketHistory', store.marketHistory);
        }
        return deleted;
    },

    /**
     * Save top movers lists
     */
    saveTopMovers: (turnover, trade, volume, gainers, losers) => {
        store.topMovers = {
            turnover: turnover || [],
            trade: trade || [],
            volume: volume || [],
            gainers: gainers || [],
            losers: losers || [],
            updatedAt: new Date().toISOString()
        };
        saveFile('topMovers', store.topMovers);
        return { success: true };
    },

    /**
     * Get top movers
     */
    getTopMovers: () => {
        return store.topMovers;
    },

    /**
     * Get market stats
     */
    getMarketStats: () => {
        return {
            latest: store.marketSummary,
            totalRecords: store.marketHistory.length,
            hasData: store.marketSummary !== null
        };
    }
};

// ==================== IPO Operations ====================

const ipoOps = {
    /**
     * Save/update multiple IPOs
     */
    saveIPOs: (ipos) => {
        if (!ipos || ipos.length === 0) {
            return { success: true, count: 0 };
        }

        let count = 0;
        const timestamp = new Date().toISOString();

        for (const ipo of ipos) {
            if (!ipo.companyName) continue;

            const key = generateSafeKey(ipo.companyName, ipo.id, store.ipos);
            const existing = store.ipos.get(key) || {};

            store.ipos.set(key, {
                ...existing,
                ...ipo,
                updatedAt: timestamp,
                timestamp: ipo.timestamp || timestamp
            });
            count++;
        }

        saveFile('ipos', Array.from(store.ipos.values()));
        return { success: true, count };
    },

    /**
     * Get all IPOs
     */
    getAllIPOs: ({ skip = 0, limit = 100, status = null } = {}) => {
        let ipos = Array.from(store.ipos.values());

        if (status) {
            ipos = ipos.filter(ipo => ipo.status === status);
        }

        return ipos.slice(skip, skip + limit);
    },

    /**
     * Get IPOs by status
     */
    getIPOsByStatus: (status) => {
        const ipos = Array.from(store.ipos.values())
            .filter(ipo => ipo.status === status);
        return { ipos, count: ipos.length };
    },

    /**
     * Get IPO by company name
     */
    getIPOByCompanyName: (companyName) => {
        const key = generateSafeKey(companyName);
        const ipo = store.ipos.get(key);

        if (ipo) {
            return { id: key, ...ipo };
        }

        // Search by field (fallback for exact match)
        for (const [k, v] of store.ipos) {
            if (v.companyName === companyName) {
                return { id: k, ...v };
            }
        }

        // Search by normalized key match (partial)
        const keyLower = key.toLowerCase();
        for (const [k, v] of store.ipos) {
            if (k.includes(keyLower) || keyLower.includes(k)) {
                return { id: k, ...v };
            }
        }

        return null;
    },

    /**
     * Search IPOs
     */
    searchIPOs: (query) => {
        const queryLower = query.toLowerCase();

        return Array.from(store.ipos.values())
            .filter(ipo => {
                const name = (ipo.companyName || '').toLowerCase();
                const sector = (ipo.sector || '').toLowerCase();
                const issueManager = (ipo.issueManager || '').toLowerCase();
                return name.includes(queryLower) ||
                    sector.includes(queryLower) ||
                    issueManager.includes(queryLower);
            })
            .slice(0, 50);
    },

    /**
     * Get active IPOs
     */
    getActiveIPOs: () => {
        return Array.from(store.ipos.values())
            .filter(ipo => ipo.status === 'open' || ipo.status === 'upcoming');
    },

    /**
     * Get IPO counts
     */
    getIPOCounts: () => {
        const counts = {
            upcoming: 0,
            open: 0,
            closed: 0,
            completed: 0,
            total: store.ipos.size
        };

        store.ipos.forEach(ipo => {
            if (counts.hasOwnProperty(ipo.status)) {
                counts[ipo.status]++;
            }
        });

        return counts;
    }
};

// Handle graceful shutdown
process.on('SIGINT', () => {
    logger.info('SIGINT received. Saving data before shutdown...');
    try {
        saveAllData();
        logger.info('Data saved successfully. Exiting...');
        process.exit(0);
    } catch (error) {
        logger.error(`Error saving data on SIGINT: ${error.message}`);
        process.exit(1);
    }
});

process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Saving data before shutdown...');
    try {
        saveAllData();
        logger.info('Data saved successfully. Exiting...');
        process.exit(0);
    } catch (error) {
        logger.error(`Error saving data on SIGTERM: ${error.message}`);
        process.exit(1);
    }
});

module.exports = {
    initializeLocalStorage,
    saveAllData,
    stockOps,
    marketOps,
    ipoOps,
    /**
     * Get a read-only snapshot of the current store state.
     * Returns a deep-cloned copy to prevent external mutation.
     * 
     * @warning This is intended for debugging/testing only.
     * Do not use in production code paths as deep cloning is expensive.
     * @returns {Object} Deep-cloned snapshot of the store
     */
    getStoreSnapshot: () => {
        // Convert Maps to arrays for JSON serialization, then deep clone
        const snapshot = {
            stocks: Array.from(store.stocks.values()),
            marketSummary: store.marketSummary,
            marketHistory: store.marketHistory,
            ipos: Array.from(store.ipos.values()),
            topMovers: store.topMovers
        };
        // Deep clone to prevent mutation
        return JSON.parse(JSON.stringify(snapshot));
    }
};
