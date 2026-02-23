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

const { isMarketActive } = require('./utils/marketTime');

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

// ==================== Breadth Helpers ====================

/** Candidate fields for current price */
const CURRENT_PRICE_FIELDS = ['lastTradedPrice', 'ltp', 'close'];
/** Candidate fields for previous close */
const PREV_CLOSE_FIELDS = ['previousClose', 'previousClosingPrice', 'previous_close'];

/** Resolve first truthy parsed price from top-level or nested prices */
const resolvePriceField = (stock, fields, nestedKey) => {
    for (const f of fields) {
        const v = parsePrice(stock[f]);
        if (v) return v;
    }
    if (stock.prices && nestedKey) return parsePrice(stock.prices[nestedKey]);
    return 0;
};

/** Resolve current/last traded price from a stock record */
const resolveCurrentPrice = (stock) => resolvePriceField(stock, CURRENT_PRICE_FIELDS, 'ltp') || resolvePriceField(stock, [], 'close');

/** Resolve previous close price from a stock record */
const resolvePrevClose = (stock) => resolvePriceField(stock, PREV_CLOSE_FIELDS, 'previousClose');

/** Classify price movement into advanced/declined/unchanged */
const classifyPriceMovement = (current, prev) => {
    if (current === 0 || prev === 0) return 'unchanged';
    if (current > prev) return 'advanced';
    if (current < prev) return 'declined';
    return 'unchanged';
};

/**
 * Calculate market breadth from stock data using robust price comparison
 * ONLY calculates if market is active to avoid false movements when closed
 * @param {Array} stocks - Array of stock objects
 * @returns {Object|null} { advanced, declined, unchanged } or null if closed
 */
const updateMarketBreadth = (stocks) => {
    // Always calculate breadth from stock price data when stocks are available.
    // This ensures the market summary reflects the day's actual advance/decline/unchanged
    // even when the server starts after market hours or during weekends.
    const counts = { advanced: 0, declined: 0, unchanged: 0 };
    if (!Array.isArray(stocks) || stocks.length === 0) return counts;

    for (const stock of stocks) {
        const bucket = classifyPriceMovement(resolveCurrentPrice(stock), resolvePrevClose(stock));
        counts[bucket]++;
    }

    logger.debug(`Market Breadth: Advanced=${counts.advanced}, Declined=${counts.declined}, Unchanged=${counts.unchanged}`);
    return counts;
};

/**
 * Enrich stock data with company names from the static mapping
 * This ensures we always have real company names even if the data source doesn't provide them
 * @param {Array} stocks - Array of stock objects
 * @returns {Array} Enriched stock array
 */
/** Check if a stock's companyName is missing or placeholder */
const needsCompanyName = (stock, symbol) =>
    !stock.companyName ||
    stock.companyName.startsWith('COM') ||
    stock.companyName === symbol ||
    stock.companyName.length < 3;

/** Check if a stock's sector should be replaced from static mapping */
const needsSectorFix = (sector) =>
    sector === 'Others' || sector === 'NEPSE Index';

/** Enrich a single stock with name/sector from static mapping if needed */
const enrichSingleStock = (stock) => {
    const symbol = (stock.symbol || '').toUpperCase();
    const info = stockInfoMap.get(symbol);
    if (!info) return stock;

    if (needsCompanyName(stock, symbol)) {
        return { ...stock, companyName: info.name, sector: needsSectorFix(stock.sector) ? info.sector : stock.sector };
    }
    if (needsSectorFix(stock.sector)) {
        return { ...stock, sector: info.sector };
    }
    return stock;
};

const enrichStocksWithNames = (stocks) => {
    if (!Array.isArray(stocks)) return stocks;
    return stocks.map(enrichSingleStock);
};

/**
 * Calculate market summary from stock data
 * @param {Array} stocks - Array of stock objects
 * @param {Object} existingSummary - Existing market summary from API (may have index data)
 * @returns {Object} Enhanced market summary
 */
/** Candidate fields for trade count on a single stock */
const TRADE_COUNT_FIELDS = ['totalTrades'];
const TRADE_COUNT_NESTED = ['totalTrades', 'trades', 'noOfTransactions'];

/** Resolve a stock's volume from top-level or nested trading */
const resolveVolume = (stock) => parsePrice(stock.volume || stock.trading?.volume);

/** Resolve a stock's turnover from top-level or nested trading */
const resolveTurnover = (stock) => parsePrice(stock.turnover || stock.trading?.turnover);

/** Resolve first truthy parsePrice from an object's fields */
const firstTruthyPrice = (obj, fields) => {
    for (const f of fields) { const v = parsePrice(obj[f]); if (v) return v; }
    return 0;
};

/** Resolve a stock's trade count from top-level then nested trading fields */
const resolveTrades = (stock) =>
    firstTruthyPrice(stock, TRADE_COUNT_FIELDS)
    || firstTruthyPrice(stock.trading || {}, TRADE_COUNT_NESTED)
    || parsePrice(stock.noOfTransactions);

