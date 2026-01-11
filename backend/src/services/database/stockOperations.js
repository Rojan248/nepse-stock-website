/**
 * Stock Database Operations - Prisma Implementation
 */

const { prisma } = require('./connection');
const logger = require('../utils/logger');

const mapStockOutput = (stock) => {
    if (!stock) return null;
    const ltp = stock.lastTradedPrice ?? 0;
    const changePercent = stock.percentageChange ?? stock.changePercent ?? null;

    return {
        symbol: stock.symbol,
        companyName: stock.companyName,
        sector: stock.sector,
        ltp,
        lastTradedPrice: stock.lastTradedPrice,
        previousClose: stock.previousClose,
        openPrice: stock.openPrice,
        highPrice: stock.highPrice,
        lowPrice: stock.lowPrice,
        volume: stock.volume,
        totalTrades: stock.totalTrades,
        turnover: stock.turnover,
        change: stock.change,
        changePercent,
        percentageChange: changePercent,
        prices: {
            ltp,
            change: stock.change,
            changePercent
        },
        trading: {
            volume: stock.volume,
            turnover: stock.turnover,
            totalTrades: stock.totalTrades
        },
        updatedAt: stock.updatedAt ? stock.updatedAt.toISOString() : undefined,
        timestamp: stock.updatedAt ? stock.updatedAt.toISOString() : undefined
    };
};

const mapStockInput = (stock) => {
    // Extract base fields
    const symbol = (stock.symbol || '').toUpperCase();
    const companyName = stock.companyName || stock.name || symbol;
    const sector = stock.sector || null;

    // Prices can be top-level or in a 'prices' object
    const p = stock.prices || {};
    const lastTradedPrice = stock.lastTradedPrice ?? stock.ltp ?? stock.close ?? p.ltp ?? p.close ?? null;
    const previousClose = stock.previousClose ?? stock.previousClosingPrice ?? p.previousClose ?? null;
    const openPrice = stock.openPrice ?? p.open ?? null;
    const highPrice = stock.highPrice ?? p.high ?? null;
    const lowPrice = stock.lowPrice ?? p.low ?? null;

    // Trading data can be top-level or in a 'trading' object
    const t = stock.trading || {};
    const volume = stock.volume ?? t.volume ?? stock.totalTradedQuantity ?? null;
    const totalTrades = stock.totalTrades ?? t.totalTrades ?? stock.totalTradedTransactions ?? null;
    const turnover = stock.turnover ?? t.turnover ?? stock.totalTradedValue ?? null;

    // Change data
    const change = stock.change ?? p.change ?? stock.pointChange ?? null;
    const percentageChange = stock.percentageChange ?? stock.changePercent ?? p.changePercent ?? null;

    return {
        symbol,
        companyName,
        sector,
        lastTradedPrice,
        previousClose,
        openPrice,
        highPrice,
        lowPrice,
        volume,
        totalTrades,
        turnover,
        change,
        percentageChange,
        updatedAt: new Date()
    };
};

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
                const data = mapStockInput(stock);
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
    try {
        const stock = await prisma.stock.findUnique({ where: { symbol: symbol.toUpperCase() } });
        return mapStockOutput(stock);
    } catch (error) {
        logger.error(`Error getting stock ${symbol}: ${error.message}`);
        return null;
    }
};

const searchStocks = async (query) => {
    if (!query) return [];
    try {
        const q = query.toString();
        const stocks = await prisma.stock.findMany({
            where: {
                OR: [
                    { symbol: { contains: q.toUpperCase() } },
                    { companyName: { contains: q, mode: 'insensitive' } }
                ]
            },
            take: 50
        });
        return stocks.map(mapStockOutput);
    } catch (error) {
        logger.error(`Error searching stocks: ${error.message}`);
        return [];
    }
};

const getStocksBySector = async (sector) => {
    if (!sector) return [];
    try {
        const stocks = await prisma.stock.findMany({ where: { sector }, orderBy: { symbol: 'asc' } });
        return stocks.map(mapStockOutput);
    } catch (error) {
        logger.error(`Error getting stocks by sector: ${error.message}`);
        return [];
    }
};

const getRecentlyUpdated = async (seconds = 30) => {
    try {
        const cutoff = new Date(Date.now() - seconds * 1000);
        const stocks = await prisma.stock.findMany({
            where: { updatedAt: { gte: cutoff } },
            orderBy: { updatedAt: 'desc' }
        });
        return stocks.map(mapStockOutput);
    } catch (error) {
        logger.error(`Error getting recent stocks: ${error.message}`);
        return [];
    }
};

const getStockCount = async (includeZeroLtp = false) => {
    try {
        const whereClause = includeZeroLtp ? {} : { lastTradedPrice: { gt: 0 } };
        return await prisma.stock.count({ where: whereClause });
    } catch (error) {
        logger.error(`Error getting stock count: ${error.message}`);
        return 0;
    }
};

