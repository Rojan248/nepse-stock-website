const axios = require('axios');
const logger = require('../utils/logger');
const NEPSE_STOCKS = require('../../data/nepseStocks');
const https = require('https');
const http = require('http');

/**
 * Custom NEPSE Scraper - Reliable Public Endpoint & HTML Scraper
 * 
 * STRATEGY:
 * 1. Try NEPSE's public API endpoints (Today's Price) with browser headers.
 *    - This often works without auth if headers match a real browser.
 * 2. Fallback to Alternative Sources (Merolagani/NepseAlpha).
 * 3. Last Resort: Simulated Data.
 * 
 * NOTE: This scraper specifically AVOIDS the complex token/salt logic which is 
 * already handled by the primary `libraryFetcher.js` (using nepse-api-helper).
 * This ensures we have a truly distinct fallback method.
 */

const NEPSE_BASE_URL = 'https://nepalstock.com.np';
const TIMEOUT = 5000;

// Browser-like headers to bypass basic WAF checks
const BROWSER_HEADERS = {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'keep-alive',
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://nepalstock.com.np/',
    'Origin': 'https://nepalstock.com.np',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin'
};

const nepseClient = axios.create({
    baseURL: NEPSE_BASE_URL,
    timeout: TIMEOUT,
    httpAgent: new http.Agent({ keepAlive: true }),
    httpsAgent: new https.Agent({ keepAlive: true }),
    headers: BROWSER_HEADERS
});

// ==================== Shared Helpers ====================

/** Resolve first truthy float from candidate field names */
const resolveFloat = (obj, fields) => {
    for (const f of fields) {
        const v = parseFloat(obj[f]);
        if (!isNaN(v) && v !== 0) return v;
    }
    return 0;
};

/** Resolve first truthy int from candidate field names */
const resolveInt = (obj, fields) => {
    for (const f of fields) {
        const v = parseInt(obj[f], 10);
        if (!isNaN(v) && v !== 0) return v;
    }
    return 0;
};

/** Resolve first truthy string from candidate field names */
const resolveStr = (obj, fields, fallback = '') => {
    for (const f of fields) {
        if (obj[f]) return obj[f];
    }
    return fallback;
};

/** Check whether a scraper result contains usable stock data */
const hasValidStockData = (result) =>
    result && result.stocks && result.stocks.length > 0;

/**
 * Main Fetch Function
 */
const fetchData = async () => {
    logger.info('Custom scraper (fallback) starting...');

    // Strategy 1: NEPSE Public Endpoints
    try {
        const publicData = await fetchFromNEPSEPublic();
        if (hasValidStockData(publicData)) {
            logger.info(`✓ Custom scraper: Got ${publicData.stocks.length} stocks from NEPSE public API`);
            return publicData;
        }
    } catch (error) {
        logger.debug(`Custom scraper: NEPSE public API failed: ${error.message}`);
    }

    // Strategy 2: Alternative Sources (Merolagani)
    try {
        const altData = await fetchFromAlternativeSources();
        if (hasValidStockData(altData)) {
            logger.info(`✓ Custom scraper: Got ${altData.stocks.length} stocks from Alternative Source`);
            return altData;
        }
    } catch (error) {
        logger.debug(`Custom scraper: Alternative sources failed: ${error.message}`);
    }

    logger.warn('Custom scraper: All real sources failed. Simulation is disabled.');
    return { stocks: [], ipos: [], marketSummary: null, source: 'none' };
};

/**
 * Fetch from NEPSE public endpoints that might be exposed
 */
const fetchFromNEPSEPublic = async () => {
    // List of potential public endpoints to try
    const endpoints = [
        '/api/nots/nepse-data/today-price', // Often the most reliable public one
        '/api/nots/securityDailyTradeStat/58' // Sometimes accessible
    ];

    for (const endpoint of endpoints) {
        try {
            logger.debug(`Custom scraper: Trying ${endpoint}...`);
            const response = await nepseClient.get(endpoint);

            let data = response.data;
            // Handle different wrapper formats
            if (data.data) data = data.data;
            if (data.content) data = data.content;

            if (Array.isArray(data) && data.length > 0) {
                return buildScraperResult(data.map(transformNEPSEStock), 'nepse-public-fallback');
            }
        } catch (error) {
            // Ssh, it's a fallback
        }
    }
    return null;
};

