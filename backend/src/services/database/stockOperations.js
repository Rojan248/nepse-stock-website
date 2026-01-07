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

const mapStockInput = (stock) => ({
    symbol: (stock.symbol || '').toUpperCase(),
    companyName: stock.companyName || stock.name || stock.symbol,
    sector: stock.sector || null,
    lastTradedPrice: stock.lastTradedPrice ?? stock.ltp ?? null,
    previousClose: stock.previousClose ?? stock.previousClosingPrice ?? null,
    openPrice: stock.openPrice ?? null,
    highPrice: stock.highPrice ?? null,
    lowPrice: stock.lowPrice ?? null,
    volume: stock.volume ?? stock.totalTradedQuantity ?? null,
    totalTrades: stock.totalTrades ?? stock.totalTradedTransactions ?? null,
    turnover: stock.turnover ?? stock.totalTradedValue ?? null,
    change: stock.change ?? stock.pointChange ?? null,
    percentageChange: stock.percentageChange ?? stock.changePercent ?? null,
    updatedAt: new Date()
});

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
    cleanupInvalidStocks
};
