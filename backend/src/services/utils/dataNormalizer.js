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

/**
 * Normalize stock input for database storage
 * Handles various input structures (flat, nested prices, nested trading)
 * @param {Object} stock - Raw stock object
 * @returns {Object|null} Normalized stock object ready for DB
 */
const normalizeStockInput = (stock) => {
    if (!stock) return null;

    const p = stock.prices || {};
    const t = stock.trading || {};

    return {
        symbol: (stock.symbol || '').toUpperCase(),
        companyName: stock.companyName || stock.name || (stock.symbol || '').toUpperCase(),
        sector: stock.sector || null,
        lastTradedPrice: toFloat(resolveField(stock.lastTradedPrice, stock.ltp, stock.close, p.ltp, p.close)),
        previousClose: toFloat(resolveField(stock.previousClose, stock.previousClosingPrice, p.previousClose)),
        openPrice: toFloat(resolveField(stock.openPrice, p.open)),
        highPrice: toFloat(resolveField(stock.highPrice, p.high)),
        lowPrice: toFloat(resolveField(stock.lowPrice, p.low)),
        volume: toInt(resolveField(stock.volume, t.volume, stock.totalTradedQuantity)),
        totalTrades: toInt(resolveField(stock.totalTrades, t.totalTrades, stock.totalTradedTransactions)),
        turnover: toFloat(resolveField(stock.turnover, t.turnover, stock.totalTradedValue)),
        change: toFloat(resolveField(stock.change, p.change, stock.pointChange)),
        percentageChange: toFloat(resolveField(stock.percentageChange, stock.changePercent, p.changePercent)),
        updatedAt: new Date()
    };
};

/**
 * Map database output to API response format
 * @param {Object} stock - Database stock entity
 * @returns {Object|null} Standardized API response object
 */
const mapStockOutput = (stock) => {
    if (!stock) return null;

    const ltp = stock.lastTradedPrice ?? 0;
    const changePercent = stock.percentageChange ?? stock.changePercent ?? null;
    const openPrice = priceOrFallback(stock.openPrice, ltp);
    const highPrice = priceOrFallback(stock.highPrice, ltp);
    const lowPrice = priceOrFallback(stock.lowPrice, ltp);
    const timestamp = stock.updatedAt ? stock.updatedAt.toISOString() : undefined;

    return {
        symbol: stock.symbol,
        companyName: stock.companyName,
        sector: stock.sector,
        ltp,
        lastTradedPrice: stock.lastTradedPrice,
        previousClose: stock.previousClose,
        openPrice,
        highPrice,
        lowPrice,
        open: openPrice,
        high: highPrice,
        low: lowPrice,
        volume: stock.volume,
        totalTrades: stock.totalTrades,
        turnover: stock.turnover,
        change: stock.change,
        changePercent,
        percentageChange: changePercent,
        prices: { ltp, change: stock.change, changePercent },
        trading: { volume: stock.volume, turnover: stock.turnover, totalTrades: stock.totalTrades },
        updatedAt: timestamp,
        timestamp
    };
};

module.exports = {
    normalizeStockInput,
    mapStockOutput,
    normalizeSectorName,
    sectorMatches
};

