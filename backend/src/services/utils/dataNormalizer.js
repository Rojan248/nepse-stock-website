/**
 * Data Normalizer Service
 * Centralizes logic for normalizing stock data from various sources (scrapers, API responses)
 * so that database operations receive a consistent format.
 */

/**
 * Normalize sector name to a canonical form
 * Handles variations like "Hydro Power" vs "Hydropower", trailing 's', etc.
 * @param {string} sectorName - Raw sector name
 * @returns {string} Normalized sector name
 */
const normalizeSectorName = (sectorName) => {
    if (!sectorName) return 'Others';
    
    let normalized = sectorName.trim();
    
    // Common sector name mappings for NEPSE
    const sectorMappings = {
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
    
    const lowerName = normalized.toLowerCase();
    if (sectorMappings[lowerName]) {
        return sectorMappings[lowerName];
    }
    
    return normalized;
};

/**
 * Check if two sector names match (fuzzy comparison)
 * Used for filtering stocks by sector in the frontend
 * @param {string} stockSector - The stock's sector
 * @param {string} filterSector - The filter sector to match against
 * @returns {boolean} True if sectors match
 */
const sectorMatches = (stockSector, filterSector) => {
    if (!stockSector || !filterSector) return false;
    if (filterSector.toLowerCase() === 'all') return true;
    
    const s1 = normalizeSectorName(stockSector).toLowerCase();
    const s2 = normalizeSectorName(filterSector).toLowerCase();
    
    // Exact match after normalization
    if (s1 === s2) return true;
    
    // Substring match (handles partial matches)
    if (s1.includes(s2) || s2.includes(s1)) return true;
    
    // Handle pluralization differences
    const s1Base = s1.endsWith('s') ? s1.slice(0, -1) : s1;
    const s2Base = s2.endsWith('s') ? s2.slice(0, -1) : s2;
    
    return s1Base === s2Base;
};

/**
 * Normalize stock input for database storage
 * Handles various input structures (flat, nested prices, nested trading)
 * @param {Object} stock - Raw stock object
 * @returns {Object} Normalized stock object ready for DB
 */
const normalizeStockInput = (stock) => {
    if (!stock) return null;

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
        lastTradedPrice: parseFloat(lastTradedPrice) || 0,
        previousClose: parseFloat(previousClose) || 0,
        openPrice: parseFloat(openPrice) || 0,
        highPrice: parseFloat(highPrice) || 0,
        lowPrice: parseFloat(lowPrice) || 0,
        volume: parseInt(volume) || 0,
        totalTrades: parseInt(totalTrades) || 0,
        turnover: parseFloat(turnover) || 0,
        change: parseFloat(change) || 0,
        percentageChange: parseFloat(percentageChange) || 0,
        updatedAt: new Date()
    };
};

/**
 * Map database output to API response format
 * @param {Object} stock - Database stock entity
 * @returns {Object} Standardized API response object
 */
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

module.exports = {
    normalizeStockInput,
    mapStockOutput,
    normalizeSectorName,
    sectorMatches
};
