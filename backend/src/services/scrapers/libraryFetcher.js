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

        const token = await nepseClient.getToken();

        // Fetch all base data in parallel
        const [securities, marketSummary] = await Promise.all([
            fetchSecuritiesWithPrices(token),
            fetchMarketSummary(token)
        ]);

        if (!securities || securities.length === 0) {
            logger.warn('Library fetcher: No securities data received');
            return null;
        }

        // Compute rankings from the full securities list (more robust than individual endpoints)
        const sortedByTurnover = [...securities].sort((a, b) => b.turnover - a.turnover).slice(0, 50);
        const sortedByTrades = [...securities].sort((a, b) => b.totalTrades - a.totalTrades).slice(0, 50);
        const sortedByVolume = [...securities].sort((a, b) => b.volume - a.volume).slice(0, 50);
        const sortedByGains = [...securities]
            .filter(s => s.volume > 0) // Only include traded stocks for gainers/losers
            .sort((a, b) => b.changePercent - a.changePercent)
            .slice(0, 50);
        const sortedByLoss = [...securities]
            .filter(s => s.volume > 0)
            .sort((a, b) => a.changePercent - b.changePercent)
            .slice(0, 50);

        const result = {
            stocks: securities,
            ipos: [],
            marketSummary,
            topTurnover: sortedByTurnover,
            topTrades: sortedByTrades,
            topVolume: sortedByVolume,
            topGainers: sortedByGains,
            topLosers: sortedByLoss,
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
        const sectorIds = Object.keys(SECTOR_IDS).map(id => parseInt(id));

        // Fetch from multiple index endpoints to ensure full coverage
        // Index 58 is usually enough, but others can contain different securities
        const fetchPromises = sectorIds.map(id =>
            nepseAxios.get(`${BASE_URL}/api/nots/securityDailyTradeStat/${id}`, {
                headers,
                httpsAgent: nepseHttpsAgent
            }).catch(err => {
                logger.debug(`Error fetching index ${id}: ${err.message}`);
                return { data: [] };
            })
        );

        const responses = await Promise.all(fetchPromises);

        // Merge all securities, removing duplicates by symbol
        const allSecuritiesMap = new Map();

        responses.forEach(response => {
            if (response.data && Array.isArray(response.data)) {
                response.data.forEach(security => {
                    const symbol = security.symbol;
                    if (symbol && !allSecuritiesMap.has(symbol)) {
                        allSecuritiesMap.set(symbol, security);
                    }
                });
            }
        });

        const mergedSecurities = Array.from(allSecuritiesMap.values());
        logger.debug(`Fetched and merged ${mergedSecurities.length} unique securities from ${sectorIds.length} indices`);

        // Transform to our standard format
        return mergedSecurities.map(security => transformSecurity(security)).filter(s => s !== null);

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

    // Get total trades
    const totalTrades = parseInt(security.noOfTrades) || parseInt(security.totalTrades) || 0;

    // Extended Metrics: Supply/Demand
    const buyVolume = parseInt(security.totalBuyQuantity) || 0;
    const sellVolume = parseInt(security.totalSellQuantity) || 0;
    const buySellRatio = sellVolume > 0 ? buyVolume / sellVolume : 0;

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
        change: Math.round(displayChange * 100) / 100,
        changePercent: Math.round(displayChangePercent * 100) / 100,
        intradayChange: Math.round(intradayChange * 100) / 100,
        intradayChangePercent: Math.round(intradayChangePercent * 100) / 100,
        overnightChange: Math.round(overnightChange * 100) / 100,
        overnightChangePercent: Math.round(overnightChangePercent * 100) / 100,
        isMarketOpen: isOpen,
        volume,
        turnover: Math.round(turnover * 100) / 100,
        totalTrades,
        // Extended Metrics
        supplyDemand: {
            buyVolume,
            sellVolume,
            ratio: Math.round(buySellRatio * 100) / 100
        },
        fiftyTwoWeek: {
            high: parseFloat(security.fiftyTwoWeekHigh) || 0,
            low: parseFloat(security.fiftyTwoWeekLow) || 0
        },
        lastUpdated: new Date().toISOString()
    };
};

/**
 * Fetch market summary and all indices from NEPSE
 */
