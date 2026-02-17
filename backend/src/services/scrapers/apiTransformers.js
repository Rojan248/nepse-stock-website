/**
 * API Data Transformers
 * Functions to transform raw API responses to standardized format
 */

// ==================== Shared Parse Utilities ====================

/** First valid float from candidates, or 0 */
const toF = (...vals) => {
    for (const v of vals) {
        const n = parseFloat(v);
        if (!isNaN(n)) return n;
    }
    return 0;
};

/** First valid int from candidates, or 0 */
const toI = (...vals) => {
    for (const v of vals) {
        const n = parseInt(v, 10);
        if (!isNaN(n)) return n;
    }
    return 0;
};

/** First truthy string from candidates, or fallback */
const str = (fallback, ...vals) => {
    for (const v of vals) {
        if (v) return v;
    }
    return fallback;
};

/** Parse a date from the first truthy candidate, or null */
const optionalDate = (...vals) => {
    for (const v of vals) {
        if (v) return new Date(v);
    }
    return null;
};

// ==================== Stock Field Extractors ====================

/** Resolve stock identity fields from any source format */
const stockIdentity = (s) => ({
    symbol: str('', s.symbol, s.securitySymbol, s.scrip),
    companyName: str('', s.securityName, s.companyName, s.name),
    sector: str('Others', s.sector, s.instrumentType, s.sectorName),
});

/** Resolve stock price fields (generic multi-source) */
const stockPrices = (s) => ({
    open: toF(s.openPrice, s.open),
    high: toF(s.highPrice, s.high),
    low: toF(s.lowPrice, s.low),
    close: toF(s.closePrice, s.close),
    ltp: toF(s.lastTradedPrice, s.ltp, s.close),
});

/** Resolve stock trading fields */
const stockTrading = (s) => ({
    volume: toI(s.totalTradedQuantity, s.volume, s.qty),
    turnover: toF(s.totalTradedValue, s.turnover, s.amount),
    noOfTransactions: toI(s.totalTrades, s.noOfTransactions),
});

/** Resolve stock change fields */
const stockChange = (s) => ({
    change: toF(s.pointChange, s.change, s.diff),
    changePercent: toF(s.percentageChange, s.perChange, s.changePercent),
    previousClose: toF(s.previousClose, s.previousDayClosePrice),
});

// ==================== Transform Functions ====================

/**
 * Transform NepAlpha stock data to standard format
 * @param {Object} item - Raw NepAlpha stock item
 * @returns {Object} Standardized stock object
 */
const transformNepAlphaStock = (item) => ({
    ...stockIdentity(item),
    prices: {
        open: toF(item.openPrice),
        high: toF(item.highPrice),
        low: toF(item.lowPrice),
        ltp: toF(item.lastTradedPrice, item.closePrice),
        previousClose: toF(item.previousClose, item.previousDayClosePrice),
        change: toF(item.pointChange),
        changePercent: toF(item.percentageChange),
    },
    trading: {
        volume: toI(item.totalTradedQuantity),
        turnover: toF(item.totalTradedValue),
        totalTrades: toI(item.totalTrades),
    },
    lastUpdated: new Date().toISOString()
});

/**
 * Transform generic stock data to standard format
 * @param {Object} stock - Raw stock data from various sources
 * @returns {Object} Standardized stock object
 */
const transformStock = (stock) => ({
    ...stockIdentity(stock),
    prices: stockPrices(stock),
    ...stockTrading(stock),
    ...stockChange(stock),
    marketCap: toF(stock.marketCapitalization, stock.marketCap),
    timestamp: new Date().toISOString()
});

/**
 * Transform ShareSansar stock data
 * @param {Object} item - Raw ShareSansar item
 * @returns {Object} Standardized stock object
 */
