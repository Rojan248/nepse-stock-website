/**
 * Data Normalizer Service
 * Centralizes logic for normalizing stock data from various sources (scrapers, API responses)
 * so that database operations receive a consistent format.
 */

// ==================== Constants ====================

/** Canonical sector name mappings (lowercase key → display value) */
const SECTOR_MAPPINGS = {
    'hydropower': 'Hydro Power',
    'hydro power': 'Hydro Power',
    'hydro': 'Hydro Power',
    'commercial banks': 'Commercial Bank',
    'commercial bank': 'Commercial Bank',
    'development banks': 'Development Bank',
    'development bank': 'Development Bank',
    'finance': 'Finance',
    'finances': 'Finance',
    'microfinance': 'Microfinance',
    'micro finance': 'Microfinance',
    'life insurance': 'Life Insurance',
    'life insurances': 'Life Insurance',
    'non life insurance': 'Non Life Insurance',
    'non-life insurance': 'Non Life Insurance',
    'manufacturing and processing': 'Manufacturing And Processing',
    'manufacturing': 'Manufacturing And Processing',
    'hotels and tourism': 'Hotels And Tourism',
    'hotel and tourism': 'Hotels And Tourism',
    'hotels': 'Hotels And Tourism',
    'trading': 'Trading',
    'others': 'Others',
    'other': 'Others',
    'mutual fund': 'Mutual Fund',
    'mutual funds': 'Mutual Fund',
    'investment': 'Investment',
    'investments': 'Investment'
};

// ==================== Helpers ====================

/**
 * Resolve the first non-nullish value from a list of candidates
 * @param  {...any} candidates - Values to check in priority order
 * @returns {any} First non-null/undefined value, or null
 */
const resolveField = (...candidates) => {
    for (const val of candidates) {
        if (val != null) return val;
    }
    return null;
};

/** Resolve a numeric field: first non-null candidate, parsed as float (default 0) */
const toFloat = (val) => parseFloat(val) || 0;

/** Resolve a numeric field: first non-null candidate, parsed as int (default 0) */
const toInt = (val) => parseInt(val) || 0;

/** Use value if positive, otherwise fallback */
const priceOrFallback = (price, fallback) => (price > 0 ? price : fallback);

/** Strip trailing 's' for plural normalization */
const stripTrailingS = (str) => (str.endsWith('s') ? str.slice(0, -1) : str);

// ==================== Core Functions ====================

/**
 * Normalize sector name to a canonical form
 * @param {string} sectorName - Raw sector name
 * @returns {string} Normalized sector name
 */
const normalizeSectorName = (sectorName) => {
    if (!sectorName) return 'Others';
    const normalized = sectorName.trim();
    return SECTOR_MAPPINGS[normalized.toLowerCase()] || normalized;
};

/**
 * Check if two sector names match (fuzzy comparison)
 * @param {string} stockSector - The stock's sector
 * @param {string} filterSector - The filter sector to match against
 * @returns {boolean} True if sectors match
 */
const sectorMatches = (stockSector, filterSector) => {
    if (!stockSector || !filterSector) return false;
    if (filterSector.toLowerCase() === 'all') return true;

    const s1 = normalizeSectorName(stockSector).toLowerCase();
    const s2 = normalizeSectorName(filterSector).toLowerCase();

    if (s1 === s2) return true;
    if (s1.includes(s2) || s2.includes(s1)) return true;
    return stripTrailingS(s1) === stripTrailingS(s2);
};

/** Extract price-related fields from stock + nested prices object */
const extractPriceFields = (stock, prices) => ({
    lastTradedPrice: toFloat(resolveField(stock.lastTradedPrice, stock.ltp, stock.close, prices.ltp, prices.close)),
    previousClose: toFloat(resolveField(stock.previousClose, stock.previousClosingPrice, prices.previousClose)),
    openPrice: toFloat(resolveField(stock.openPrice, stock.open, prices.open)),
    highPrice: toFloat(resolveField(stock.highPrice, stock.high, prices.high)),
    lowPrice: toFloat(resolveField(stock.lowPrice, stock.low, prices.low)),
});