/** Resolve identity fields from NEPSE stock item */
const resolveNEPSEIdentity = (item) => {
    const symbol = resolveStr(item, ['symbol', 'securitySymbol', 'scrip']);
    return {
        symbol,
        companyName: resolveStr(item, ['securityName', 'companyName', 'name'], symbol),
        sector: resolveStr(item, ['sectorName', 'sector', 'instrumentType'], 'Others')
    };
};

/** Resolve price fields and derived change values */
const resolveNEPSEPrices = (item) => {
    const ltp = resolveFloat(item, ['lastTradedPrice', 'closePrice', 'ltp']);
    const prevClose = resolveFloat(item, ['previousClose', 'previousDayClosePrice']);
    const change = parseFloat(item.pointChange) || (ltp - prevClose) || 0;
    const changePercent = parseFloat(item.percentageChange) || (prevClose ? (change / prevClose * 100) : 0);
    return {
        ltp,
        open: resolveFloat(item, ['openPrice', 'open']),
        high: resolveFloat(item, ['highPrice', 'high']),
        low: resolveFloat(item, ['lowPrice', 'low']),
        previousClose: prevClose,
        change: Math.round(change * 100) / 100,
        changePercent: Math.round(changePercent * 100) / 100
    };
};

/** Resolve trading volume fields */
const resolveNEPSETrading = (item) => ({
    volume: resolveInt(item, ['totalTradedQuantity', 'volume']),
    turnover: resolveFloat(item, ['totalTradedValue', 'turnover']),
    totalTrades: resolveInt(item, ['totalTrades', 'noOfTransactions'])
});

/** Resolve 52-week range fields */
const resolveNEPSE52Week = (item) => ({
    high: resolveFloat(item, ['fiftyTwoWeekHigh']),
    low: resolveFloat(item, ['fiftyTwoWeekLow'])
});

/**
 * Transform NEPSE API stock data to standard format
 */
const transformNEPSEStock = (item) => ({
    ...resolveNEPSEIdentity(item),
    prices: { ...resolveNEPSEPrices(item) },
    lastTradedPrice: resolveNEPSEPrices(item).ltp,
    previousClose: resolveNEPSEPrices(item).previousClose,
    percentageChange: resolveNEPSEPrices(item).changePercent,
    change: resolveNEPSEPrices(item).change,
    trading: resolveNEPSETrading(item),
    fiftyTwoWeek: resolveNEPSE52Week(item),
    lastUpdated: new Date().toISOString()
});

/** Transform a single Merolagani item to standard stock format */
const transformMerolaganiStock = (item) => ({
    symbol: resolveStr(item, ['s', 'symbol']),
    companyName: resolveStr(item, ['n', 'name']),
    sector: item.sector || 'Others',
    prices: {
        ltp: resolveFloat(item, ['l', 'ltp']),
        open: resolveFloat(item, ['o']),
        high: resolveFloat(item, ['h']),
        low: resolveFloat(item, ['lo']),
        previousClose: resolveFloat(item, ['pc']),
        change: resolveFloat(item, ['c']),
        changePercent: resolveFloat(item, ['cp'])
    },
    lastTradedPrice: resolveFloat(item, ['l', 'ltp']),
    previousClose: resolveFloat(item, ['pc']),
    percentageChange: resolveFloat(item, ['cp']),
    change: resolveFloat(item, ['c']),
    trading: {
        volume: resolveInt(item, ['v']),
        turnover: resolveFloat(item, ['t']),
        totalTrades: 0
    },
    lastUpdated: new Date().toISOString()
});

/** Build a standard scraper result envelope */
const buildScraperResult = (stocks, source) => ({
    stocks,
    ipos: [],
    marketSummary: null,
    source,
    timestamp: new Date().toISOString()
});