/** Accumulate trading totals from an array of stocks */
const accumulateTradingTotals = (stocks) => {
    let turnover = 0, volume = 0, trades = 0, tradedCompanies = 0;
    for (const stock of stocks) {
        const vol = resolveVolume(stock);
        volume += vol;
        turnover += resolveTurnover(stock);
        trades += resolveTrades(stock);
        if (vol > 0) tradedCompanies++;
    }
    return { turnover, volume, trades, tradedCompanies };
};

/** Use existing value if truthy, otherwise fall back to calculated value */
const preferExisting = (existing, calculated) => existing || calculated || 0;

/** Strongly prefer mathematically calculated value if available (real-time). Fallback to API if skipped. */
const preferCalculated = (calculated, existing) => (calculated !== null && calculated !== undefined) ? calculated : (existing || 0);

/** Build the final summary object merging existing API data with calculated values */
const buildSummaryResult = (existingSummary, calc, breadth) => ({
    ...existingSummary,
    indexValue: existingSummary.indexValue || null,
    indexChange: existingSummary.indexChange || null,
    indexChangePercent: existingSummary.indexChangePercent || null,
    totalTurnover: preferExisting(existingSummary.totalTurnover, calc.turnover),
    totalVolume: preferExisting(existingSummary.totalVolume, calc.volume),
    totalTransactions: (existingSummary.totalTransactions && existingSummary.totalTransactions > 0)
        ? existingSummary.totalTransactions
        : (calc.trades || 0),
    activeCompanies: preferExisting(existingSummary.activeCompanies, calc.tradedCompanies),
    // Breadth assignments intentionally use preferCalculated to prioritize live-calculated values 
    // during market hours, falling back to API values when updateMarketBreadth returns null.
    // This creates an intentional asymmetry with totals fields (turnover, volume) which use 
    // preferExisting to preserve API totals.
    advancedCompanies: preferCalculated(breadth.advanced, existingSummary.advancedCompanies),
    declinedCompanies: preferCalculated(breadth.declined, existingSummary.declinedCompanies),
    unchangedCompanies: preferCalculated(breadth.unchanged, existingSummary.unchangedCompanies),
    timestamp: new Date().toISOString()
});

const calculateMarketSummary = (stocks, existingSummary = {}) => {
    if (!Array.isArray(stocks) || stocks.length === 0) return existingSummary;
    const calc = accumulateTradingTotals(stocks);
    const breadth = updateMarketBreadth(stocks);
    return buildSummaryResult(existingSummary, calc, breadth);
};

/**
 * Unified post-processing for fetched data
 * Consolidates the enrichment logic that was previously duplicated 3x in dataFetcher
 * @param {Object} data - Raw fetched data with stocks and marketSummary
 * @param {function} fetchLiveMarketMeta - Function to fetch live market meta
 * @returns {Object} Enriched data object
 */
/** Patch totalTransactions/totalTurnover/totalVolume from live meta if still missing */
const patchMissingTotals = (summary, liveMeta) => ({
    ...summary,
    totalTransactions: summary.totalTransactions || liveMeta.totalTransactions || 0,
    totalTurnover: summary.totalTurnover || liveMeta.totalTurnover || summary.totalTurnover,
    totalVolume: summary.totalVolume || liveMeta.totalVolume || summary.totalVolume
});

const enrichAndFinalize = async (data, fetchLiveMarketMeta) => {
    if (!data) return data;

    data.stocks = enrichStocksWithNames(data.stocks);
    data.marketSummary = calculateMarketSummary(data.stocks, data.marketSummary);

    if (fetchLiveMarketMeta) {
        const liveMeta = await fetchLiveMarketMeta();
        if (liveMeta) {
            data.marketSummary = patchMissingTotals(data.marketSummary, liveMeta);
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
/** Derive breadth from raw price comparison when percentageChange counts are all zero */
const deriveBreadthFromPrices = (stocks) => {
    const counts = { advanced: 0, declined: 0, unchanged: 0 };
    for (const s of stocks) {
        const ltp = parsePrice(s.lastTradedPrice ?? s.ltp ?? 0);
        const prev = parsePrice(s.previousClose ?? 0);
        counts[classifyPriceMovement(ltp, prev)]++;
    }
    return counts;
};

const computeBreadthFromDb = async (prisma) => {
    try {
        const [advanced, declined, unchanged] = await Promise.all([
            prisma.stock.count({ where: { percentageChange: { gt: 0 } } }),
            prisma.stock.count({ where: { percentageChange: { lt: 0 } } }),
            prisma.stock.count({ where: { OR: [{ percentageChange: 0 }, { percentageChange: null }] } })
        ]);

        const noMeaningfulCounts = advanced === 0 && declined === 0;
        if (noMeaningfulCounts) {
            const stocks = await prisma.stock.findMany({
                select: { lastTradedPrice: true, ltp: true, previousClose: true }
            });
            return deriveBreadthFromPrices(stocks);
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