const getAllSectors = async () => {
    try {
        const sectors = await prisma.stock.findMany({
            where: { sector: { not: null } },
            select: { sector: true },
            distinct: ['sector']
        });
        return sectors.map(s => s.sector).filter(Boolean).sort();
    } catch (error) {
        logger.error(`Error getting sectors: ${error.message}`);
        return [];
    }
};

const getTopGainers = async (limit = 10) => {
    try {
        const stocks = await prisma.stock.findMany({
            where: {
                lastTradedPrice: { gt: 0 },
                percentageChange: { not: null, gt: 0 }
            },
            orderBy: { percentageChange: 'desc' },
            take: limit
        });
        return stocks.map(mapStockOutput);
    } catch (error) {
        logger.error(`Error getting top gainers: ${error.message}`);
        return [];
    }
};

const getTopLosers = async (limit = 10) => {
    try {
        const stocks = await prisma.stock.findMany({
            where: {
                lastTradedPrice: { gt: 0 },
                percentageChange: { not: null, lt: 0 }
            },
            orderBy: { percentageChange: 'asc' },
            take: limit
        });
        return stocks.map(mapStockOutput);
    } catch (error) {
        logger.error(`Error getting top losers: ${error.message}`);
        return [];
    }
};

const getUnchangedStocks = async (limit = 10) => {
    try {
        const stocks = await prisma.stock.findMany({
            where: {
                lastTradedPrice: { gt: 0 },
                OR: [
                    { percentageChange: 0 },
                    { change: 0 }
                ]
            },
            take: limit
        });
        return stocks.map(mapStockOutput);
    } catch (error) {
        logger.error(`Error getting unchanged stocks: ${error.message}`);
        return [];
    }
};

const getTopTraded = async (limit = 10) => {
    try {
        const stocks = await prisma.stock.findMany({
            where: { lastTradedPrice: { gt: 0 } },
            orderBy: [
                { volume: 'desc' },
                { turnover: 'desc' }
            ],
            take: limit
        });
        return stocks.map(mapStockOutput);
    } catch (error) {
        logger.error(`Error getting top traded stocks: ${error.message}`);
        return [];
    }
};

const clearAllStocks = async () => {
    try {
        const result = await prisma.stock.deleteMany();
        return { success: true, deleted: result.count };
    } catch (error) {
        logger.error(`Error clearing stocks: ${error.message}`);
        throw error;
    }
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

        // Find non-equity symbols using same patterns as libraryFetcher.isEquitySecurity
        const nonEquitySymbols = allStocks.filter(s => {
            const symbol = s.symbol.toUpperCase();
            const sector = (s.sector || '').toLowerCase();
            const companyName = (s.companyName || '').toLowerCase();

            // Mutual Funds
            if (sector === 'mutual fund' || sector.includes('mutual fund')) return true;
            if (companyName.includes('mutual fund') || companyName.includes('kosh')) return true;

            // Additional fund patterns (catches GIBF1, NICGF2, SAGF, SEF, SFEF, RBBF40)
            if (companyName.includes('balanced fund') || companyName.includes('growth fund')) return true;
            if (companyName.includes('equity fund') || companyName.includes('focused fund')) return true;
            if (companyName.includes('samriddhi fund') || companyName.includes('focus 40')) return true;
            if (/^[A-Z]+F\d*$/.test(symbol)) return true;  // SAGF, SEF, GIBF1, NIBSF2 pattern

            // Bonds (ends with B + 2-4 digits, e.g., ADBLB87)
            if (/B\d{2,4}$/.test(symbol)) return true;

            // Debentures (ends with D + 2-4 digits, e.g., SBLD83)
            if (/D\d{2,4}$/.test(symbol)) return true;

            // Double-year patterns with underscore/slash (e.g., GBILD84_85, NICAD85/86)
            if (/\d{2}[_/]\d{2}/.test(symbol)) return true;

            // Other bond/unit patterns
            if (/EB\d{2}/.test(symbol)) return true;  // NMBEB92, EBLEB89
            if (/UR\d{2}/.test(symbol)) return true;  // NIFRAUR85
            if (/SY$/.test(symbol)) return true;      // GSY, KSY, RSY (yojana units)
            if (/SF$/.test(symbol)) return true;      // PRSF, SAGF type symbols

            // Name-based checks (catches misclassified bonds like "4% Agricultural Bond")
            if (companyName.includes('bond') || companyName.includes('debenture')) return true;
            if (companyName.includes('%')) return true;  // "4% Agricultural Bond"

            // Promoter Shares (ends with PO)
            if (symbol.endsWith('PO')) return true;

            return false;
        }).map(s => s.symbol);

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