/**
 * Fetch from alternative data sources (Merolagani)
 */
const fetchFromAlternativeSources = async () => {
    try {
        const response = await axios.get('https://merolagani.com/handlers/weaboradataaborahandler.ashx', {
            params: { type: 'get_live_market' },
            timeout: TIMEOUT,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const isValidArray = response.data && Array.isArray(response.data);
        if (!isValidArray) return null;

        const stocks = response.data.map(transformMerolaganiStock);
        return stocks.length > 0 ? buildScraperResult(stocks, 'merolagani-fallback') : null;
    } catch (error) {
        // Silent fail
    }
    return null;
};

/**
 * Generate realistic price fluctuations based on base price
 */
const generateRealisticPrice = (basePrice, volatility = 0.03) => {
    const change = (Math.random() - 0.5) * 2 * volatility;
    return Math.round(basePrice * (1 + change) * 100) / 100;
};

/**
 * Generate simulated but realistic market data from static stock list
 * This is the LAST RESORT fallback when all real APIs fail
 */
const generateSimulatedData = () => {
    const now = new Date();
    const stocks = NEPSE_STOCKS.map(stock => {
        const basePrice = stock.base || Math.floor(Math.random() * 500) + 100;
        const ltp = generateRealisticPrice(basePrice);
        const previousClose = generateRealisticPrice(basePrice, 0.01);
        const change = Math.round((ltp - previousClose) * 100) / 100;
        const changePercent = Math.round((change / previousClose) * 10000) / 100;
        const open = generateRealisticPrice(basePrice, 0.02);
        const high = Math.max(ltp, open) + Math.random() * 10;
        const low = Math.min(ltp, open) - Math.random() * 10;
        const volume = Math.floor(Math.random() * 50000) + 1000;
        const turnover = Math.round(ltp * volume);

        return {
            symbol: stock.symbol,
            companyName: stock.name,
            sector: stock.sector,
            prices: {
                ltp: ltp,
                open: Math.round(open * 100) / 100,
                high: Math.round(high * 100) / 100,
                low: Math.round(low * 100) / 100,
                previousClose: previousClose,
                change: change,
                changePercent: changePercent
            },
            lastTradedPrice: ltp,
            previousClose: previousClose,
            percentageChange: changePercent,
            change: change,
            trading: {
                volume: volume,
                turnover: turnover,
                totalTrades: Math.floor(Math.random() * 500) + 10
            },
            fiftyTwoWeek: {
                high: Math.round(basePrice * 1.3 * 100) / 100,
                low: Math.round(basePrice * 0.7 * 100) / 100
            },
            lastUpdated: now.toISOString()
        };
    });

    // Calculate market summary from generated stocks
    const gainers = stocks.filter(s => s.prices.change > 0).length;
    const losers = stocks.filter(s => s.prices.change < 0).length;
    const unchanged = stocks.filter(s => s.prices.change === 0).length;
    const totalTurnover = stocks.reduce((sum, s) => sum + s.trading.turnover, 0);
    const totalVolume = stocks.reduce((sum, s) => sum + s.trading.volume, 0);
    const totalTrades = stocks.reduce((sum, s) => sum + s.trading.totalTrades, 0);

    const baseIndex = 2200;
    const indexChange = (Math.random() - 0.5) * 40;
    const indexValue = Math.round((baseIndex + indexChange) * 100) / 100;
    const indexChangePercent = Math.round((indexChange / baseIndex) * 10000) / 100;

    const marketSummary = {
        indexValue: indexValue,
        indexChange: Math.round(indexChange * 100) / 100,
        indexChangePercent: indexChangePercent,
        totalTransactions: totalTrades,
        totalTurnover: totalTurnover,
        totalVolume: totalVolume,
        activeCompanies: stocks.length,
        advancedCompanies: gainers,
        declinedCompanies: losers,
        unchangedCompanies: unchanged,
        timestamp: now.toISOString()
    };

    return {
        stocks,
        ipos: [],
        marketSummary,
        source: 'simulated',
        timestamp: now.toISOString()
    };
};

module.exports = {
    fetchData
};