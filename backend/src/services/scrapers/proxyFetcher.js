const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Proxy-based NEPSE Data Fetcher
 * Uses multiple NEPSE data API sources with fallback
 */

const TIMEOUT = 15000; // 15 seconds

// Multiple API sources to try
const API_SOURCES = [
    {
        name: 'NepseAPI',
        baseUrl: 'https://nepse-api.herokuapp.com',
        stocksEndpoint: '/api/stocks',
        marketEndpoint: '/api/market'
    },
    {
        name: 'NepseData',
        baseUrl: 'https://nepsedata.com',
        stocksEndpoint: '/api/v1/stocks',
        marketEndpoint: '/api/v1/market'
    },
    {
        name: 'MeroShare',
        baseUrl: 'https://backend.meroshare.cdsc.com.np',
        stocksEndpoint: '/api/v1/stocks',
        marketEndpoint: '/api/v1/market'
    }
];

// Create axios instance with defaults
const createClient = (baseURL) => axios.create({
    baseURL,
    timeout: TIMEOUT,
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
});

/**
 * Fetch all data from multiple proxy sources
 * @returns {Object|null} Standardized data object or null on failure
 */
const fetchData = async () => {
    try {
        logger.info('Fetching data using proxy fetcher...');

        // Try NepAlpha API first (most reliable)
        const nepalphaData = await fetchFromNepAlpha();
        if (nepalphaData && nepalphaData.stocks && nepalphaData.stocks.length > 0) {
            logger.info(`Proxy fetcher: Retrieved ${nepalphaData.stocks.length} stocks from NepAlpha`);
            return nepalphaData;
        }

        // Try ShareSansar API
        const shareSansarData = await fetchFromShareSansar();
        if (shareSansarData && shareSansarData.stocks && shareSansarData.stocks.length > 0) {
            logger.info(`Proxy fetcher: Retrieved ${shareSansarData.stocks.length} stocks from ShareSansar`);
            return shareSansarData;
        }

        // Try generic API sources
        for (const source of API_SOURCES) {
            try {
                const client = createClient(source.baseUrl);
                const [marketData, stocksData] = await Promise.all([
                    fetchMarketSummaryFromSource(client, source),
                    fetchStocksFromSource(client, source)
                ]);

                if (stocksData && stocksData.length > 0) {
                    logger.info(`Proxy fetcher: Retrieved ${stocksData.length} stocks from ${source.name}`);
                    return {
                        stocks: stocksData,
                        ipos: [],
                        marketSummary: marketData,
                        source: `proxy-${source.name}`,
                        timestamp: new Date().toISOString()
                    };
                }
            } catch (sourceError) {
                logger.debug(`${source.name} failed: ${sourceError.message}`);
            }
        }

        logger.warn('Proxy fetcher: No data received from any source');
        return null;

    } catch (error) {
        logger.error(`Proxy fetcher error: ${error.message}`);
        return null;
    }
};

/**
 * Fetch from NepAlpha API - Known working NEPSE data API
 */
const fetchFromNepAlpha = async () => {
    try {
        const client = axios.create({
            timeout: TIMEOUT,
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        // Try NepAlpha live price endpoint
        const response = await client.get('https://nepalstock.com.np/api/nots/nepse-data/today-price', {
            headers: {
                'Accept': 'application/json',
                'Referer': 'https://nepalstock.com.np/'
            }
        });

        if (response.data && Array.isArray(response.data)) {
            const stocks = response.data.map(item => transformNepAlphaStock(item));
            return {
                stocks,
                ipos: [],
                marketSummary: null,
                source: 'nepalpha',
                timestamp: new Date().toISOString()
            };
        }
    } catch (error) {
        logger.debug(`NepAlpha fetch failed: ${error.message}`);
    }
    return null;
};

/**
 * Transform NepAlpha stock data
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
 * Fetch from ShareSansar API
 */
const fetchFromShareSansar = async () => {
    try {
        const client = axios.create({
            timeout: TIMEOUT,
            headers: {
                'Accept': 'text/html,application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.sharesansar.com/'
            }
        });

        const response = await client.get('https://www.sharesansar.com/live-trading');
        
        // ShareSansar returns HTML, would need HTML parsing
        // This is a placeholder - real implementation would parse the HTML
        if (response.data && typeof response.data === 'object' && response.data.data) {
            const stocks = response.data.data.map(item => ({
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
            }));
            
            return {
                stocks,
                ipos: [],
                marketSummary: null,
                source: 'sharesansar',
                timestamp: new Date().toISOString()
            };
        }
    } catch (error) {
        logger.debug(`ShareSansar fetch failed: ${error.message}`);
    }
    return null;
};

/**
 * Fetch market summary from a specific source
 */
const fetchMarketSummaryFromSource = async (client, source) => {
    try {
        const response = await client.get(source.marketEndpoint);

        if (response.data) {
            const data = response.data;
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
        }
    } catch (error) {
        logger.debug(`Market summary fetch from ${source.name} failed: ${error.message}`);
    }
    return null;
};

/**
 * Fetch stocks from a specific source
 */
const fetchStocksFromSource = async (client, source) => {
    try {
        const response = await client.get(source.stocksEndpoint);

        if (response.data) {
            let securities = response.data;
            if (securities.data) securities = securities.data;
            if (securities.securities) securities = securities.securities;
            if (securities.stocks) securities = securities.stocks;

            if (Array.isArray(securities) && securities.length > 0) {
                return securities.map(stock => transformStock(stock));
            }
        }
    } catch (error) {
        logger.debug(`Stocks fetch from ${source.name} failed: ${error.message}`);
    }
    return [];
};

/**
 * Transform stock data to standard format
 */
const transformStock = (stock) => {
    return {
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
    };
};

/**
 * Fetch IPOs from proxy
 */
const fetchIPOs = async () => {
    try {
        // Try different endpoints
        const endpoints = ['/api/ipo', '/ipos', '/api/ipos'];

        for (const endpoint of endpoints) {
            try {
                const response = await proxyClient.get(endpoint);

                if (response.data) {
                    let ipos = response.data;

                    // Handle wrapped responses
                    if (ipos.data) ipos = ipos.data;
                    if (ipos.ipos) ipos = ipos.ipos;

                    if (Array.isArray(ipos) && ipos.length > 0) {
                        return ipos.map(ipo => transformIPO(ipo));
                    }
                }
            } catch (endpointError) {
                logger.debug(`Proxy endpoint ${endpoint} failed: ${endpointError.message}`);
            }
        }

        return [];
    } catch (error) {
        logger.error(`Error fetching IPOs from proxy: ${error.message}`);
        return [];
    }
};

/**
 * Transform IPO data to standard format
 */
const transformIPO = (ipo) => {
    return {
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
    };
};

/**
 * Map IPO status to standard format
 */
const mapIPOStatus = (status) => {
    if (!status) return 'upcoming';
    const statusLower = status.toLowerCase();
    if (statusLower.includes('open')) return 'open';
    if (statusLower.includes('close')) return 'closed';
    if (statusLower.includes('complete') || statusLower.includes('allot')) return 'completed';
    return 'upcoming';
};

module.exports = {
    fetchData
};
