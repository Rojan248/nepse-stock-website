/**
 * Market Summary Database Operations - Local Storage Implementation
 * Handles market summary data operations using local JSON storage
 */

const { marketOps } = require('./localStorage');
const logger = require('../utils/logger');

/**
 * Save market summary (updates current document)
 */
const saveMarketSummary = async (summary) => {
    try {
        return marketOps.saveMarketSummary(summary);
    } catch (error) {
        logger.error(`Error saving market summary: ${error.message}`);
        throw error;
    }
};

/**
 * Upsert market summary (same as save)
 */
const upsertMarketSummary = async (summary) => {
    return saveMarketSummary(summary);
};

/**
 * Get latest market summary
 */
const getLatestMarketSummary = async () => {
    try {
        return marketOps.getLatestMarketSummary();
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
        return marketOps.getMarketSummaryHistory(hours);
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
        return marketOps.getMarketSummaryByDate(startDate, endDate);
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
        const deleted = marketOps.cleanOldSummaries(daysToKeep);
        logger.info(`Cleaned ${deleted} old market summaries`);
        return deleted;
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
        return marketOps.getMarketStats();
    } catch (error) {
        logger.error(`Error getting market stats: ${error.message}`);
        return { latest: null, totalRecords: 0, hasData: false };
    }
};

/**
 * Save top movers
 */
const saveTopMovers = async (turnover, trade, volume, gainers, losers) => {
    try {
        return marketOps.saveTopMovers(turnover, trade, volume, gainers, losers);
    } catch (error) {
        logger.error(`Error saving top movers: ${error.message}`);
        return { success: false };
    }
};

/**
 * Get top movers
 */
const getTopMovers = async () => {
    try {
        return marketOps.getTopMovers();
    } catch (error) {
        logger.error(`Error getting top movers: ${error.message}`);
        return null;
    }
};

module.exports = {
    saveMarketSummary,
    upsertMarketSummary,
    getLatestMarketSummary,
    getMarketSummaryHistory,
    getMarketSummaryByDate,
    cleanOldSummaries,
    getMarketStats,
    saveTopMovers,
    getTopMovers
};
