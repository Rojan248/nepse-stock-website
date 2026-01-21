/**
 * API Data Transformers
 * Functions to transform raw API responses to standardized format
 */

/**
 * Transform NepAlpha stock data to standard format
 * @param {Object} item - Raw NepAlpha stock item
 * @returns {Object} Standardized stock object
 */
const transformNepAlphaStock = (item) => ({
    symbol: item.symbol || item.securitySymbol || '',
    companyName: item.securityName || item.companyName || '',
    sector: item.sectorName || item.sector || 'Others',
    prices: {
        open: parseFloat(item.openPrice) || 0,
        high: parseFloat(item.highPrice) || 0,
        low: parseFloat(item.lowPrice) || 0,
        ltp: parseFloat(item.lastTradedPrice) || parseFloat(item.closePrice) || 0,
        previousClose: parseFloat(item.previousClose) || parseFloat(item.previousDayClosePrice) || 0,
        change: parseFloat(item.pointChange) || 0,
        changePercent: parseFloat(item.percentageChange) || 0
    },
    trading: {
        volume: parseInt(item.totalTradedQuantity) || 0,
        turnover: parseFloat(item.totalTradedValue) || 0,
        totalTrades: parseInt(item.totalTrades) || 0
    },
    lastUpdated: new Date().toISOString()
});

/**
 * Transform generic stock data to standard format
 * @param {Object} stock - Raw stock data from various sources
 * @returns {Object} Standardized stock object
 */
const transformStock = (stock) => ({
    symbol: stock.symbol || stock.securitySymbol || stock.scrip || '',
    companyName: stock.securityName || stock.companyName || stock.name || '',
    sector: stock.sector || stock.instrumentType || stock.sectorName || 'Others',
    prices: {
        open: parseFloat(stock.openPrice) || parseFloat(stock.open) || 0,
        high: parseFloat(stock.highPrice) || parseFloat(stock.high) || 0,
        low: parseFloat(stock.lowPrice) || parseFloat(stock.low) || 0,
        close: parseFloat(stock.closePrice) || parseFloat(stock.close) || 0,
        ltp: parseFloat(stock.lastTradedPrice) || parseFloat(stock.ltp) || parseFloat(stock.close) || 0
    },
    volume: parseInt(stock.totalTradedQuantity) || parseInt(stock.volume) || parseInt(stock.qty) || 0,
    turnover: parseFloat(stock.totalTradedValue) || parseFloat(stock.turnover) || parseFloat(stock.amount) || 0,
    noOfTransactions: parseInt(stock.totalTrades) || parseInt(stock.noOfTransactions) || 0,
    change: parseFloat(stock.pointChange) || parseFloat(stock.change) || parseFloat(stock.diff) || 0,
    changePercent: parseFloat(stock.percentageChange) || parseFloat(stock.perChange) || parseFloat(stock.changePercent) || 0,
    previousClose: parseFloat(stock.previousClose) || parseFloat(stock.previousDayClosePrice) || 0,
    marketCap: parseFloat(stock.marketCapitalization) || parseFloat(stock.marketCap) || 0,
    timestamp: new Date().toISOString()
});

/**
 * Transform ShareSansar stock data
 * @param {Object} item - Raw ShareSansar item
 * @returns {Object} Standardized stock object
 */
const transformShareSansarStock = (item) => ({
    symbol: item.symbol || '',
    companyName: item.companyName || item.name || '',
    sector: item.sector || 'Others',
    prices: {
        open: parseFloat(item.open) || 0,
        high: parseFloat(item.high) || 0,
        low: parseFloat(item.low) || 0,
        ltp: parseFloat(item.ltp) || parseFloat(item.close) || 0,
        previousClose: parseFloat(item.previousClose) || 0,
        change: parseFloat(item.change) || 0,
        changePercent: parseFloat(item.percentChange) || 0
    },
    trading: {
        volume: parseInt(item.volume) || 0,
        turnover: parseFloat(item.turnover) || 0,
        totalTrades: parseInt(item.trades) || 0
    },
    lastUpdated: new Date().toISOString()
});

/**
 * Transform market summary data from various sources
 * @param {Object} data - Raw market data
 * @returns {Object} Standardized market summary
 */
const transformMarketSummary = (data) => {
    const marketInfo = data.marketOpen || data.market || data;
    return {
        indexValue: parseFloat(marketInfo.index) || parseFloat(marketInfo.nepseIndex) || 0,
        indexChange: parseFloat(marketInfo.change) || parseFloat(marketInfo.pointChange) || 0,
        indexChangePercent: parseFloat(marketInfo.perChange) || parseFloat(marketInfo.percentChange) || 0,
        totalTransactions: parseInt(marketInfo.totalTransactions) || 0,
        totalTurnover: parseFloat(marketInfo.totalTurnover) || 0,
        totalVolume: parseInt(marketInfo.totalVolume) || 0,
        activeCompanies: parseInt(marketInfo.tradedScrip) || 0,
        advancedCompanies: parseInt(marketInfo.positive) || 0,
        declinedCompanies: parseInt(marketInfo.negative) || 0,
        unchangedCompanies: parseInt(marketInfo.neutral) || 0,
        timestamp: new Date().toISOString()
    };
};

/**
 * Map IPO status string to standard format
 * @param {string} status - Raw status string
 * @returns {string} Standardized status
 */
const mapIPOStatus = (status) => {
    if (!status) return 'upcoming';
    const statusLower = status.toLowerCase();
    if (statusLower.includes('open')) return 'open';
    if (statusLower.includes('close')) return 'closed';
    if (statusLower.includes('complete') || statusLower.includes('allot')) return 'completed';
    return 'upcoming';
};

/**
 * Transform IPO data to standard format
 * @param {Object} ipo - Raw IPO data
 * @returns {Object} Standardized IPO object
 */
const transformIPO = (ipo) => ({
    companyName: ipo.companyName || ipo.name || '',
    sector: ipo.sector || ipo.instrumentType || 'Others',
    shareManager: ipo.shareRegistrar || ipo.shareManager || '',
    issueManager: ipo.issueManager || '',
    priceRange: {
        min: parseFloat(ipo.pricePerUnit) || parseFloat(ipo.minPrice) || 100,
        max: parseFloat(ipo.pricePerUnit) || parseFloat(ipo.maxPrice) || 100
    },
    totalShares: parseInt(ipo.totalShares) || parseInt(ipo.units) || 0,
    status: mapIPOStatus(ipo.status || ipo.ipoStatus || ''),
    dates: {
        announcement: ipo.announcementDate ? new Date(ipo.announcementDate) : null,
        applicationOpen: ipo.openDate || ipo.issueOpenDate ? new Date(ipo.openDate || ipo.issueOpenDate) : null,
        applicationClose: ipo.closeDate || ipo.issueCloseDate ? new Date(ipo.closeDate || ipo.issueCloseDate) : null,
        resultDate: ipo.resultDate ? new Date(ipo.resultDate) : null,
        allotmentDate: ipo.allotmentDate ? new Date(ipo.allotmentDate) : null
    },
    subscriptionRatio: parseFloat(ipo.subscriptionTimes) || parseFloat(ipo.subscriptionRatio) || 0,
    minimumShares: parseInt(ipo.minUnit) || parseInt(ipo.minUnits) || 10,
    maximumShares: parseInt(ipo.maxUnit) || parseInt(ipo.maxUnits) || 0,
    issuedShares: parseInt(ipo.issuedShares) || 0,
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
