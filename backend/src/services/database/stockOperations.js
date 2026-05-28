/**
 * Stock Database Operations - Prisma Implementation
 * 
 * Refactored in Phase 7 to reduce error handling duplication
 */

const { prisma } = require('./connection');
const logger = require('../utils/logger');
const { isKnownSymbol } = require('../../services/dataEnricher');
const { normalizeStockInput, mapStockOutput } = require('../utils/dataNormalizer');

// ==================== Helper Functions ====================

/**
 * Safe database operation wrapper - handles errors with consistent logging
 * @param {Function} operation - Async function that performs the DB operation
 * @param {any} defaultValue - Value to return on error (if not throwing)
 * @param {string} errorMsg - Error message prefix for logging
 * @param {boolean} shouldThrow - Whether to throw the error or return default
 * @returns {Promise<any>}
 */
const safeDbOperation = async (operation, defaultValue, errorMsg, shouldThrow = false) => {
    try {
        return await operation();
    } catch (error) {
        logger.error(`${errorMsg}: ${error.message}`);
        if (shouldThrow) throw error;
        return defaultValue;
    }
};

/** Check whether the existing price should be preserved (incoming LTP is zero) */
const shouldPreservePrice = (existingLtp, newLtp) =>
    existingLtp && existingLtp > 0 && newLtp === 0;

const preserveIfMissing = (incoming, existing, field) => {
    if (incoming[field] && incoming[field] > 0) return incoming[field];
    return existing?.[field] && existing[field] > 0 ? existing[field] : incoming[field];
};

const mergeSparsePriceFields = (data, existing) => ({
    ...data,
    previousClose: preserveIfMissing(data, existing, 'previousClose'),
    openPrice: preserveIfMissing(data, existing, 'openPrice'),
    highPrice: preserveIfMissing(data, existing, 'highPrice'),
    lowPrice: preserveIfMissing(data, existing, 'lowPrice')
});

/** Build the Prisma operation for a single stock save (upsert or timestamp-only update) */
const buildStockSaveOp = (data, existingMap) => {
    const existing = existingMap.get(data.symbol);
    const existingLtp = existing?.lastTradedPrice;
    const mergedData = mergeSparsePriceFields(data, existing);
    const newLtp = mergedData.lastTradedPrice || 0;

    if (shouldPreservePrice(existingLtp, newLtp)) {
        logger.debug(`[${data.symbol}] Preserving existing LTP=${existingLtp} (incoming LTP=0)`);
        return prisma.stock.update({
            where: { symbol: data.symbol },
            data: { updatedAt: new Date() }
        });
    }

    return prisma.stock.upsert({
        where: { symbol: data.symbol },
        update: mergedData,
        create: mergedData
    });
};

/** Recalculate change & percentageChange to ensure mathematical consistency */
const ensurePriceConsistency = (stock) => {
    const ltp = stock.lastTradedPrice;
    const prev = stock.previousClose;
    let change = stock.change;
    let pChange = stock.percentageChange;

    const canRecalculate = ltp && prev && prev > 0;
    if (!canRecalculate) return { change, pChange };

    const calcChange = ltp - prev;
    const changeDeviates = Math.abs(calcChange - (change || 0)) > 0.01;
    if (changeDeviates) {
        logger.debug(`[${stock.symbol}] Fixing Change: Was ${change}, Now ${calcChange.toFixed(2)}`);
        change = parseFloat(calcChange.toFixed(2));
    }

    const calcPct = (calcChange / prev) * 100;
    const pctDeviates = Math.abs(calcPct - (pChange || 0)) > 0.01;
    if (pctDeviates) {
        logger.debug(`[${stock.symbol}] Fixing % Change: Was ${pChange}%, Now ${calcPct.toFixed(2)}%`);
        pChange = parseFloat(calcPct.toFixed(2));
    }

    return { change, pChange };
};

/** Build the history data object for a single stock snapshot */
const buildHistoryRecord = (stock, today) => {
    const { change, pChange } = ensurePriceConsistency(stock);
    return {
        symbol: stock.symbol,
        date: today,
        closePrice: stock.lastTradedPrice,
        highPrice: stock.highPrice,
        lowPrice: stock.lowPrice,
        volume: stock.volume,
        turnover: stock.turnover,
        change,
        percentageChange: pChange
    };
};

/** Categorize a stock into create or update for the daily snapshot */
const categorizeStockForSnapshot = ({ stock, today, existingMap, createData, updateOps, tx }) => {
    const record = buildHistoryRecord(stock, today);
    const existing = existingMap.get(stock.symbol);

    if (existing) {
        const { symbol, date, ...updateFields } = record;
        updateOps.push(tx.marketHistory.update({
            where: { id: existing.id },
            data: updateFields
        }));
    } else {
        createData.push(record);
    }
};

