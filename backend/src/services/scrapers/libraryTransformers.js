/**
 * Library Data Transformers
 * Functions to transform NEPSE library API responses to standardized format
 */

const logger = require('../utils/logger');
const { SECTOR_IDS } = require('./libraryConfig');

// ── Generic helpers ─────────────────────────────────────────────────

/** Parse first truthy float from an object's fields, defaulting to fallback */
const resolveFloat = (obj, fields, fallback = 0) => {
    for (const f of fields) {
        const v = parseFloat(obj[f]);
        if (!isNaN(v) && v !== 0) return v;
    }
    return fallback;
};

/** Parse first truthy int from an object's fields, defaulting to fallback */
const resolveInt = (obj, fields, fallback = 0) => {
    for (const f of fields) {
        const v = parseInt(obj[f], 10);
        if (!isNaN(v) && v !== 0) return v;
    }
    return fallback;
};

/** Round a number to 2 decimal places */
const round2 = (n) => Math.round(n * 100) / 100;

// ── Sanitizer ───────────────────────────────────────────────────────

/**
 * Sanitize symbol for storage key (remove special characters)
 * @param {string} symbol - Raw symbol string
 * @returns {string} Sanitized symbol
 */
const sanitizeSymbol = (symbol) => {
    if (!symbol) return '';
    return symbol.toString().trim().replace(/[^\w]/g, '').toUpperCase();
};

/** Compute overnight (display) change and percent from LTP vs prevClose */
const computeOvernightChange = (ltp, prevClose) => {
    const change = ltp - prevClose;
    const percent = prevClose > 0 ? (change / prevClose) * 100 : 0;
    return { change, percent };
};

/** Resolve display change values, preferring API percent when available */
const computeDisplayChange = (prevClose, apiPercentChange, overnight) => {
    if (isNaN(apiPercentChange)) {
        return { displayChange: overnight.change, displayChangePercent: overnight.percent };
    }
    const displayChange = prevClose > 0
        ? prevClose * (apiPercentChange / 100)
        : overnight.change;
    return { displayChange, displayChangePercent: apiPercentChange };
};

/**
 * Calculate price change values
 * @param {number} ltp - Last traded price
 * @param {number} prevClose - Previous close price
 * @param {number} open - Opening price
 * @param {number} apiPercentChange - API-provided percentage change
 * @returns {Object} Change calculations
 */
const calculatePriceChanges = (ltp, prevClose, open, apiPercentChange) => {
    const overnight = computeOvernightChange(ltp, prevClose);
    const { displayChange, displayChangePercent } = computeDisplayChange(prevClose, apiPercentChange, overnight);

    const intradayChange = ltp - open;
    const intradayChangePercent = open > 0 ? (intradayChange / open) * 100 : 0;

    return {
        displayChange: round2(displayChange),
        displayChangePercent: round2(displayChangePercent),
        intradayChange: round2(intradayChange),
        intradayChangePercent: round2(intradayChangePercent),
        overnightChange: round2(overnight.change),
        overnightChangePercent: round2(overnight.percent)
    };
};

/**
 * Determine sector from API data and static metadata
 * @param {string} symbol - Stock symbol
 * @param {Object} security - Raw security object
 * @param {Map} staticStockMap - Static stock metadata map
 * @returns {Object} { sector, sectorId }
 */
const determineSector = (symbol, security, staticStockMap) => {
    const staticInfo = staticStockMap.get(symbol.toUpperCase());
    const apiSectorId = security.indexId;
    const apiSectorName = SECTOR_IDS[apiSectorId];

    let sector = 'Others';
    let sectorId = 53;

    if (staticInfo && staticInfo.sector) {
        sector = staticInfo.sector;
        sectorId = apiSectorId || 53;
    } else if (apiSectorName && apiSectorId !== 58) {
        // Only use API sector if it's not the generic 'NEPSE Index' (ID 58)
        sector = apiSectorName;
        sectorId = apiSectorId;
    }

    return { sector, sectorId };
};

// ── Trading metrics ─────────────────────────────────────────────────

/** True when turnover can be estimated from LTP and volume */
const canEstimateTurnover = (turnover, volume, ltp) =>
    turnover === 0 && volume > 0 && ltp > 0;

/** Build supply/demand sub-object */
const buildSupplyDemand = (security) => {
    const buyVolume = resolveInt(security, ['totalBuyQuantity']);
    const sellVolume = resolveInt(security, ['totalSellQuantity']);
    return {
        buyVolume,
        sellVolume,
        ratio: sellVolume > 0 ? round2(buyVolume / sellVolume) : 0
    };
};

/**
 * Extract and calculate trading metrics
 * @param {Object} security - Raw security object
 * @param {number} ltp - Last traded price
 * @returns {Object} Trading metrics
 */
