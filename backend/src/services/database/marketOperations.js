/**
 * Market Summary Database Operations - Prisma Implementation
 */

const { prisma } = require('./connection');
const logger = require('../utils/logger');
const stockOperations = require('./stockOperations');

const mapSummaryOutput = (summary) => {
    if (!summary) return null;
    const ts = summary.timestamp instanceof Date ? summary.timestamp.toISOString() : summary.timestamp;
    return {
        id: summary.id,
        indexValue: summary.indexValue,
        indexChange: summary.indexChange,
        indexChangePercent: summary.indexChangePercent,
        totalTurnover: summary.totalTurnover,
        totalVolume: summary.totalVolume,
        totalTransactions: summary.totalTransactions,
        activeCompanies: summary.activeCompanies,
        advancedCompanies: summary.advancedCompanies,
        declinedCompanies: summary.declinedCompanies,
        unchangedCompanies: summary.unchangedCompanies,
        timestamp: ts,
        updatedAt: ts
    };
};

const saveMarketSummary = async (summary) => {
    if (!summary) return { success: false };
    try {
        await prisma.marketSummary.create({
            data: {
                indexValue: summary.indexValue ?? null,
                indexChange: summary.indexChange ?? null,
                indexChangePercent: summary.indexChangePercent ?? null,
                totalTurnover: summary.totalTurnover ?? null,
                totalVolume: summary.totalVolume ?? null,
                totalTransactions: summary.totalTransactions ?? null,
                activeCompanies: summary.activeCompanies ?? null,
                advancedCompanies: summary.advancedCompanies ?? null,
                declinedCompanies: summary.declinedCompanies ?? null,
                unchangedCompanies: summary.unchangedCompanies ?? null,
                timestamp: summary.timestamp ? new Date(summary.timestamp) : undefined
            }
        });
        return { success: true };
    } catch (error) {
        logger.error(`Error saving market summary: ${error.message}`);
        throw error;
    }
};

const upsertMarketSummary = async (summary) => saveMarketSummary(summary);

const getLatestMarketSummary = async () => {
    try {
        const latest = await prisma.marketSummary.findFirst({
            orderBy: { timestamp: 'desc' }
        });
        return mapSummaryOutput(latest);
    } catch (error) {
        logger.error(`Error getting market summary: ${error.message}`);
        return null;
    }
};

const getMarketSummaryHistory = async (hours = 24) => {
    try {
        const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
        const history = await prisma.marketSummary.findMany({
            where: { timestamp: { gte: cutoff } },
            orderBy: { timestamp: 'desc' },
            take: 100
        });
        return history.map(mapSummaryOutput);
    } catch (error) {
        logger.error(`Error getting market history: ${error.message}`);
        return [];
    }
};

const getMarketSummaryByDate = async (startDate, endDate) => {
    try {
        const where = {};
        if (startDate) where.timestamp = { gte: new Date(startDate) };
        if (endDate) {
            where.timestamp = { ...(where.timestamp || {}), lte: new Date(endDate) };
        }
        const rows = await prisma.marketSummary.findMany({
            where,
            orderBy: { timestamp: 'desc' },
            take: 100
        });
        return rows.map(mapSummaryOutput);
    } catch (error) {
        logger.error(`Error getting market summary by date: ${error.message}`);
        return [];
    }
};

const cleanOldSummaries = async (daysToKeep = 7) => {
    try {
        const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
        const result = await prisma.marketSummary.deleteMany({
            where: { timestamp: { lt: cutoff } }
        });
        logger.info(`Cleaned ${result.count} old market summaries`);
        return result.count;
    } catch (error) {
        logger.error(`Error cleaning old summaries: ${error.message}`);
        return 0;
    }
};

// Top movers are now derived directly from the Stock table for durability
// This ensures single source of truth and persistence across restarts

const saveTopMovers = async () => {
    // Deprecated: Top movers are now derived directly from the Stock table
    // ensuring durability and single source of truth.
    // Keeping this function signature to avoid breaking callers, but it's a no-op.
    logger.debug('saveTopMovers called but is deprecated (using DB derivation)');
    return { success: true };
};

const getTopMovers = async () => {
    try {
        const [
            turnover,
            trade,
            volume,
            gainers,
            losers,
            updatedAt
        ] = await Promise.all([
            stockOperations.getTopTurnover(10),
            stockOperations.getTopTransactions(10),
            stockOperations.getTopVolume(10),
            stockOperations.getTopGainers(10),
            stockOperations.getTopLosers(10),
            stockOperations.getLastStockUpdateTime()
        ]);

        return {
            turnover: turnover || [],
            trade: trade || [],
            volume: volume || [],
            gainers: gainers || [],
            losers: losers || [],
            updatedAt: updatedAt || new Date().toISOString()
        };
    } catch (error) {
        logger.error(`Error getting top movers: ${error.message}`);
        return {
            turnover: [],
            trade: [],
            volume: [],
            gainers: [],
            losers: [],
            updatedAt: null
        };
    }
};

const getMarketStats = async () => {
    try {
        const latest = await getLatestMarketSummary();
        const totalRecords = await prisma.marketSummary.count();
        return {
            latest,
            totalRecords,
            hasData: !!latest
        };
    } catch (error) {
        logger.error(`Error getting market stats: ${error.message}`);
        return { latest: null, totalRecords: 0, hasData: false };
    }
};

/**
 * Calculate the cumulative market change for a given historical timeframe
 * @param {number} latestIndexValue - The current NEPSE index
 * @returns {Promise<Object>} Object containing 1W and 1M percent changes
 */
const getCumulativeMarketChanges = async (latestIndexValue) => {
    if (!latestIndexValue) return { '1W': null, '1M': null };

    // Function to find the closest record to a past date
    const getHistoricalIndex = async (daysAgo) => {
        const targetDate = new Date(Date.now() - (daysAgo * 24 * 60 * 60 * 1000));

        try {
            // First try finding the most recent record BEFORE the target date
            let row = await prisma.marketSummary.findFirst({
                where: { timestamp: { lte: targetDate }, indexValue: { not: null } },
                orderBy: { timestamp: 'desc' },
                select: { indexValue: true }
            });

            // If the database is too new and doesn't have records that far back, 
            // fallback to the *oldest* record available so there's at least some cumulative data
            if (!row) {
                row = await prisma.marketSummary.findFirst({
                    where: { indexValue: { not: null } },
                    orderBy: { timestamp: 'asc' },
                    select: { indexValue: true }
                });
            }
            return row?.indexValue || null;
        } catch (e) {
            return null;
        }
    };

    const index7d = await getHistoricalIndex(7);
    const index30d = await getHistoricalIndex(30);

    const calcChange = (oldVal) => {
        if (!oldVal) return null;
        return Number((((latestIndexValue - oldVal) / oldVal) * 100).toFixed(2));
    };

    return {
        '1W': calcChange(index7d),
        '1M': calcChange(index30d)
    };
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
    getTopMovers,
    getCumulativeMarketChanges
};
