/**
 * IPO Database Operations - Local Storage Implementation
 * Handles all IPO-related database operations using local JSON storage
 */

const { ipoOps } = require('./localStorage');
const logger = require('../utils/logger');

/**
 * Save/update multiple IPOs (batch upsert)
 */
const saveIPOs = async (ipos) => {
    try {
        return ipoOps.saveIPOs(ipos);
    } catch (error) {
        logger.error(`Error saving IPOs: ${error.message}`);
        throw error;
    }
};

/**
 * Get all IPOs with optional filters
 */
const getAllIPOs = async (options = {}) => {
    try {
        return ipoOps.getAllIPOs(options);
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
        return ipoOps.getIPOsByStatus(status);
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
        return ipoOps.getIPOByCompanyName(companyName);
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
        return ipoOps.searchIPOs(query);
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
        return ipoOps.getActiveIPOs();
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
        return ipoOps.getIPOCounts();
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
