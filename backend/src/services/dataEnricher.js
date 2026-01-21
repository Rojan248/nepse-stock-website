/**
 * Data Enricher Service
 * Extracted from dataFetcher.js to consolidate stock enrichment and market summary calculation
 * This eliminates the 3x code duplication in the library/proxy/custom fallback chain
 */

const logger = require('./utils/logger');
const NEPSE_STOCKS = require('../data/nepseStocks');

// Create a lookup map for quick symbol -> stock info lookup
const stockInfoMap = new Map();
NEPSE_STOCKS.forEach(stock => {
    stockInfoMap.set(stock.symbol.toUpperCase(), {
        name: stock.name,
        sector: stock.sector
    });
});

/**
 * Safe price parser - handles strings with commas, null, undefined, NaN
 * @param {any} value - Value to parse as price
 * @returns {number} Parsed price or 0 if invalid
 */
const parsePrice = (value) => {
    if (value === null || value === undefined) return 0;
    const cleaned = String(value).replace(/,/g, '').trim();
    const parsed = parseFloat(cleaned);
    return Number.isNaN(parsed) ? 0 : parsed;
};

/**
 * Calculate market breadth from stock data using robust price comparison
 * @param {Array} stocks - Array of stock objects
 * @returns {Object} { advanced, declined, unchanged }
 */
const updateMarketBreadth = (stocks) => {
    let advanced = 0, declined = 0, unchanged = 0;
    
    if (!Array.isArray(stocks)) {
        return { advanced, declined, unchanged };
    }
    
    stocks.forEach(stock => {
        const current = parsePrice(
            stock.lastTradedPrice || stock.ltp || stock.close || 
            stock.prices?.ltp || stock.prices?.close
        );
        const prev = parsePrice(
            stock.previousClose || stock.previousClosingPrice || 
            stock.previous_close || stock.prices?.previousClose
        );
        
        if (current === 0 || prev === 0) {
            unchanged++;
        } else if (current > prev) {
            advanced++;
        } else if (current < prev) {
            declined++;
        } else {
            unchanged++;
        }
    });
    
    logger.debug(`Market Breadth: Advanced=${advanced}, Declined=${declined}, Unchanged=${unchanged}`);
    return { advanced, declined, unchanged };
};

/**
 * Enrich stock data with company names from the static mapping
 * This ensures we always have real company names even if the data source doesn't provide them
 * @param {Array} stocks - Array of stock objects
 * @returns {Array} Enriched stock array
 */
const enrichStocksWithNames = (stocks) => {
    if (!Array.isArray(stocks)) return stocks;

    return stocks.map(stock => {
        const symbol = (stock.symbol || '').toUpperCase();
        const stockInfo = stockInfoMap.get(symbol);

        const needsName = !stock.companyName ||
            stock.companyName.startsWith('COM') ||
            stock.companyName === symbol ||
            stock.companyName.length < 3;

        if (stockInfo && needsName) {
            return {
                ...stock,
                companyName: stockInfo.name,
                sector: stock.sector === 'Others' ? stockInfo.sector : stock.sector
            };
        }

        if (stockInfo && (stock.sector === 'Others' || stock.sector === 'NEPSE Index')) {
            return {
                ...stock,
                sector: stockInfo.sector
            };
        }

        return stock;
    });
};

/**
 * Calculate market summary from stock data
 * @param {Array} stocks - Array of stock objects
 * @param {Object} existingSummary - Existing market summary from API (may have index data)
 * @returns {Object} Enhanced market summary
 */
const calculateMarketSummary = (stocks, existingSummary = {}) => {
    if (!Array.isArray(stocks) || stocks.length === 0) {
        return existingSummary;
    }

    let calcTurnover = 0;
    let calcVolume = 0;
    let calcTrades = 0;
    let tradedCompanies = 0;

    stocks.forEach(stock => {
        const volume = parsePrice(stock.volume || stock.trading?.volume);
        const turnover = parsePrice(stock.turnover || stock.trading?.turnover);
        const trades = parsePrice(
            stock.totalTrades
            || stock.trading?.totalTrades
            || stock.trading?.trades
            || stock.trading?.noOfTransactions
            || stock.noOfTransactions
        );

        calcTurnover += turnover;
        calcVolume += volume;
        calcTrades += trades;

        if (volume > 0) {
            tradedCompanies++;
        }
    });

    const breadth = updateMarketBreadth(stocks);

    return {
        ...existingSummary,
        indexValue: existingSummary.indexValue || null,
        indexChange: existingSummary.indexChange || null,
        indexChangePercent: existingSummary.indexChangePercent || null,
        totalTurnover: existingSummary.totalTurnover || calcTurnover || 0,
        totalVolume: existingSummary.totalVolume || calcVolume || 0,
        totalTransactions: (existingSummary.totalTransactions && existingSummary.totalTransactions > 0)
            ? existingSummary.totalTransactions
            : (calcTrades || 0),
        activeCompanies: existingSummary.activeCompanies || tradedCompanies || 0,
        advancedCompanies: existingSummary.advancedCompanies || breadth.advanced || 0,
        declinedCompanies: existingSummary.declinedCompanies || breadth.declined || 0,
        unchangedCompanies: existingSummary.unchangedCompanies || breadth.unchanged || 0,
        timestamp: new Date().toISOString()
    };
};

