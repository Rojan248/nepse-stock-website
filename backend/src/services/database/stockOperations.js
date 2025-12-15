/**
 * Stock Database Operations - Local Storage Implementation
 * Handles all stock-related database operations using local JSON storage
 */

const { stockOps } = require('./localStorage');
const logger = require('../utils/logger');

/**
 * Save/update multiple stocks (batch upsert)
 */
const saveStocks = async (stocks) => {
    try {
        return stockOps.saveStocks(stocks);
    } catch (error) {
        logger.error(`Error saving stocks: ${error.message}`);
        throw error;
    }
};

/**
 * Get all stocks with optional pagination
 * Filters out stocks with no trading data (LTP = 0)
 */
const getAllStocks = async (options = {}) => {
    try {
        return stockOps.getAllStocks(options);
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
        return stockOps.getStockBySymbol(symbol);
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
        return stockOps.searchStocks(query);
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
        return stockOps.getStocksBySector(sector);
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
        return stockOps.getRecentlyUpdated(seconds);
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
        return stockOps.getStockCount(includeZeroLtp);
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
        return stockOps.getAllSectors();
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
        return stockOps.getTopGainers(limit);
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
        return stockOps.getTopLosers(limit);
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
        return stockOps.clearAllStocks();
    } catch (error) {
        logger.error(`Error clearing stocks: ${error.message}`);
        throw error;
    }
};

/**
 * Delete stocks that don't have trading data (LTP = 0 or null)
 */
const deleteInactiveStocks = async () => {
    try {
        const result = stockOps.deleteInactiveStocks();
        if (result.deleted > 0) {
            logger.info(`Deleted ${result.deleted} inactive stocks from database`);
        }
        return result;
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
        const result = stockOps.cleanupInactiveStocks();
        logger.info(`Cleanup complete: removed ${result.removed} inactive stocks, ${result.remaining} remaining`);
        return result;
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
        const result = stockOps.cleanupInvalidStocks(validSymbols);
        logger.info(`Cleanup complete: removed ${result.removed} invalid stocks, ${result.remaining} remaining`);
        return result;
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