/**
 * Fetch stocks with common pattern: query -> map to output format
 * @param {Object} options - Prisma findMany options
 * @param {string} errorMsg - Error message for logging
 * @returns {Promise<Array>}
 */
const fetchStocksWithMapping = async (options, errorMsg) => {
    return safeDbOperation(async () => {
        const stocks = await prisma.stock.findMany(options);
        return stocks.map(mapStockOutput);
    }, [], errorMsg);
};
// ==================== Untraded Stock Reset ====================

/** Check if a stock's daily metrics need resetting */
/** Check if a stock's daily metrics need resetting */
const needsReset = (s) => {
    const activityFields = ['change', 'percentageChange', 'volume', 'turnover', 'totalTrades'];
    const hasActivity = activityFields.some(f => s[f] !== 0);
    return hasActivity || s.previousClose !== s.lastTradedPrice;
};

const RESET_DATA = { change: 0, percentageChange: 0, volume: 0, turnover: 0, totalTrades: 0 };

/** Build Prisma update ops to reset daily metrics for stocks not in the traded list */
const buildUntradedResetOps = async (tradedSymbols) => {
    const untradedStocks = await prisma.stock.findMany({
        where: { symbol: { notIn: tradedSymbols } },
        select: { symbol: true, lastTradedPrice: true, previousClose: true, change: true, percentageChange: true, volume: true, turnover: true, totalTrades: true }
    });

    return untradedStocks
        .filter(needsReset)
        .map(s => prisma.stock.update({
            where: { symbol: s.symbol },
            data: { ...RESET_DATA, previousClose: s.lastTradedPrice }
        }));
};

// ==================== Core Operations ====================

const filterValidStocks = (stocks) => stocks.filter(s => s && s.symbol);

const saveStocks = async (stocks) => {
    if (!Array.isArray(stocks) || stocks.length === 0) {
        return { success: true, count: 0 };
    }

    try {
        const validStocks = filterValidStocks(stocks);
        if (validStocks.length === 0) return { success: true, count: 0 };

        const symbols = validStocks.map(s => s.symbol.toUpperCase());
        const existingStocks = await prisma.stock.findMany({
            where: { symbol: { in: symbols } },
            select: { symbol: true, lastTradedPrice: true, previousClose: true, openPrice: true, highPrice: true, lowPrice: true }
        });
        const existingMap = new Map(existingStocks.map(s => [s.symbol, s]));

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const ops = validStocks.flatMap((stock) => {
            const rawNormalized = normalizeStockInput(stock);
            const normalized = mergeSparsePriceFields(rawNormalized, existingMap.get(rawNormalized.symbol));
            const stockOp = buildStockSaveOp(normalized, existingMap);
            
            const { change, pChange } = ensurePriceConsistency(normalized);
            const historyOp = prisma.marketHistory.upsert({
                where: {
                    symbol_date: {
                        symbol: normalized.symbol,
                        date: today
                    }
                },
                update: {
                    openPrice: normalized.openPrice,
                    closePrice: normalized.lastTradedPrice,
                    highPrice: normalized.highPrice,
                    lowPrice: normalized.lowPrice,
                    volume: normalized.volume,
                    turnover: normalized.turnover,
                    change,
                    percentageChange: pChange
                },
                create: {
                    symbol: normalized.symbol,
                    date: today,
                    openPrice: normalized.openPrice,
                    closePrice: normalized.lastTradedPrice,
                    highPrice: normalized.highPrice,
                    lowPrice: normalized.lowPrice,
                    volume: normalized.volume,
                    turnover: normalized.turnover,
                    change,
                    percentageChange: pChange
                }
            });

            return [stockOp, historyOp];
        });

        // Reset daily metrics for non-traded stocks and ensure previousClose == ltp
        const resetOps = await buildUntradedResetOps(symbols);
        ops.push(...resetOps);

        await prisma.$transaction(ops);
        return { success: true, count: validStocks.length };
    } catch (error) {
        logger.error(`Error saving stocks: ${error.message}`);
        throw error;
    }
};

const getAllStocks = async ({ skip = 0, limit = 500, sortBy = 'symbol', sortOrder = 1, includeZeroLtp = true, compact = false } = {}) => {
    try {
        const orderField = ['symbol', 'companyName', 'percentageChange', 'lastTradedPrice', 'turnover', 'volume'].includes(sortBy)
            ? sortBy
            : 'symbol';

        const whereClause = includeZeroLtp ? {} : { lastTradedPrice: { gt: 0 } };

        const stocks = await prisma.stock.findMany({
            where: whereClause,
            skip,
            take: limit,
            orderBy: { [orderField]: sortOrder === -1 || sortOrder === 'desc' ? 'desc' : 'asc' }
        });

        return stocks.map(s => mapStockOutput(s, compact));
    } catch (error) {
        logger.error(`Error getting stocks: ${error.message}`);
        return [];
    }
};

