const axios = require('axios');
const logger = require('../utils/logger');
const https = require('https');
const http = require('http');

/**
 * Custom NEPSE Scraper - Tier 3 Fallback
 * 
 * STRATEGY:
 * 1. Try NEPSE's public API endpoints (Today's Price) with browser headers.
 * 2. Try Merolagani JSON API.
 * 3. Last Resort: Merolagani DOM Scraper (HTML parsing).
 * 
 * Removed: Simulation/Mock logic. This file now only provides REAL data.
 */

const NEPSE_BASE_URL = 'https://nepalstock.com.np';
const TIMEOUT = 8000;

// Browser-like headers to bypass basic WAF checks
const BROWSER_HEADERS = {
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Connection': 'keep-alive',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://nepalstock.com.np/',
    'Origin': 'https://nepalstock.com.np'
};

const nepseClient = axios.create({
    baseURL: NEPSE_BASE_URL,
    timeout: TIMEOUT,
    httpAgent: new http.Agent({ keepAlive: true }),
    httpsAgent: new https.Agent({ keepAlive: true }),
    headers: BROWSER_HEADERS
});

// ==================== Shared Helpers ====================

const resolveFloat = (obj, fields) => {
    for (const f of fields) {
        const v = parseFloat(obj[f]);
        if (!isNaN(v) && v !== 0) return v;
    }
    return 0;
};

const resolveInt = (obj, fields) => {
    for (const f of fields) {
        let v = obj[f];
        if (typeof v === 'string') v = v.replace(/,/g, '');
        const n = parseInt(v, 10);
        if (!isNaN(n) && n !== 0) return n;
    }
    return 0;
};

const resolveStr = (obj, fields, fallback = '') => {
    for (const f of fields) {
        if (obj[f]) return obj[f].toString().trim();
    }
    return fallback;
};

const hasValidStockData = (result) =>
    result && result.stocks && result.stocks.length > 0;

/**
 * Main Fetch Function
 */
const fetchData = async () => {
    logger.info('Custom scraper (Tier 3) starting...');

    // Strategy 1: NEPSE Public Endpoints
    try {
        const publicData = await fetchFromNEPSEPublic();
        if (hasValidStockData(publicData)) {
            return publicData;
        }
    } catch (error) {
        logger.debug(`Custom scraper: NEPSE public API failed: ${error.message}`);
    }

    // Strategy 2: Merolagani API
    try {
        const altData = await fetchFromMerolaganiAPI();
        if (hasValidStockData(altData)) {
            return altData;
        }
    } catch (error) {
        logger.debug(`Custom scraper: Merolagani API failed: ${error.message}`);
    }

    // Strategy 3 (DOM Scraping) has been retired from the MVP completely.

    logger.warn('Custom scraper: All Tier 3 sources failed.');
    return null;
};

/**
 * Fetch from NEPSE public endpoints
 */
const fetchFromNEPSEPublic = async () => {
    const endpoint = '/api/nots/nepse-data/today-price';
    try {
        const response = await nepseClient.get(endpoint);
        let data = response.data;
        if (data.data) data = data.data;
        if (data.content) data = data.content;

        if (Array.isArray(data) && data.length > 0) {
            logger.info(`✓ Custom scraper: Got ${data.length} stocks from NEPSE public API`);
            return {
                stocks: data.map(transformNEPSEStock),
                source: 'nepse-public',
                timestamp: new Date().toISOString()
            };
        }
    } catch (error) {
        throw error;
    }
    return null;
};

const transformNEPSEStock = (item) => {
    const ltp = resolveFloat(item, ['lastTradedPrice', 'closePrice', 'ltp']);
    const prevClose = resolveFloat(item, ['previousClose', 'previousDayClosePrice']);
    const change = parseFloat(item.pointChange) || (ltp - prevClose) || 0;
    const cp = parseFloat(item.percentageChange) || (prevClose ? (change / prevClose * 100) : 0);

    return {
        symbol: resolveStr(item, ['symbol', 'securitySymbol']),
        companyName: resolveStr(item, ['securityName', 'companyName'], 'Unknown'),
        lastTradedPrice: ltp,
        previousClose: prevClose,
        change: Math.round(change * 100) / 100,
        percentageChange: Math.round(cp * 100) / 100,
        volume: resolveInt(item, ['totalTradedQuantity', 'volume']),
        turnover: resolveFloat(item, ['totalTradedValue', 'turnover']),
        lastUpdated: new Date().toISOString()
    };
};

/**
 * Fetch from Merolagani JSON API
 */
const fetchFromMerolaganiAPI = async () => {
    const url = 'https://merolagani.com/handlers/weaboradataaborahandler.ashx?type=get_live_market';
    const response = await axios.get(url, { timeout: TIMEOUT });

    if (Array.isArray(response.data) && response.data.length > 0) {
        logger.info(`✓ Custom scraper: Got ${response.data.length} stocks from Merolagani API`);
        return {
            stocks: response.data.map(transformMerolaganiAPIStock),
            source: 'merolagani-api',
            timestamp: new Date().toISOString()
        };
    }
    return null;
};

const transformMerolaganiAPIStock = (item) => ({
    symbol: resolveStr(item, ['s', 'symbol']),
    companyName: resolveStr(item, ['n', 'name']),
    lastTradedPrice: resolveFloat(item, ['l', 'ltp']),
    previousClose: resolveFloat(item, ['pc']),
    change: resolveFloat(item, ['c']),
    percentageChange: resolveFloat(item, ['cp']),
    volume: resolveInt(item, ['v']),
    turnover: resolveFloat(item, ['t']),
    lastUpdated: new Date().toISOString()
});

module.exports = {
    fetchData
};