const fetchMarketSummary = async (token) => {
    try {
        const headers = createHeaders(token);

        // All known Index IDs from NEPSE
        const allIndexIds = [51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67];
        const today = new Date().toISOString().split('T')[0];

        // Fetch index data and market summary
        // We fetch indices in broad groups/individually if needed to ensure all 17 are covered
        // Most sub-indices are available via /api/nots/datewise-indices
        const [bulkIndicesRes, summaryResponse] = await Promise.all([
            nepseAxios.get(`${BASE_URL}/api/nots/nepse-index`, { headers, httpsAgent: nepseHttpsAgent }).catch(() => ({ data: [] })),
            nepseAxios.get(`${BASE_URL}/api/nots/market-summary`, { headers, httpsAgent: nepseHttpsAgent }).catch(() => null)
        ]);

        // Create a map to store unique indices
        const indicesMap = new Map();

        // Process bulk indices (usually returns 4)
        if (bulkIndicesRes.data && Array.isArray(bulkIndicesRes.data)) {
            bulkIndicesRes.data.forEach(idx => {
                indicesMap.set(idx.id, {
                    id: idx.id,
                    name: idx.index,
                    value: parseFloat(idx.currentValue) || 0,
                    change: parseFloat(idx.change) || 0,
                    changePercent: parseFloat(idx.perChange) || 0,
                    high: parseFloat(idx.high) || 0,
                    low: parseFloat(idx.low) || 0,
                    previousClose: parseFloat(idx.previousClose) || 0
                });
            });
        }

        // Identify missing IDs
        const missingIds = allIndexIds.filter(id => !indicesMap.has(id));

        // Fetch missing indices in parallel
        if (missingIds.length > 0) {
            const missingPromises = missingIds.map(id =>
                nepseAxios.get(`${BASE_URL}/api/nots/datewise-indices?indexId=${id}&startDate=${today}&endDate=${today}`, { headers, httpsAgent: nepseHttpsAgent })
                    .catch(() => ({ data: [] }))
            );

            const missingResponses = await Promise.all(missingPromises);
            missingResponses.forEach(res => {
                if (res.data && Array.isArray(res.data) && res.data.length > 0) {
                    const idx = res.data[0];
                    indicesMap.set(idx.indexId, {
                        id: idx.indexId,
                        name: idx.index,
                        value: parseFloat(idx.indexValue) || parseFloat(idx.closeValue) || 0,
                        change: parseFloat(idx.change) || 0,
                        changePercent: parseFloat(idx.perChange) || 0,
                        high: parseFloat(idx.highValue) || 0,
                        low: parseFloat(idx.lowValue) || 0,
                        previousClose: parseFloat(idx.previousClose) || 0
                    });
                }
            });
        }

        const indices = Array.from(indicesMap.values());

        // Find main NEPSE index for the root summary
        const nepseIndex = indices.find(idx => idx.id === 58) || indices[0];

        // Parse market summary data
        let totalTurnover = 0;
        let totalTransactions = 0;
        let totalVolume = 0;
        let totalScripsTraded = 0;
        let totalMarketCap = 0;

        if (summaryResponse?.data && Array.isArray(summaryResponse.data)) {
            summaryResponse.data.forEach(item => {
                const detail = (item.detail || '').toLowerCase();
                const value = parseFloat(item.value) || 0;

                if (detail.includes('turnover')) totalTurnover = value;
                else if (detail.includes('transaction')) totalTransactions = Math.round(value);
                else if (detail.includes('traded shares')) totalVolume = Math.round(value);
                else if (detail.includes('scrips traded')) totalScripsTraded = Math.round(value);
                else if (detail.includes('market capitalization') && !detail.includes('float')) totalMarketCap = value;
            });
        }

        const isOpen = isMarketActive();
        const state = require('../utils/marketTime').getMarketState();

        return {
            isOpen,
            state,
            indexValue: nepseIndex.value,
            indexChange: nepseIndex.change,
            indexChangePercent: nepseIndex.changePercent,
            indices, // ALL indices included here
            totalTransactions,
            totalTurnover,
            totalVolume,
            totalMarketCap,
            activeCompanies: totalScripsTraded,
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
        const endpoint = type === 'turnover'
            ? '/api/nots/top-ten/turnover'
            : type === 'trade'
                ? '/api/nots/top-ten/trade'
                : '/api/nots/top-ten/volume';

        const response = await nepseAxios.get(`${BASE_URL}${endpoint}`, {
            headers,
            httpsAgent: nepseHttpsAgent
        });

        if (!response.data || !Array.isArray(response.data)) {
            return [];
        }

        return response.data.map(item => ({
            symbol: item.symbol,
            companyName: item.securityName || item.name,
            ltp: parseFloat(item.closingPrice) || parseFloat(item.lastTradedPrice) || 0,
            turnover: parseFloat(item.turnover) || 0,
            volume: parseInt(item.shareTraded) || parseInt(item.totalTradedQuantity) || 0,
            trades: parseInt(item.noOfTransactions) || 0
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