/**
 * Unified post-processing for fetched data
 * Consolidates the enrichment logic that was previously duplicated 3x in dataFetcher
 * @param {Object} data - Raw fetched data with stocks and marketSummary
 * @param {function} fetchLiveMarketMeta - Function to fetch live market meta
 * @returns {Object} Enriched data object
 */
const enrichAndFinalize = async (data, fetchLiveMarketMeta) => {
    if (!data) return data;
    
    // Enrich stocks with proper company names and sectors
    data.stocks = enrichStocksWithNames(data.stocks);
    
    // Calculate/enhance market summary from stock data
    data.marketSummary = calculateMarketSummary(data.stocks, data.marketSummary);
    
    // Patch missing totals from live meta endpoint
    if (fetchLiveMarketMeta) {
        const liveMeta = await fetchLiveMarketMeta();
        if (liveMeta) {
            data.marketSummary = {
                ...data.marketSummary,
                totalTransactions: data.marketSummary.totalTransactions || liveMeta.totalTransactions || 0,
                totalTurnover: data.marketSummary.totalTurnover || liveMeta.totalTurnover || data.marketSummary.totalTurnover,
                totalVolume: data.marketSummary.totalVolume || liveMeta.totalVolume || data.marketSummary.totalVolume
            };
        }
    }
    
    return data;
};

/**
 * Get stock info from the static mapping
 * @param {string} symbol - Stock symbol
 * @returns {Object|null} Stock info { name, sector } or null
 */
const getStockInfo = (symbol) => {
    return stockInfoMap.get((symbol || '').toUpperCase()) || null;
};

/**
 * Check if a symbol is a known NEPSE equity
 * @param {string} symbol - Stock symbol
 * @returns {boolean} True if known
 */
const isKnownSymbol = (symbol) => {
    return stockInfoMap.has((symbol || '').toUpperCase());
};

/**
 * Compute market breadth from database stocks as a reliable fallback
 * Extracted from dataFetcher.js for better separation of concerns
 * @param {Object} prisma - Prisma client instance
 * @returns {Object|null} { advanced, declined, unchanged } or null on error
 */
const computeBreadthFromDb = async (prisma) => {
    try {
        const [advanced, declined, unchanged] = await Promise.all([
            prisma.stock.count({ where: { percentageChange: { gt: 0 } } }),
            prisma.stock.count({ where: { percentageChange: { lt: 0 } } }),
            prisma.stock.count({ where: { OR: [{ percentageChange: 0 }, { percentageChange: null }] } })
        ]);

        // If all counts are zero/unchanged, derive breadth from price comparison
        if (advanced === 0 && declined === 0) {
            const stocks = await prisma.stock.findMany({
                select: { lastTradedPrice: true, ltp: true, previousClose: true }
            });

            let adv = 0, dec = 0, unc = 0;
            stocks.forEach(s => {
                const ltp = parsePrice(s.lastTradedPrice ?? s.ltp ?? 0);
                const prev = parsePrice(s.previousClose ?? 0);
                if (ltp === 0 || prev === 0) {
                    unc++;
                } else if (ltp > prev) {
                    adv++;
                } else if (ltp < prev) {
                    dec++;
                } else {
                    unc++;
                }
            });

            return { advanced: adv, declined: dec, unchanged: unc };
        }

        return { advanced, declined, unchanged };
    } catch (e) {
        logger.debug(`computeBreadthFromDb failed: ${e.message}`);
        return null;
    }
};

module.exports = {
    parsePrice,
    updateMarketBreadth,
    enrichStocksWithNames,
    calculateMarketSummary,
    enrichAndFinalize,
    getStockInfo,
    isKnownSymbol,
    stockInfoMap,
    computeBreadthFromDb
};
