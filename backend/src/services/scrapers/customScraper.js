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

/**
 * Main Fetch Function
 */
const fetchData = async () => {
    logger.info('Custom scraper (fallback) starting...');

    // Strategy 1: NEPSE Public Endpoints
    try {
        const publicData = await fetchFromNEPSEPublic();
        if (publicData && publicData.stocks && publicData.stocks.length > 0) {
            logger.info(`✓ Custom scraper: Got ${publicData.stocks.length} stocks from NEPSE public API`);
            return publicData;
        }
    } catch (error) {
        logger.debug(`Custom scraper: NEPSE public API failed: ${error.message}`);
    }

    // Strategy 2: Alternative Sources (Merolagani)
    try {
        const altData = await fetchFromAlternativeSources();
        if (altData && altData.stocks && altData.stocks.length > 0) {
            logger.info(`✓ Custom scraper: Got ${altData.stocks.length} stocks from Alternative Source`);
            return altData;
        }
    } catch (error) {
        logger.debug(`Custom scraper: Alternative sources failed: ${error.message}`);
    }

    // Strategy 3: Simulated Data (Last Resort)
    logger.warn('Custom scraper: All real sources failed. Using simulated data.');
    const simulatedData = generateSimulatedData();
    return simulatedData;
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
                const stocks = data.map(transformNEPSEStock);
                return {
                    stocks,
                    ipos: [],
                    marketSummary: null, // Will be calculated by dataFetcher
                    source: 'nepse-public-fallback',
                    timestamp: new Date().toISOString()
                };
            }
        } catch (error) {
            // Ssh, it's a fallback
        }
    }
    return null;
};

/**
 * Transform NEPSE API stock data to standard format
 */
const transformNEPSEStock = (item) => {
    const symbol = item.symbol || item.securitySymbol || item.scrip || '';
    const ltp = parseFloat(item.lastTradedPrice) || parseFloat(item.closePrice) || parseFloat(item.ltp) || 0;
    const prevClose = parseFloat(item.previousClose) || parseFloat(item.previousDayClosePrice) || 0;
    const change = parseFloat(item.pointChange) || (ltp - prevClose) || 0;
    const changePercent = parseFloat(item.percentageChange) || (prevClose ? (change / prevClose * 100) : 0);

    return {
        symbol,
        companyName: item.securityName || item.companyName || item.name || symbol,
        sector: item.sectorName || item.sector || item.instrumentType || 'Others',
        prices: {
            ltp,
            open: parseFloat(item.openPrice) || parseFloat(item.open) || 0,
            high: parseFloat(item.highPrice) || parseFloat(item.high) || 0,
            low: parseFloat(item.lowPrice) || parseFloat(item.low) || 0,
            previousClose: prevClose,
            change: Math.round(change * 100) / 100,
            changePercent: Math.round(changePercent * 100) / 100
        },
        trading: {
            volume: parseInt(item.totalTradedQuantity) || parseInt(item.volume) || 0,
            turnover: parseFloat(item.totalTradedValue) || parseFloat(item.turnover) || 0,
            totalTrades: parseInt(item.totalTrades) || parseInt(item.noOfTransactions) || 0
        },
        fiftyTwoWeek: {
            high: parseFloat(item.fiftyTwoWeekHigh) || 0,
            low: parseFloat(item.fiftyTwoWeekLow) || 0
        },
        lastUpdated: new Date().toISOString()
    };
};

/**
 * Fetch from alternative data sources (Merolagani)
 */
const fetchFromAlternativeSources = async () => {
    try {
        // Merolagani Handler
        const response = await axios.get('https://merolagani.com/handlers/weaboradataaborahandler.ashx', {
            params: { type: 'get_live_market' },
            timeout: TIMEOUT,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (response.data && Array.isArray(response.data)) {
            const stocks = response.data.map(item => ({
                symbol: item.s || item.symbol || '',
                companyName: item.n || item.name || '',
                sector: item.sector || 'Others',
                prices: {
                    ltp: parseFloat(item.l) || parseFloat(item.ltp) || 0,
                    open: parseFloat(item.o) || 0,
                    high: parseFloat(item.h) || 0,
                    low: parseFloat(item.lo) || 0,
                    previousClose: parseFloat(item.pc) || 0,
                    change: parseFloat(item.c) || 0,
                    changePercent: parseFloat(item.cp) || 0
                },
                trading: {
                    volume: parseInt(item.v) || 0,
                    turnover: parseFloat(item.t) || 0,
                    totalTrades: 0 // Merolagani simple feed doesn't have trades count
                },
                lastUpdated: new Date().toISOString()
            }));

            if (stocks.length > 0) {
                return {
                    stocks,
                    ipos: [],
                    marketSummary: null,
                    source: 'merolagani-fallback',
                    timestamp: new Date().toISOString()
                };
            }
        }
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