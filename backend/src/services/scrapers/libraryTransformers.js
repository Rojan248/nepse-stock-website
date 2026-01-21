/**
 * Library Data Transformers
 * Functions to transform NEPSE library API responses to standardized format
 */

const logger = require('../utils/logger');
const { SECTOR_IDS } = require('./libraryConfig');

/**
 * Sanitize symbol for storage key (remove special characters)
 * @param {string} symbol - Raw symbol string
 * @returns {string} Sanitized symbol
 */
const sanitizeSymbol = (symbol) => {
    if (!symbol) return '';
    return symbol.toString().trim().replace(/[^\w]/g, '').toUpperCase();
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
    const hasApiChange = !isNaN(apiPercentChange);

    // Calculate overnight change (LTP vs previous close)
    const overnightChange = ltp - prevClose;
    const overnightChangePercent = prevClose > 0 ? (overnightChange / prevClose) * 100 : 0;

    // Use API percentageChange if valid, otherwise use calculated overnight change
    const displayChangePercent = hasApiChange ? apiPercentChange : overnightChangePercent;
    const displayChange = hasApiChange
        ? (prevClose > 0 ? prevClose * (apiPercentChange / 100) : overnightChange)
        : overnightChange;

    // Calculate intraday change
    const intradayChange = ltp - open;
    const intradayChangePercent = open > 0 ? (intradayChange / open) * 100 : 0;

    return {
        displayChange: Math.round(displayChange * 100) / 100,
        displayChangePercent: Math.round(displayChangePercent * 100) / 100,
        intradayChange: Math.round(intradayChange * 100) / 100,
        intradayChangePercent: Math.round(intradayChangePercent * 100) / 100,
        overnightChange: Math.round(overnightChange * 100) / 100,
        overnightChangePercent: Math.round(overnightChangePercent * 100) / 100
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

/**
 * Extract and calculate trading metrics
 * @param {Object} security - Raw security object
 * @param {number} ltp - Last traded price
 * @returns {Object} Trading metrics
 */
const extractTradingMetrics = (security, ltp) => {
    const volume = parseInt(security.totalTradeQuantity) || parseInt(security.totalTradedQuantity) || 0;
    let turnover = parseFloat(security.totalTradedValue) || parseFloat(security.turnover) || 0;

    // Calculate turnover from LTP * Volume if not available
    if (turnover === 0 && volume > 0 && ltp > 0) {
        turnover = ltp * volume;
    }

    const totalTrades = parseInt(security.noOfTrades) || parseInt(security.totalTrades) || 0;
    const buyVolume = parseInt(security.totalBuyQuantity) || 0;
    const sellVolume = parseInt(security.totalSellQuantity) || 0;
    const buySellRatio = sellVolume > 0 ? buyVolume / sellVolume : 0;

    return {
        volume,
        turnover: Math.round(turnover * 100) / 100,
        totalTrades,
        supplyDemand: {
            buyVolume,
            sellVolume,
            ratio: Math.round(buySellRatio * 100) / 100
        }
    };
};

/**
 * Transform NEPSE security data to standard format
 * @param {Object} security - Raw security data from NEPSE API
 * @param {boolean} marketOpen - Whether market is currently open
 * @param {Map} staticStockMap - Static stock metadata map
 * @param {Function} isMarketOpenFn - Function to check market status
 * @returns {Object|null} Transformed security or null
 */
const transformSecurity = (security, marketOpen, staticStockMap, isMarketOpenFn) => {
    if (!security) return null;

    const rawSymbol = security.symbol || '';
    const symbol = sanitizeSymbol(rawSymbol);
    if (!symbol) return null;

    // Price handling
    const prevClose = parseFloat(security.previousClose) || 0;
    let ltp = parseFloat(security.lastTradedPrice) || parseFloat(security.closePrice) || 0;

    // Use previous close if no trade happened
    if (ltp === 0 && prevClose > 0) {
        ltp = prevClose;
    }

    // Use static base price as last resort
    if (ltp === 0 && prevClose === 0) {
        const staticInfo = staticStockMap.get(symbol.toUpperCase());
        if (staticInfo && staticInfo.base > 0) {
            ltp = staticInfo.base;
            logger.debug(`[${symbol}] Using static base price: ${ltp}`);
        }
    }

    const open = parseFloat(security.openPrice) || ltp;
    const apiPercentChange = parseFloat(security.percentageChange);

    // Calculate changes
    const changes = calculatePriceChanges(ltp, prevClose, open, apiPercentChange);

    // Determine sector
    const { sector, sectorId } = determineSector(symbol, security, staticStockMap);

    // Extract trading metrics
    const tradingMetrics = extractTradingMetrics(security, ltp);

    // Market status
    const isOpen = marketOpen !== null ? marketOpen : isMarketOpenFn();

    return {
        symbol,
        originalSymbol: rawSymbol,
        companyName: security.securityName || security.name || rawSymbol,
        sector,
        sectorId,
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
        isMarketOpen: isOpen,
        ...tradingMetrics,
        fiftyTwoWeek: {
            high: parseFloat(security.fiftyTwoWeekHigh) || 0,
            low: parseFloat(security.fiftyTwoWeekLow) || 0
        },
        lastUpdated: new Date().toISOString()
    };
};

/**
 * Transform market index data
 * @param {Object} indexData - Raw index data from NEPSE API
 * @returns {Object} Transformed index object
 */
const transformIndex = (indexData) => ({
    name: indexData.index || 'Unknown',
    value: parseFloat(indexData.currentValue) || 0,
    change: parseFloat(indexData.change) || 0,
    changePercent: parseFloat(indexData.perChange) || 0,
    previousClose: parseFloat(indexData.previousClose) || 0,
    high: parseFloat(indexData.high) || 0,
    low: parseFloat(indexData.low) || 0,
    turnover: parseFloat(indexData.turnover) || 0
});

module.exports = {
    sanitizeSymbol,
    calculatePriceChanges,
    determineSector,
    extractTradingMetrics,
    transformSecurity,
    transformIndex
};
