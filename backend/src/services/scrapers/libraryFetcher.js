const https = require('https');
const logger = require('../utils/logger');

/**
 * Library-based NEPSE Data Fetcher
 * Uses nepse-api-helper package for real-time NEPSE data
 * 
 * This package handles:
 * - NEPSE's complex token/authentication logic
 * - Automatic caching and retry
 * - WASM fallback for token generation
 */

let nepseClient = null;
let nepseAxios = null;
let createHeaders = null;
let BASE_URL = null;
let isInitialized = false;

// Custom HTTPS agent for NEPSE requests only
// NOTE: NEPSE's SSL certificate sometimes has validation issues.
// This agent disables SSL verification ONLY for NEPSE API calls, not globally.
// TODO: Add NEPSE's certificate to trusted certs instead of disabling verification.
const nepseHttpsAgent = new https.Agent({
    rejectUnauthorized: false
});

// Sector ID mapping from NEPSE API
const SECTOR_IDS = {
    58: 'NEPSE Index',
    57: 'Sensitive Index',
    51: 'Commercial Banks',
    52: 'Hotels And Tourism',
    53: 'Others',
    54: 'Hydro Power',
    55: 'Development Banks',
    56: 'Manufacturing And Processing',
    59: 'Non Life Insurance',
    60: 'Finance',
    61: 'Trading',
    64: 'Microfinance',
    65: 'Life Insurance',
    66: 'Mutual Fund',
    67: 'Investment'
};

// All sector IDs to fetch (58 = NEPSE Index contains all stocks)
const ALL_SECTORS = [58];

/**
 * Initialize the NEPSE library
 */
const initializeLibrary = async () => {
    try {
        // Import the nepse-api-helper package
        const nepseModule = await import('nepse-api-helper');
        nepseClient = nepseModule.nepseClient;
        nepseAxios = nepseModule.nepseAxios;
        createHeaders = nepseModule.createHeaders;
        BASE_URL = nepseModule.BASE_URL;

        // Create a custom logger adapter
        const customLogger = {
            info: (msg, ...args) => logger.debug(`[NEPSE-API] ${msg}`, ...args),
            warn: (msg, ...args) => logger.warn(`[NEPSE-API] ${msg}`, ...args),
            error: (msg, ...args) => logger.error(`[NEPSE-API] ${msg}`, ...args)
        };

        // Initialize with WASM mode for best compatibility
        await nepseClient.initialize({
            useWasm: true,
            logger: customLogger
        });

        isInitialized = true;
        logger.info('✓ NEPSE API Helper library initialized successfully (WASM mode)');
        return true;

    } catch (error) {
        logger.warn(`Failed to initialize nepse-api-helper: ${error.message}`);

        // Try TypeScript mode as fallback
        try {
            const nepseModule = await import('nepse-api-helper');
            nepseClient = nepseModule.nepseClient;
            nepseAxios = nepseModule.nepseAxios;
            createHeaders = nepseModule.createHeaders;
            BASE_URL = nepseModule.BASE_URL;

            await nepseClient.initialize({ useWasm: false });
            isInitialized = true;
            logger.info('✓ NEPSE API Helper library initialized (TypeScript mode)');
            return true;
        } catch (fallbackError) {
            logger.error(`Library initialization failed completely: ${fallbackError.message}`);
            return false;
        }
    }
};

/**
 * Fetch all stock data using the library
 * @returns {Object|null} Standardized data object or null on failure
 */
const fetchData = async () => {
    try {
        // Initialize if not already done
        if (!isInitialized) {
            const initialized = await initializeLibrary();
            if (!initialized) {
                logger.debug('Library not available, returning null');
                return null;
            }
        }

        logger.info('Fetching data using NEPSE API Helper library...');

        // Get authentication token
        const token = await nepseClient.getToken();

        // Fetch securities with price data and market status in parallel
        const [securities, marketSummary, topGainers, topLosers] = await Promise.all([
            fetchSecuritiesWithPrices(token),
            fetchMarketSummary(token),
            fetchTopMovers(token, 'gainer'),
            fetchTopMovers(token, 'loser')
        ]);

        if (!securities || securities.length === 0) {
            logger.warn('Library fetcher: No securities data received');
            return null;
        }

        // Note: isTopGainer/isTopLoser flags are NOT set here because:
        // 1. The NEPSE API top-ten endpoints return stocks by turnover/trades, not by price change
        // 2. These flags should be computed dynamically based on changePercent at query time
        // 3. The stockOps.getTopGainers() and stockOps.getTopLosers() functions compute this correctly

        const result = {
            stocks: securities,
            ipos: [],
            marketSummary,
            topGainers,
            topLosers,
            source: 'nepse-api-helper',
            timestamp: new Date().toISOString()
        };

        logger.info(`✓ Library fetcher: Retrieved ${result.stocks.length} stocks from NEPSE`);
        return result;

    } catch (error) {
        logger.error(`Library fetcher error: ${error.message}`);
        // Reset initialization state to allow retry
        isInitialized = false;
        return null;
    }
};