const extractTradingMetrics = (security, ltp) => {
    const volume = resolveInt(security, ['totalTradeQuantity', 'totalTradedQuantity']);
    let turnover = resolveFloat(security, ['totalTradedValue', 'turnover']);

    if (canEstimateTurnover(turnover, volume, ltp)) {
        turnover = ltp * volume;
    }

    return {
        volume,
        turnover: round2(turnover),
        totalTrades: resolveInt(security, ['totalTrades', 'noOfTransactions', 'noOfTrades']),
        supplyDemand: buildSupplyDemand(security)
    };
};

/** Force changes to zero if volume is zero to prevent stale API metrics */
const enforceVolumeZeroChanges = (changes, volume) => {
    if (volume === 0 || isNaN(volume)) {
        return {
            ...changes,
            displayChange: 0,
            displayChangePercent: 0,
            intradayChange: 0,
            intradayChangePercent: 0,
            overnightChange: 0,
            overnightChangePercent: 0
        };
    }
    return changes;
};

// ── Security price resolution ───────────────────────────────────────

/** Resolve the last traded price with fallback chain */
const resolveLtp = (security, prevClose, staticStockMap, symbol) => {
    let ltp = resolveFloat(security, ['lastTradedPrice', 'closePrice']);

    if (ltp === 0 && prevClose > 0) {
        ltp = prevClose;
    }

    if (ltp === 0 && prevClose === 0) {
        const staticInfo = staticStockMap.get(symbol.toUpperCase());
        if (staticInfo && staticInfo.base > 0) {
            ltp = staticInfo.base;
            logger.debug(`[${symbol}] Using static base price: ${ltp}`);
        }
    }

    return ltp;
};

/** Build the price/change/52-week fields from a security
 * @param {Object} security - Raw security object
 * @param {Object} prices - { ltp, prevClose, open, changes }
 */
const buildPriceFields = (security, { ltp, prevClose, open, changes }) => ({
    ltp,
    open,
    high: parseFloat(security.highPrice) || ltp,
    low: parseFloat(security.lowPrice) || ltp,
    close: parseFloat(security.closePrice) || ltp,
    previousClose: prevClose,
    change: changes.displayChange,
    changePercent: changes.displayChangePercent,
    intradayChange: changes.intradayChange,
    intradayChangePercent: changes.intradayChangePercent,
    overnightChange: changes.overnightChange,
    overnightChangePercent: changes.overnightChangePercent,
    fiftyTwoWeek: {
        high: parseFloat(security.fiftyTwoWeekHigh) || 0,
        low: parseFloat(security.fiftyTwoWeekLow) || 0
    }
});

// ── Transform security ──────────────────────────────────────────────

/** Resolve the display name for a security */
const resolveCompanyName = (security, rawSymbol) =>
    security.securityName || security.name || rawSymbol;

/** Resolve effective market-open status */
const resolveMarketOpen = (marketOpen, isMarketOpenFn) =>
    marketOpen !== null ? marketOpen : isMarketOpenFn();

const transformSecurity = (security, marketOpen, staticStockMap, isMarketOpenFn) => {
    if (!security) return null;

    const rawSymbol = security.symbol || '';
    const symbol = sanitizeSymbol(rawSymbol);
    if (!symbol) return null;

    const prevClose = parseFloat(security.previousClose) || 0;
    const ltp = resolveLtp(security, prevClose, staticStockMap, symbol);
    const open = parseFloat(security.openPrice) || ltp;
    
    // Extract metrics first so we have the volume
    const metrics = extractTradingMetrics(security, ltp);
    
    // Calculate initial changes then enforce zero if volume is 0
    let changes = calculatePriceChanges(ltp, prevClose, open, parseFloat(security.percentageChange));
    changes = enforceVolumeZeroChanges(changes, metrics.volume);
    
    const { sector, sectorId } = determineSector(symbol, security, staticStockMap);

    return {
        symbol,
        originalSymbol: rawSymbol,
        companyName: resolveCompanyName(security, rawSymbol),
        sector,
        sectorId,
        ...buildPriceFields(security, { ltp, prevClose, open, changes }),
        isMarketOpen: resolveMarketOpen(marketOpen, isMarketOpenFn),
        ...metrics,
        lastUpdated: new Date().toISOString()
    };
};

// ── Transform index (table-lookup) ──────────────────────────────────

/** Field mapping: [outputKey, sourceField] */
const INDEX_FIELDS = [
    ['value', 'currentValue'],
    ['change', 'change'],
    ['changePercent', 'perChange'],
    ['previousClose', 'previousClose'],
    ['high', 'high'],
    ['low', 'low'],
    ['turnover', 'turnover'],
];

/**
 * Transform market index data
 * @param {Object} indexData - Raw index data from NEPSE API
 * @returns {Object} Transformed index object
 */
const transformIndex = (indexData) => {
    const result = { name: indexData.index || 'Unknown' };
    for (const [key, src] of INDEX_FIELDS) {
        result[key] = parseFloat(indexData[src]) || 0;
    }
    return result;
};

module.exports = {
    sanitizeSymbol,
    calculatePriceChanges,
    determineSector,
    extractTradingMetrics,
    transformSecurity,
    transformIndex
};
