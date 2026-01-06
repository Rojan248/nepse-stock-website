/**
 * Market Summary Database Operations - Prisma Implementation
 */

const { prisma } = require('./connection');
const logger = require('../utils/logger');

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

// Top movers are kept in-memory for now; can be persisted in DB later if needed
let topMovers = {
    turnover: [],
    trade: [],
    volume: [],
    gainers: [],
    losers: [],
    updatedAt: null
};

const saveTopMovers = async (turnover, trade, volume, gainers, losers) => {
    try {
        topMovers = {
            turnover: turnover || [],
            trade: trade || [],
            volume: volume || [],
            gainers: gainers || [],
            losers: losers || [],
            updatedAt: new Date().toISOString()
        };
        return { success: true };
    } catch (error) {
        logger.error(`Error saving top movers: ${error.message}`);
        return { success: false };
    }
};

const getTopMovers = async () => topMovers;

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