/**
 * Fetch all securities with price data from NEPSE
 */
const fetchSecuritiesWithPrices = async (token) => {
    try {
        const headers = createHeaders(token);

        // Fetch from the securityDailyTradeStat endpoint (58 = NEPSE Index = all stocks)
        const response = await nepseAxios.get(`${BASE_URL}/api/nots/securityDailyTradeStat/58`, {
            headers,
            httpsAgent: nepseHttpsAgent
        });

        if (!response.data || !Array.isArray(response.data)) {
            logger.warn('No price data from securityDailyTradeStat');
            return null;
        }

        logger.debug(`Fetched ${response.data.length} securities with prices`);

        // Transform to our standard format
        return response.data.map(security => transformSecurity(security)).filter(s => s !== null);

    } catch (error) {
        logger.error(`Error fetching securities with prices: ${error.message}`);
        return null;
    }
};

/**
 * Sanitize symbol for storage key (remove special characters)
 */
const sanitizeSymbol = (symbol) => {
    if (!symbol) return '';
    return symbol.replace(/[\/\\\.#$\[\]]/g, '_');
};

/**
 * Check if market is currently open (Nepal time)
 * Market hours: 10:00 AM - 3:00 PM NST, Sunday to Thursday
 */
const { isMarketActive } = require('../utils/marketTime');

// ... (other imports)

// Use centralized market time utility instead of local calculation
const isMarketOpen = () => {
    return isMarketActive();
};

/**
 * Transform NEPSE security data to standard format
 */
const transformSecurity = (security, marketOpen = null) => {
    if (!security) return null;

    if (security.symbol === 'AKPL' || security.symbol === 'AIG') {
        logger.info(`[DEBUG] Raw ${security.symbol}: ${JSON.stringify(security)}`);
    }

    const rawSymbol = security.symbol || '';
    const symbol = sanitizeSymbol(rawSymbol);
    if (!symbol) return null;

    const prevClose = parseFloat(security.previousClose) || 0;
    let ltp = parseFloat(security.lastTradedPrice) || parseFloat(security.closePrice) || 0;

    // If no trade has happened (LTP is 0), use previous close as the current price
    // This prevents showing "Rs 0.00" for untraded stocks
    if (ltp === 0 && prevClose > 0) {
        ltp = prevClose;
    }

    const open = parseFloat(security.openPrice) || ltp;

    // Calculate both types of change
    const intradayChange = ltp - open;
    const intradayChangePercent = open > 0 ? (intradayChange / open) * 100 : 0;

    const overnightChange = ltp - prevClose;
    const overnightChangePercent = prevClose > 0 ? (overnightChange / prevClose) * 100 : 0;

    // Determine market status if not provided
    const isOpen = marketOpen !== null ? marketOpen : isMarketOpen();

    // When market is OPEN: show intraday change (from today's open)
    // When market is CLOSED: show overnight change (from previous close)
    const displayChange = isOpen ? intradayChange : overnightChange;
    const displayChangePercent = isOpen ? intradayChangePercent : overnightChangePercent;

    // Map sector from indexId
    const sectorId = security.indexId || 53;
    const sector = SECTOR_IDS[sectorId] || 'Others';

    // Get volume and calculate turnover if not provided
    const volume = parseInt(security.totalTradeQuantity) || parseInt(security.totalTradedQuantity) || 0;
    let turnover = parseFloat(security.totalTradedValue) || parseFloat(security.turnover) || 0;

    // Calculate turnover from LTP * Volume if not available
    if (turnover === 0 && volume > 0 && ltp > 0) {
        turnover = ltp * volume;
    }

    // Get total trades - use noOfTrades if available
    const totalTrades = parseInt(security.noOfTrades) || parseInt(security.totalTrades) || 0;

    return {
        symbol,
        originalSymbol: rawSymbol,
        companyName: security.securityName || security.name || rawSymbol,
        sector,
        sectorId,
        // Flat price fields for easy access
        ltp,
        open,
        high: parseFloat(security.highPrice) || ltp,
        low: parseFloat(security.lowPrice) || ltp,
        close: parseFloat(security.closePrice) || ltp,
        previousClose: prevClose,
        // PRIMARY: Display change based on market status
        // Market OPEN = intraday (from open), Market CLOSED = overnight (from prev close)
        change: Math.round(displayChange * 100) / 100,
        changePercent: Math.round(displayChangePercent * 100) / 100,
        // Keep both for reference
        intradayChange: Math.round(intradayChange * 100) / 100,
        intradayChangePercent: Math.round(intradayChangePercent * 100) / 100,
        overnightChange: Math.round(overnightChange * 100) / 100,
        overnightChangePercent: Math.round(overnightChangePercent * 100) / 100,
        isMarketOpen: isOpen,
        volume,
        turnover: Math.round(turnover * 100) / 100,
        totalTrades,
        // Nested for compatibility
        prices: {
            ltp,
            open,
            high: parseFloat(security.highPrice) || ltp,
            low: parseFloat(security.lowPrice) || ltp,
            previousClose: prevClose,
            change: Math.round(displayChange * 100) / 100,
            changePercent: Math.round(displayChangePercent * 100) / 100,
            intradayChange: Math.round(intradayChange * 100) / 100,
            intradayChangePercent: Math.round(intradayChangePercent * 100) / 100,
            overnightChange: Math.round(overnightChange * 100) / 100,
            overnightChangePercent: Math.round(overnightChangePercent * 100) / 100
        },
        trading: {
            volume,
            turnover: Math.round(turnover * 100) / 100,
            totalTrades
        },
        fiftyTwoWeek: {
            high: parseFloat(security.fiftyTwoWeekHigh) || 0,
            low: parseFloat(security.fiftyTwoWeekLow) || 0
        },
        lastUpdated: new Date().toISOString()
    };
};

/**
 * Fetch market summary/index data from NEPSE
 */
const fetchMarketSummary = async (token) => {
    try {
        const headers = createHeaders(token);

        // Fetch both index data and market summary in parallel
        const [indexResponse, summaryResponse] = await Promise.all([
            nepseAxios.get(`${BASE_URL}/api/nots/nepse-index`, { headers, httpsAgent: nepseHttpsAgent }),
            nepseAxios.get(`${BASE_URL}/api/nots/market-summary`, { headers, httpsAgent: nepseHttpsAgent }).catch(() => null)
        ]);

        if (!indexResponse.data || !Array.isArray(indexResponse.data)) {
            return null;
        }

        // Find the main NEPSE index (id: 58)
        const nepseIndex = indexResponse.data.find(idx => idx.id === 58);

        if (!nepseIndex) {
            return null;
        }

        // Parse market summary data (turnover, transactions, volume)
        let totalTurnover = 0;
        let totalTransactions = 0;
        let totalVolume = 0;
        let totalScripsTraded = 0;
        let totalMarketCap = 0;

        if (summaryResponse?.data && Array.isArray(summaryResponse.data)) {
            summaryResponse.data.forEach(item => {
                const detail = (item.detail || '').toLowerCase();
                const value = parseFloat(item.value) || 0;

                if (detail.includes('turnover')) {
                    totalTurnover = value;
                } else if (detail.includes('transaction')) {
                    totalTransactions = Math.round(value);
                } else if (detail.includes('traded shares')) {
                    totalVolume = Math.round(value);
                } else if (detail.includes('scrips traded')) {
                    totalScripsTraded = Math.round(value);
                } else if (detail.includes('market capitalization') && !detail.includes('float')) {
                    totalMarketCap = value;
                }
            });
        }

        // Use reliable local calculation for market status
        const isOpen = isMarketActive();
        const state = require('../utils/marketTime').getMarketState();

        // Count gainers/losers from all indices
        const allIndices = indexResponse.data;
        const advancedCompanies = allIndices.filter(i => i.change > 0).length;
        const declinedCompanies = allIndices.filter(i => i.change < 0).length;
        const unchangedCompanies = allIndices.filter(i => i.change === 0).length;

        return {
            isOpen,
            state,
            indexValue: parseFloat(nepseIndex.currentValue) || parseFloat(nepseIndex.close) || 0,
            indexChange: parseFloat(nepseIndex.change) || 0,
            indexChangePercent: parseFloat(nepseIndex.perChange) || 0,
            high: parseFloat(nepseIndex.high) || 0,
            low: parseFloat(nepseIndex.low) || 0,
            previousClose: parseFloat(nepseIndex.previousClose) || 0,
            fiftyTwoWeekHigh: parseFloat(nepseIndex.fiftyTwoWeekHigh) || 0,
            fiftyTwoWeekLow: parseFloat(nepseIndex.fiftyTwoWeekLow) || 0,
            // Real values from market summary
            totalTransactions,
            totalTurnover,
            totalVolume,
            totalMarketCap,
            activeCompanies: totalScripsTraded,
            advancedCompanies,
            declinedCompanies,
            unchangedCompanies,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        logger.error(`Error fetching market summary: ${error.message}`);
        return null;
    }
};

/**
 * Fetch top gainers or losers
 */
const fetchTopMovers = async (token, type) => {
    try {
        const headers = createHeaders(token);
        const endpoint = type === 'gainer'
            ? '/api/nots/top-ten/turnover'  // Top by turnover as gainer/loser endpoints 404
            : '/api/nots/top-ten/trade';     // Top by trades

        const response = await nepseAxios.get(`${BASE_URL}${endpoint}`, {
            headers,
            httpsAgent: nepseHttpsAgent
        });

        if (!response.data || !Array.isArray(response.data)) {
            return [];
        }

        return response.data.map(item => ({
            symbol: item.symbol,
            companyName: item.securityName,
            ltp: parseFloat(item.closingPrice) || parseFloat(item.lastTradedPrice) || 0,
            turnover: parseFloat(item.turnover) || 0,
            volume: parseInt(item.shareTraded) || 0
        }));

    } catch (error) {
        logger.debug(`Error fetching top ${type}: ${error.message}`);
        return [];
    }
};

module.exports = {
    fetchData,
    initializeLibrary
};
