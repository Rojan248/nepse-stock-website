const https = require('https');
const logger = require('../utils/logger');
const { stockInfoMap: staticStockMap } = require('../../data/nepseStocks');

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
const nepseHttpsAgent = new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true, // Performance optimization
    timeout: 4000 // Strict timeout
});

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const CONCURRENCY_LIMIT = 20; // Max parallel requests for individual stock details

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

        // Fetch company list first (needed by fetchSecuritiesWithPrices)
        const companyList = await fetchCompanyList(token);

        // Fetch securities and market summary in parallel
        const [securities, marketSummary] = await Promise.all([
            fetchSecuritiesWithPrices(token, companyList),
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
 * Check if a security is an equity (stock) vs non-equity (bond, MF, debenture)
 * @param {Object} security - Transformed security object
 * @returns {boolean} True if equity security
 */
const isEquitySecurity = (security) => {
    if (!security) return false;

    const symbol = security.symbol.toUpperCase();
    const sectorId = security.sectorId;
    const sector = (security.sector || '').toLowerCase();

    // Exclude Mutual Funds (sector ID 66 or sector name contains 'mutual fund')
    if (sectorId === 66) return false;
    if (sector.includes('mutual fund')) return false;

    // Exclude Bonds/Debentures - various patterns:
    // - Ends with B + 2-4 digits (e.g., ADBLB87)
    // - Ends with D + 2-4 digits (e.g., SBLD83)
    // - Contains digit pairs with underscore/slash (e.g., GBILD84_85, NICAD85/86)
    // - Ends with EB, UR, SY (common bond/unit suffixes)
    if (/B\d{2,4}$/.test(symbol)) return false;
    if (/D\d{2,4}$/.test(symbol)) return false;
    if (/\d{2}[_/]\d{2}/.test(symbol)) return false;  // 84_85 or 83/84 patterns
    if (/EB\d{2}/.test(symbol)) return false;  // NMBEB92, EBLEB89
    if (/UR\d{2}/.test(symbol)) return false;  // NIFRAUR85
    if (/SY$/.test(symbol)) return false;  // GSY, KSY, RSY (yojana units)
    if (/SF$/.test(symbol)) return false;  // PRSF, SAGF type symbols

    // Exclude Promoter Shares (ends with PO)
    if (symbol.endsWith('PO')) return false;

    return true;
};

/**
 * Fetch all securities with price data from NEPSE
 */
const fetchSecuritiesWithPrices = async (token, companyList) => {
    try {
        const headers = createHeaders(token);

        // Optimize: Fetch ONLY Sector 58 (NEPSE Index) which contains ALL traded securities
        // This avoids making 17+ parallel requests which triggers NEPSE firewall/rate-limiting
        const fetchPromises = [
            nepseAxios.get(`${BASE_URL}/api/nots/securityDailyTradeStat/58`, {
                headers,
                httpsAgent: nepseHttpsAgent,
                timeout: 10000
            }).catch(err => {
                logger.error(`Error fetching Main Sector 58: ${err.message}`);
                return { data: [] };
            })
        ];


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
        logger.debug(`Fetched and merged ${mergedSecurities.length} unique securities from ${fetchPromises.length} primary source(s)`);


        // Identify missing stocks (Active in Company List but not in Trade Stat)
        const tradedSymbols = new Set(mergedSecurities.map(s => s.symbol));
        const missingCompanies = companyList.filter(c => c.status === 'A' && !tradedSymbols.has(c.symbol));

        logger.info(`Found ${missingCompanies.length} active stocks missing from trade report. Fetching details...`);

        // Fetch details for missing stocks in batches
        const missingSecurities = await fetchMissingSecurities(missingCompanies, token);
        const allSecurities = [...mergedSecurities, ...missingSecurities];

        logger.info(`Total securities after merging: ${allSecurities.length}`);

        // Transform to our standard format and filter to stocks only
        const transformed = allSecurities
            .map(security => transformSecurity(security))
            .filter(s => s !== null)
            .filter(s => isEquitySecurity(s)); // Exclude MFs, bonds, debentures

        logger.info(`Filtered to ${transformed.length} equity securities (excluded mutual funds, bonds, debentures)`);

        return transformed;

    } catch (error) {
        logger.error(`Error fetching securities with prices: ${error.message}`);
        return null;
    }
};

/**
 * Fetch detailed data for a list of companies using security/{id}
 * Done in batches to control concurrency
 */
const fetchMissingSecurities = async (companies, token) => {
    const results = [];
    const headers = createHeaders(token);

    // Process in chunks
    for (let i = 0; i < companies.length; i += CONCURRENCY_LIMIT) {
        const chunk = companies.slice(i, i + CONCURRENCY_LIMIT);
        const chunkPromises = chunk.map(async (company) => {
            try {
                // Fetch individual security details
                // Uses: /api/nots/security/{id}
                const res = await nepseAxios.get(`${BASE_URL}/api/nots/security/${company.id}`, {
                    headers,
                    httpsAgent: nepseHttpsAgent
                });

                const data = res.data;
                if (!data || !data.securityMcsData) return null;

                // Map to 'securityDailyTradeStat' structure so transformSecurity can handle it
                const mcs = data.securityMcsData;
                const info = data.securityData;

                return {
                    symbol: info.symbol,
                    securityName: info.securityName,
                    lastTradedPrice: mcs.lastTradedPrice || mcs.closePrice || 0,
                    previousClose: mcs.previousClose || 0,
                    openPrice: mcs.openPrice || 0,
                    highPrice: mcs.highPrice || 0,
                    lowPrice: mcs.lowPrice || 0,
                    totalTradeQuantity: mcs.totalTradeQuantity || 0,
                    totalTradeValue: 0, // No turnover if not traded
                    totalTrades: mcs.totalTrades || 0,
                    percentageChange: 0, // Assumed 0 if not traded today
                    lastUpdatedDateTime: mcs.lastUpdatedDateTime
                };
            } catch (error) {
                logger.warn(`Failed to fetch details for ${company.symbol} (${company.id}): ${error.message}`);
                return null;
            }
        });

        const chunkResults = await Promise.all(chunkPromises);
        results.push(...chunkResults.filter(r => r !== null));

        // precise delay between chunks
        if (i + CONCURRENCY_LIMIT < companies.length) {
            await new Promise(r => setTimeout(r, 200));
        }
    }

    return results;
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

    // If both LTP and previousClose are 0, use static base price from our stock mapping
    // This handles stocks that haven't traded recently or have data quality issues
    if (ltp === 0 && prevClose === 0) {
        const staticInfo = staticStockMap.get(symbol.toUpperCase());
        if (staticInfo && staticInfo.base > 0) {
            ltp = staticInfo.base;
            logger.debug(`[${symbol}] Using static base price: ${ltp} (no trade data available)`);
        }
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
        // Also extract market breadth data (advance/decline/unchanged) from NEPSE index
        let advancedCompanies = null;
        let declinedCompanies = null;
        let unchangedCompanies = null;

        if (bulkIndicesRes.data && Array.isArray(bulkIndicesRes.data)) {
            bulkIndicesRes.data.forEach(idx => {
                // Log all fields from the first index for debugging
                if (idx.id === 58) {
                    logger.debug(`NEPSE Index raw data: ${JSON.stringify(idx)}`);
                    // Extract breadth data - NEPSE API uses these field names
                    advancedCompanies = parseInt(idx.advance) || parseInt(idx.positive) || parseInt(idx.up) || null;
                    declinedCompanies = parseInt(idx.decline) || parseInt(idx.negative) || parseInt(idx.down) || null;
                    unchangedCompanies = parseInt(idx.unchanged) || parseInt(idx.neutral) || parseInt(idx.noChange) || null;
                    logger.info(`Breadth from NEPSE: A=${advancedCompanies}, D=${declinedCompanies}, U=${unchangedCompanies}`);
                }

                indicesMap.set(idx.id, {
                    id: idx.id,
                    name: idx.index,
                    value: parseFloat(idx.currentValue) || 0,
                    change: parseFloat(idx.change) || 0,
                    changePercent: parseFloat(idx.perChange) || 0,
                    high: parseFloat(idx.high) || 0,
                    low: parseFloat(idx.low) || 0,
                    previousClose: parseFloat(idx.previousClose) || 0,
                    // Include breadth data if available
                    advance: parseInt(idx.advance) || null,
                    decline: parseInt(idx.decline) || null,
                    unchanged: parseInt(idx.unchanged) || null
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

/**
 * Fetch list of all companies from NEPSE
 */
const fetchCompanyList = async (token) => {
    try {
        const headers = createHeaders(token);
        const res = await nepseAxios.get(`${BASE_URL}/api/nots/company/list`, {
            headers,
            httpsAgent: nepseHttpsAgent
        });
        return res.data;
    } catch (error) {
        logger.warn(`Error fetching company list: ${error.message}`);
        return [];
    }
};

module.exports = {
    fetchData,
    initializeLibrary
};