const getStockBySymbol = async (symbol) => {
    if (!symbol) return null;
    return safeDbOperation(async () => {
        const stock = await prisma.stock.findUnique({ where: { symbol: symbol.toUpperCase() } });
        return mapStockOutput(stock);
    }, null, `Error getting stock ${symbol}`);
};

const getStocksBySymbols = async (symbols) => {
    if (!symbols || symbols.length === 0) return [];

    // Normalize symbols to uppercase and remove duplicates
    const uniqueSymbols = [...new Set(symbols.map(s => s.toUpperCase()))];

    return fetchStocksWithMapping({
        where: {
            symbol: { in: uniqueSymbols }
        }
    }, 'Error getting stocks by symbols');
};

const searchStocks = async (query) => {
    if (!query) return [];
    return fetchStocksWithMapping({
        where: {
            OR: [
                { symbol: { contains: query.toString().toUpperCase() } },
                { companyName: { contains: query.toString(), mode: 'insensitive' } }
            ]
        },
        take: 50
    }, 'Error searching stocks');
};

const getStocksBySector = async (sector) => {
    if (!sector) return [];
    return fetchStocksWithMapping(
        { where: { sector }, orderBy: { symbol: 'asc' } },
        'Error getting stocks by sector'
    );
};

const getRecentlyUpdated = async (seconds = 30) => {
    const cutoff = new Date(Date.now() - seconds * 1000);
    return fetchStocksWithMapping(
        { where: { updatedAt: { gte: cutoff } }, orderBy: { updatedAt: 'desc' } },
        'Error getting recent stocks'
    );
};

const getStockCount = async (includeZeroLtp = false) => {
    const whereClause = includeZeroLtp ? {} : { lastTradedPrice: { gt: 0 } };
    return safeDbOperation(
        () => prisma.stock.count({ where: whereClause }),
        0,
        'Error getting stock count'
    );
};

const getAllSectors = async () => {
    return safeDbOperation(async () => {
        const sectors = await prisma.stock.findMany({
            where: { sector: { not: null } },
            select: { sector: true },
            distinct: ['sector']
        });
        return sectors.map(s => s.sector).filter(Boolean).sort();
    }, [], 'Error getting sectors');
};

/** Map of configurations for fetching top distinct stock categories */
const TOP_CONFIGS = {
    gainers: [{ percentageChange: { not: null, gt: 0 } }, { percentageChange: 'desc' }, 'Error getting top gainers'],
    losers: [{ percentageChange: { not: null, lt: 0 } }, { percentageChange: 'asc' }, 'Error getting top losers'],
    traded: [{}, [{ volume: 'desc' }, { turnover: 'desc' }], 'Error getting top traded stocks'],
    turnover: [{}, { turnover: 'desc' }, 'Error getting top turnover stocks'],
    volume: [{}, { volume: 'desc' }, 'Error getting top volume stocks']
};

/** Unified helper to fetch top stocks by category */
const fetchTopByCategory = async (category, limit = 10) => {
    const config = TOP_CONFIGS[category];
    if (!config) return [];
    const [extraWhere, orderBy, errorMsg] = config;
    return fetchStocksWithMapping({
        where: { lastTradedPrice: { gt: 0 }, ...extraWhere },
        orderBy,
        take: limit
    }, errorMsg);
};

const getTopGainers = (limit) => fetchTopByCategory('gainers', limit);
const getTopLosers = (limit) => fetchTopByCategory('losers', limit);
const getTopTraded = (limit) => fetchTopByCategory('traded', limit);
const getTopTurnover = (limit) => fetchTopByCategory('turnover', limit);
const getTopVolume = (limit) => fetchTopByCategory('volume', limit);

const getUnchangedStocks = async (limit = 10) => {
    return fetchStocksWithMapping({
        where: {
            lastTradedPrice: { gt: 0 },
            OR: [
                { percentageChange: 0 },
                { change: 0 }
            ]
        },
        take: limit
    }, 'Error getting unchanged stocks');
};

const getTopTransactions = async (limit = 10) => {
    return fetchStocksWithMapping({
        where: { lastTradedPrice: { gt: 0 } },
        orderBy: { totalTrades: 'desc' },
        take: limit
    }, 'Error getting top transaction stocks');
};

const getLastStockUpdateTime = async () => {
    return safeDbOperation(async () => {
        const stock = await prisma.stock.findFirst({
            orderBy: { updatedAt: 'desc' },
            select: { updatedAt: true }
        });
        return stock ? stock.updatedAt.toISOString() : null;
    }, null, 'Error getting last stock update time');
};

const clearAllStocks = async () => {
    return safeDbOperation(async () => {
        const result = await prisma.stock.deleteMany();
        return { success: true, deleted: result.count };
    }, null, 'Error clearing stocks', true);
};