const transformShareSansarStock = (item) => ({
    symbol: str('', item.symbol),
    companyName: str('', item.companyName, item.name),
    sector: str('Others', item.sector),
    prices: {
        open: toF(item.open),
        high: toF(item.high),
        low: toF(item.low),
        ltp: toF(item.ltp, item.close),
        previousClose: toF(item.previousClose),
        change: toF(item.change),
        changePercent: toF(item.percentChange),
    },
    trading: {
        volume: toI(item.volume),
        turnover: toF(item.turnover),
        totalTrades: toI(item.trades),
    },
    lastUpdated: new Date().toISOString()
});

// ==================== Market Summary ====================

/** Resolve index-related market fields */
const marketIndex = (m) => ({
    indexValue: toF(m.index, m.nepseIndex),
    indexChange: toF(m.change, m.pointChange),
    indexChangePercent: toF(m.perChange, m.percentChange),
});

/** Resolve market aggregate fields */
const marketAggregates = (m) => ({
    totalTransactions: toI(m.totalTransactions),
    totalTurnover: toF(m.totalTurnover),
    totalVolume: toI(m.totalVolume),
});

/** Resolve market breadth fields */
const marketBreadth = (m) => ({
    activeCompanies: toI(m.tradedScrip),
    advancedCompanies: toI(m.positive),
    declinedCompanies: toI(m.negative),
    unchangedCompanies: toI(m.neutral),
});

/**
 * Transform market summary data from various sources
 * @param {Object} data - Raw market data
 * @returns {Object} Standardized market summary
 */
const transformMarketSummary = (data) => {
    const m = data.marketOpen || data.market || data;
    return {
        ...marketIndex(m),
        ...marketAggregates(m),
        ...marketBreadth(m),
        timestamp: new Date().toISOString()
    };
};

// ==================== IPO ====================

/**
 * Map IPO status string to standard format
 * @param {string} status - Raw status string
 * @returns {string} Standardized status
 */
const mapIPOStatus = (status) => {
    if (!status) return 'upcoming';
    const s = status.toLowerCase();
    if (s.includes('open')) return 'open';
    if (s.includes('close')) return 'closed';
    if (s.includes('complete') || s.includes('allot')) return 'completed';
    return 'upcoming';
};

/** Extract IPO identity fields */
const ipoIdentity = (ipo) => ({
    companyName: str('', ipo.companyName, ipo.name),
    sector: str('Others', ipo.sector, ipo.instrumentType),
    shareManager: str('', ipo.shareRegistrar, ipo.shareManager),
    issueManager: str('', ipo.issueManager),
});

/** Extract IPO date fields */
const ipoDates = (ipo) => ({
    announcement: optionalDate(ipo.announcementDate),
    applicationOpen: optionalDate(ipo.openDate, ipo.issueOpenDate),
    applicationClose: optionalDate(ipo.closeDate, ipo.issueCloseDate),
    resultDate: optionalDate(ipo.resultDate),
    allotmentDate: optionalDate(ipo.allotmentDate),
});

/** Extract IPO share/subscription fields */
const ipoShares = (ipo) => ({
    totalShares: toI(ipo.totalShares, ipo.units),
    minimumShares: toI(ipo.minUnit, ipo.minUnits) || 10,
    maximumShares: toI(ipo.maxUnit, ipo.maxUnits),
    issuedShares: toI(ipo.issuedShares),
    subscriptionRatio: toF(ipo.subscriptionTimes, ipo.subscriptionRatio),
});

/**
 * Transform IPO data to standard format
 * @param {Object} ipo - Raw IPO data
 * @returns {Object} Standardized IPO object
 */
const transformIPO = (ipo) => ({
    ...ipoIdentity(ipo),
    priceRange: {
        min: toF(ipo.pricePerUnit, ipo.minPrice) || 100,
        max: toF(ipo.pricePerUnit, ipo.maxPrice) || 100,
    },
    status: mapIPOStatus(str('', ipo.status, ipo.ipoStatus)),
    dates: ipoDates(ipo),
    ...ipoShares(ipo),
    timestamp: new Date().toISOString()
});

module.exports = {
    transformNepAlphaStock,
    transformStock,
    transformShareSansarStock,
    transformMarketSummary,
    mapIPOStatus,
    transformIPO
};
