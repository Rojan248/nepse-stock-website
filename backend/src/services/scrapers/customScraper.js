const axios = require('axios');
const logger = require('../utils/logger');
const NEPSE_STOCKS = require('../../data/nepseStocks');

/**
 * Custom NEPSE Scraper - Real-time Data Fetching
 * Implements direct NEPSE API access with authentication
 * Falls back to simulated data only when all real sources fail
 */

const NEPSE_BASE_URL = 'https://nepalstock.com.np';
const TIMEOUT = 20000;

// Create axios instance for NEPSE
const nepseClient = axios.create({
    baseURL: NEPSE_BASE_URL,
    timeout: TIMEOUT,
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://nepalstock.com.np/',
        'Origin': 'https://nepalstock.com.np'
    }
});

/**
 * Fetch data using custom scraper
 * Tries real NEPSE API first, then alternative sources, finally simulated data
 * @returns {Object} Data object (always returns data)
 */
const fetchData = async () => {
    logger.info('Custom scraper starting...');

    // Strategy 1: Try direct NEPSE API with token
    try {
        const nepseData = await fetchFromNEPSEDirect();
        if (nepseData && nepseData.stocks && nepseData.stocks.length > 0) {
            logger.info(`✓ Custom scraper got ${nepseData.stocks.length} stocks from NEPSE direct`);
            return nepseData;
        }
    } catch (error) {
        logger.debug(`NEPSE direct failed: ${error.message}`);
    }

    // Strategy 2: Try NEPSE API without auth (public endpoints)
    try {
        const publicData = await fetchFromNEPSEPublic();
        if (publicData && publicData.stocks && publicData.stocks.length > 0) {
            logger.info(`✓ Custom scraper got ${publicData.stocks.length} stocks from NEPSE public API`);
            return publicData;
        }
    } catch (error) {
        logger.debug(`NEPSE public API failed: ${error.message}`);
    }

    // Strategy 3: Try alternative sources (MeroLagani, etc.)
    try {
        const altData = await fetchFromAlternativeSources();
        if (altData && altData.stocks && altData.stocks.length > 0) {
            logger.info(`✓ Custom scraper got ${altData.stocks.length} stocks from alternative source`);
            return altData;
        }
    } catch (error) {
        logger.debug(`Alternative sources failed: ${error.message}`);
    }

    // Strategy 4: Fallback to simulated data
    logger.info('All real sources failed - using simulated data fallback...');
    const simulatedData = generateSimulatedData();
    logger.info(`✓ Generated simulated data for ${simulatedData.stocks.length} stocks`);
    return simulatedData;
};

/**
 * Fetch directly from NEPSE API with authentication
 */
const fetchFromNEPSEDirect = async () => {
    try {
        // Step 1: Get authentication token
        const token = await getNEPSEToken();
        if (!token) {
            logger.debug('Could not obtain NEPSE token');
            return null;
        }

        // Step 2: Fetch today's prices with auth
        const response = await nepseClient.get('/api/nots/nepse-data/today-price', {
            headers: {
                'Authorization': `Salter ${token}`
            }
        });

        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
            const stocks = response.data.map(transformNEPSEStock);
            
            // Also fetch market summary
            const marketSummary = await fetchNEPSEMarketSummary(token);

            return {
                stocks,
                ipos: [],
                marketSummary,
                source: 'nepse-direct',
                timestamp: new Date().toISOString()
            };
        }
    } catch (error) {
        logger.debug(`NEPSE direct fetch error: ${error.message}`);
    }
    return null;
};

/**
 * Get NEPSE authentication token
 */
const getNEPSEToken = async () => {
    try {
        // Get the prove token
        const proveResponse = await nepseClient.get('/api/authenticate/prove');
        const proveData = proveResponse.data;
        
        if (proveData) {
            // NEPSE uses a specific algorithm to generate access token from prove
            // For now, try using the prove token directly or a simplified approach
            const accessResponse = await nepseClient.post('/api/authenticate/accesstoken', {
                accessToken: proveData
            });
            
            if (accessResponse.data && accessResponse.data.accessToken) {
                return accessResponse.data.accessToken;
            }
        }
    } catch (error) {
        logger.debug(`Token generation failed: ${error.message}`);
    }
    return null;
};

/**
 * Fetch NEPSE market summary
 */
