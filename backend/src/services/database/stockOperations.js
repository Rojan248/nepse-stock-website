/**
 * Stock Database Operations - Prisma Implementation
 * 
 * Refactored in Phase 7 to reduce error handling duplication
 */

const { prisma } = require('./connection');
const logger = require('../utils/logger');
const { isEquitySecurity } = require('../utils/securityFilters');
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

// ==================== Core Operations ====================

const saveStocks = async (stocks) => {
    if (!Array.isArray(stocks) || stocks.length === 0) {
        return { success: true, count: 0 };
    }

    try {
        // First, get all existing stocks that we're about to update
        const symbols = stocks.filter(s => s && s.symbol).map(s => s.symbol.toUpperCase());
        const existingStocks = await prisma.stock.findMany({
            where: { symbol: { in: symbols } },
            select: { symbol: true, lastTradedPrice: true }
        });
        const existingMap = new Map(existingStocks.map(s => [s.symbol, s.lastTradedPrice]));

        const ops = stocks
            .filter(s => s && s.symbol)
            .map((stock) => {
                const data = normalizeStockInput(stock);
                const existingLtp = existingMap.get(data.symbol);
                const newLtp = data.lastTradedPrice || 0;

                // If existing stock has valid price and new data has zero price,
                // preserve the existing price data (don't overwrite with zeros)
                if (existingLtp && existingLtp > 0 && newLtp === 0) {
                    logger.debug(`[${data.symbol}] Preserving existing LTP=${existingLtp} (incoming LTP=0)`);
                    // Only update timestamp, not the price
                    return prisma.stock.update({
                        where: { symbol: data.symbol },
                        data: { updatedAt: new Date() }
                    });
                }

                return prisma.stock.upsert({
                    where: { symbol: data.symbol },
                    update: data,
                    create: data
                });
            });

        await prisma.$transaction(ops);
        return { success: true, count: ops.length };
    } catch (error) {
        logger.error(`Error saving stocks: ${error.message}`);
        throw error;
    }
};

const getAllStocks = async ({ skip = 0, limit = 500, sortBy = 'symbol', sortOrder = 1, includeZeroLtp = true } = {}) => {
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

        return stocks.map(mapStockOutput);
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

const getTopGainers = async (limit = 10) => {
    return fetchStocksWithMapping({
        where: {
            lastTradedPrice: { gt: 0 },
            percentageChange: { not: null, gt: 0 }
        },
        orderBy: { percentageChange: 'desc' },
        take: limit
    }, 'Error getting top gainers');
};

const getTopLosers = async (limit = 10) => {
    return fetchStocksWithMapping({
        where: {
            lastTradedPrice: { gt: 0 },
            percentageChange: { not: null, lt: 0 }
        },
        orderBy: { percentageChange: 'asc' },
        take: limit
    }, 'Error getting top losers');
};

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

const getTopTraded = async (limit = 10) => {
    return fetchStocksWithMapping({
        where: { lastTradedPrice: { gt: 0 } },
        orderBy: [
            { volume: 'desc' },
            { turnover: 'desc' }
        ],
        take: limit
    }, 'Error getting top traded stocks');
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
        const nonEquitySymbols = allStocks.filter(s => !isEquitySecurity(s)).map(s => s.symbol);

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
        // 1. Fetch all valid stocks
        const stocks = await prisma.stock.findMany({
            where: { lastTradedPrice: { gt: 0 } }
        });

        if (stocks.length === 0) {
            logger.warn('No active stocks found for snapshot.');
            return { count: 0 };
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalize to start of day

        let count = 0;

        // 2. Process each stock inside a transaction for atomicity
        await prisma.$transaction(async (tx) => {
            for (const stock of stocks) {
                // Precision Calculation: Ensure change and percent match the close/prevClose
                let ltp = stock.lastTradedPrice;
                let prev = stock.previousClose;
                let change = stock.change;
                let pChange = stock.percentageChange;

                // If we have both prices, force mathematical consistency
                if (ltp && prev && prev > 0) {
                    const calcChange = ltp - prev;
                    if (Math.abs(calcChange - (change || 0)) > 0.01) {
                        logger.debug(`[${stock.symbol}] Fixing Change: Was ${change}, Now ${calcChange.toFixed(2)}`);
                        change = parseFloat(calcChange.toFixed(2));
                    }

                    const calcPct = (calcChange / prev) * 100;
                    if (Math.abs(calcPct - (pChange || 0)) > 0.01) {
                        logger.debug(`[${stock.symbol}] Fixing % Change: Was ${pChange}%, Now ${calcPct.toFixed(2)}%`);
                        pChange = parseFloat(calcPct.toFixed(2));
                    }
                }

                // Upsert history record
                // Note: We use findFirst/create/update logic or checking existence because
                // composite unique constraints might not be set up on [symbol, date] for simple Upsert depending on schema details.
                // But generally, we can try to find existing first.

                const existing = await tx.marketHistory.findFirst({
                    where: {
                        symbol: stock.symbol,
                        date: today
                    }
                });

                if (existing) {
                    await tx.marketHistory.update({
                        where: { id: existing.id },
                        data: {
                            closePrice: ltp,
                            highPrice: stock.highPrice,
                            lowPrice: stock.lowPrice,
                            volume: stock.volume,
                            turnover: stock.turnover,
                            change: change,
                            percentageChange: pChange
                        }
                    });
                } else {
                    await tx.marketHistory.create({
                        data: {
                            symbol: stock.symbol,
                            date: today,
                            closePrice: ltp,
                            highPrice: stock.highPrice,
                            lowPrice: stock.lowPrice,
                            volume: stock.volume,
                            turnover: stock.turnover,
                            change: change,
                            percentageChange: pChange
                        }
                    });
                }
                count++;
            }
        });

        logger.info(`Daily snapshot completed. Processed ${count} stocks.`);
        return { success: true, count };
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
    clearAllStocks,
    deleteInactiveStocks,
    cleanupInactiveStocks,
    cleanupInvalidStocks,
    deleteNonEquitySecurities,
    snapshotDailyMarket
};