const deleteInactiveStocks = async () => {
    try {
        const result = await prisma.stock.deleteMany({
            where: {
                OR: [
                    { lastTradedPrice: { lte: 0 } },
                    { lastTradedPrice: null }
                ]
            }
        });
        if (result.count > 0) {
            logger.info(`Deleted ${result.count} inactive stocks from database`);
        }
        return { success: true, deleted: result.count };
    } catch (error) {
        logger.error(`Error deleting inactive stocks: ${error.message}`);
        throw error;
    }
};

const cleanupInactiveStocks = async () => {
    const initial = await prisma.stock.count();
    const result = await deleteInactiveStocks();
    return { removed: result.deleted, remaining: initial - result.deleted };
};

const cleanupInvalidStocks = async (validSymbols) => {
    if (!validSymbols || validSymbols.size === 0) {
        return { removed: 0, remaining: await prisma.stock.count(), removedSymbols: [] };
    }

    const symbols = Array.from(validSymbols).map(s => s.toUpperCase());
    try {
        const result = await prisma.stock.deleteMany({
            where: {
                symbol: { notIn: symbols }
            }
        });
        const remaining = await prisma.stock.count();
        logger.info(`Cleanup complete: removed ${result.count} invalid stocks, ${remaining} remaining`);
        return { removed: result.count, remaining, removedSymbols: [] };
    } catch (error) {
        logger.error(`Error in cleanupInvalidStocks: ${error.message}`);
        throw error;
    }
};

/**
 * Delete non-equity securities from database (Mutual Funds, Bonds, Debentures, Promoter Shares)
 * These are filtered out during fetching but may still exist in DB from old data
 */
const deleteNonEquitySecurities = async () => {
    try {
        // Get all stocks to check their symbols and names
        const allStocks = await prisma.stock.findMany({
            select: { symbol: true, sector: true, companyName: true }
        });

        // Find non-equity symbols using unified filter
        const nonEquitySymbols = allStocks.filter(s => !isKnownSymbol(s.symbol)).map(s => s.symbol);

        if (nonEquitySymbols.length === 0) {
            logger.info('No non-equity securities found in database');
            return { removed: 0, remaining: allStocks.length, removedSymbols: [] };
        }

        const result = await prisma.stock.deleteMany({
            where: { symbol: { in: nonEquitySymbols } }
        });

        const remaining = await prisma.stock.count();
        logger.info(`Deleted ${result.count} non-equity securities: MFs, Bonds, Debentures, Promoter Shares. ${remaining} stocks remaining.`);
        return { removed: result.count, remaining, removedSymbols: nonEquitySymbols };
    } catch (error) {
        logger.error(`Error deleting non-equity securities: ${error.message}`);
        throw error;
    }
};


/**
 * Creates historical records for all stocks for the current day.
 * Ensures data precision by recalculating change/percentage before saving.
 */
const snapshotDailyMarket = async () => {
    logger.info('Starting End-of-Day Market Snapshot...');
    try {
        const stocks = await prisma.stock.findMany({
            where: { lastTradedPrice: { gt: 0 } }
        });

        if (stocks.length === 0) {
            logger.warn('No active stocks found for snapshot.');
            return { count: 0 };
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        await prisma.$transaction(async (tx) => {
            const existingHistories = await tx.marketHistory.findMany({
                where: {
                    date: today,
                    symbol: { in: stocks.map(s => s.symbol) }
                }
            });

            const existingMap = new Map(existingHistories.map(h => [h.symbol, h]));
            const createData = [];
            const updateOps = [];

            for (const stock of stocks) {
                categorizeStockForSnapshot({ stock, today, existingMap, createData, updateOps, tx });
            }

            if (createData.length > 0) {
                await tx.marketHistory.createMany({ data: createData });
            }
            if (updateOps.length > 0) {
                await Promise.all(updateOps);
            }
        });

        logger.info(`Daily snapshot completed. Processed ${stocks.length} stocks.`);
        return { success: true, count: stocks.length };
    } catch (error) {
        logger.error(`Error in snapshotDailyMarket: ${error.message}`);
        throw error;
    }
};

module.exports = {
    saveStocks,
    getAllStocks,
    getStockBySymbol,
    getStocksBySymbols,
    searchStocks,
    getStocksBySector,
    getRecentlyUpdated,
    getStockCount,
    getAllSectors,
    getTopGainers,
    getTopLosers,
    getUnchangedStocks,
    getTopTraded,
    getTopTurnover,
    getTopVolume,
    getTopTransactions,
    getLastStockUpdateTime,
    clearAllStocks,
    deleteInactiveStocks,
    cleanupInactiveStocks,
    cleanupInvalidStocks,
    deleteNonEquitySecurities,
    snapshotDailyMarket
};