const fetchNEPSEMarketSummary = async (token) => {
    try {
        const headers = token ? { 'Authorization': `Salter ${token}` } : {};
        const response = await nepseClient.get('/api/nots', { headers });

        if (response.data) {
            const data = response.data;
            return {
                indexValue: parseFloat(data.index) || parseFloat(data.nepseIndex) || 0,
                indexChange: parseFloat(data.change) || parseFloat(data.pointChange) || 0,
                indexChangePercent: parseFloat(data.perChange) || parseFloat(data.percentChange) || 0,
                totalTransactions: parseInt(data.totalTransactions) || 0,
                totalTurnover: parseFloat(data.totalTurnover) || 0,
                totalVolume: parseInt(data.totalVolume) || 0,
                activeCompanies: parseInt(data.tradedScrip) || 0,
                advancedCompanies: parseInt(data.positive) || 0,
                declinedCompanies: parseInt(data.negative) || 0,
                unchangedCompanies: parseInt(data.neutral) || 0,
                timestamp: new Date().toISOString()
            };
        }
    } catch (error) {
        logger.debug(`Market summary fetch failed: ${error.message}`);
    }
    return null;
};

/**
 * Fetch from NEPSE public endpoints (no auth required)
 */
const fetchFromNEPSEPublic = async () => {
    const endpoints = [
        '/api/nots/nepse-data/today-price',
        '/api/nots/security',
        '/api/nots/securityDailyTradeStat'
    ];

    for (const endpoint of endpoints) {
        try {
            const response = await nepseClient.get(endpoint);
            
            if (response.data) {
                let data = response.data;
                if (data.data) data = data.data;
                if (data.content) data = data.content;

                if (Array.isArray(data) && data.length > 0) {
                    const stocks = data.map(transformNEPSEStock);
                    return {
                        stocks,
                        ipos: [],
                        marketSummary: null,
                        source: 'nepse-public',
                        timestamp: new Date().toISOString()
                    };
                }
            }
        } catch (error) {
            logger.debug(`NEPSE endpoint ${endpoint} failed: ${error.message}`);
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
 * Fetch from alternative data sources
 */
const fetchFromAlternativeSources = async () => {
    // Try MeroLagani
    try {
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
                    totalTrades: 0
                },
                lastUpdated: new Date().toISOString()
            }));

            if (stocks.length > 0) {
                return {
                    stocks,
                    ipos: [],
                    marketSummary: null,
                    source: 'merolagani',
                    timestamp: new Date().toISOString()
                };
            }
        }
    } catch (error) {
        logger.debug(`MeroLagani fetch failed: ${error.message}`);
    }

    return null;
};

/**
 * Reference implementation for NEPSE authentication (not active)
 * This is documentation for future implementation
 */
const authenticateWithNEPSE = async () => {
    try {
        // Step 1: Get prove token
        const proveResponse = await axios.get(`${NEPSE_BASE_URL}/api/authenticate/prove`, {
            timeout: TIMEOUT,
            headers: {
                'Accept': 'application/json'
            }
        });

        const proveToken = proveResponse.data;

        // Step 2: Generate access token
        // Note: NEPSE uses a custom token generation algorithm
        // This would need reverse engineering of their JavaScript
        const accessToken = generateAccessToken(proveToken);

        return accessToken;
    } catch (error) {
        logger.error(`NEPSE authentication failed: ${error.message}`);
        return null;
    }
};

/**
 * Token generation placeholder
 * Real implementation would need NEPSE's algorithm
 */
const generateAccessToken = (proveToken) => {
    // This is where NEPSE's token algorithm would go
    // It typically involves:
    // - Decoding the prove token
    // - Applying mathematical transformations
    // - Generating the final access token

    logger.debug('Token generation not implemented');
    return null;
};

/**
 * Reference function for fetching securities (not active)
 */
const fetchSecuritiesFromNEPSE = async (accessToken) => {
    try {
        const response = await axios.get(`${NEPSE_BASE_URL}/api/nots/security`, {
            timeout: TIMEOUT,
            headers: {
                'Authorization': `Salter ${accessToken}`,
                'Accept': 'application/json'
            }
        });

        return response.data;
    } catch (error) {
        logger.error(`Failed to fetch securities: ${error.message}`);
        return null;
    }
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
    logger.info('Generating simulated market data from static stock list...');
    
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

    // Generate realistic NEPSE index (around 2000-2500)
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