/** Extract trading-related fields from stock + nested trading object */
const extractTradingFields = (stock, trading) => ({
    volume: toInt(resolveField(stock.volume, trading.volume, stock.totalTradedQuantity)),
    totalTrades: toInt(resolveField(stock.totalTrades, trading.totalTrades, stock.totalTradedTransactions)),
    turnover: toFloat(resolveField(stock.turnover, trading.turnover, stock.totalTradedValue)),
});

/** Extract change-related fields from stock + nested prices object */
const extractChangeFields = (stock, prices) => ({
    change: toFloat(resolveField(stock.change, prices.change, stock.pointChange)),
    percentageChange: toFloat(resolveField(stock.percentageChange, stock.changePercent, prices.changePercent)),
});

/** Extract identity fields (symbol, name, sector) with fallbacks */
const extractIdentityFields = (stock) => {
    const symbol = (stock.symbol || '').toUpperCase();
    return {
        symbol,
        companyName: stock.companyName || stock.name || symbol,
        sector: stock.sector || null,
    };
};

/**
 * Normalize stock input for database storage
 * Handles various input structures (flat, nested prices, nested trading)
 * @param {Object} stock - Raw stock object
 * @returns {Object|null} Normalized stock object ready for DB
 */
const normalizeStockInput = (stock) => {
    if (!stock) return null;

    const prices = stock.prices || {};
    const trading = stock.trading || {};

    const result = {
        ...extractIdentityFields(stock),
        ...extractPriceFields(stock, prices),
        ...extractTradingFields(stock, trading),
        ...extractChangeFields(stock, prices),
        updatedAt: new Date(),
        lastSource: stock.lastSource || null
    };

    return result;
};

/**
 * Standardize stock data from ANY source into a strictly strictly enforced internal shape.
 * This is the primary normalization utility for Phase 2.
 * @param {Object} rawData - Raw stock data from scrapers or API helpers
 * @param {string} source - Name of the data source
 * @returns {Object} Strictly normalized stock data
 */
const normalizeStockData = (rawData, source) => {
    const normalized = normalizeStockInput(rawData);
    if (!normalized) return null;

    // Attach provenance tracking
    normalized.lastSource = source;

    return normalized;
};

/**
 * Map database output to API response format
 * @param {Object} stock - Database stock entity
 * @returns {Object|null} Standardized API response object
 */
const mapStockOutput = (stock, compact = false) => {
    if (!stock) return null;

    const ltp = stock.lastTradedPrice ?? 0;
    const changePercent = stock.percentageChange ?? stock.changePercent ?? null;
    const openPrice = priceOrFallback(stock.openPrice, ltp);
    const highPrice = priceOrFallback(stock.highPrice, ltp);
    const lowPrice = priceOrFallback(stock.lowPrice, ltp);
    const timestamp = stock.updatedAt ? stock.updatedAt.toISOString() : undefined;

    const base = {
        symbol: stock.symbol,
        companyName: stock.companyName,
        sector: stock.sector,
        ltp,
        previousClose: stock.previousClose,
        open: openPrice,
        high: highPrice,
        low: lowPrice,
        volume: stock.volume,
        totalTrades: stock.totalTrades,
        turnover: stock.turnover,
        change: stock.change,
        changePercent,
        percentageChange1W: stock.percentageChange1W,
        percentageChange1M: stock.percentageChange1M,
        updatedAt: timestamp
    };

    if (compact) {
        return base;
    }

    return {
        ...base,
        lastTradedPrice: stock.lastTradedPrice,
        openPrice,
        highPrice,
        lowPrice,
        percentageChange: changePercent,
        prices: { ltp, change: stock.change, changePercent },
        trading: { volume: stock.volume, turnover: stock.turnover, totalTrades: stock.totalTrades },
        timestamp
    };
};

module.exports = {
    normalizeStockInput,
    normalizeStockData,
    mapStockOutput,
    normalizeSectorName,
    sectorMatches
};

