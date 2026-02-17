const https = require('https');
const logger = require('../utils/logger');
const { stockInfoMap: staticStockMap } = require('../../data/nepseStocks');
const { SECTOR_IDS, ALL_SECTORS, MAX_RETRIES, RETRY_DELAY, CONCURRENCY_LIMIT, TIMEOUT } = require('./libraryConfig');
const { transformSecurity: transformSecurityLib, sanitizeSymbol } = require('./libraryTransformers');

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
    keepAlive: true,
    timeout: TIMEOUT
});

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
 * Safely determines if a security is a Public Equity (Ordinary Share).
 * Uses Cascade Strategy: checks official API fields first, falls back to symbol patterns.
 * Filters out Promoters, Mutual Funds, and Debentures.
 * @param {Object} security - Transformed security object
 * @returns {boolean} True if equity security
 */
const { isEquitySecurity } = require('../utils/securityFilters');

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

// ==================== fetchMissingSecurities Helpers ====================

/** Resolve first truthy numeric field from an object, defaulting to fallback */
const mcsField = (mcs, fields, fallback = 0) => {
    for (const f of fields) { if (mcs[f]) return mcs[f]; }
    return fallback;
};

/** Map raw security detail API response to trade-stat compatible shape */
function mapSecurityDetail(data) {
    const mcs = data.securityMcsData;
    const info = data.securityData;
    return {
        symbol: info.symbol,
        securityName: info.securityName,
        lastTradedPrice: mcsField(mcs, ['lastTradedPrice', 'closePrice']),
        previousClose: mcs.previousClose || 0,
        openPrice: mcs.openPrice || 0,
        highPrice: mcs.highPrice || 0,
        lowPrice: mcs.lowPrice || 0,
        totalTradeQuantity: mcs.totalTradeQuantity || 0,
        totalTradeValue: 0,
        totalTrades: mcs.totalTrades || 0,
        percentageChange: 0,
        lastUpdatedDateTime: mcs.lastUpdatedDateTime
    };
}

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
                const res = await nepseAxios.get(`${BASE_URL}/api/nots/security/${company.id}`, {
                    headers,
                    httpsAgent: nepseHttpsAgent
                });

                const data = res.data;
                if (!data || !data.securityMcsData) return null;
                return mapSecurityDetail(data);
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
 * Check if market is currently open (Nepal time)
 * Market hours: 10:00 AM - 3:00 PM NST, Sunday to Thursday
 */
const { isMarketActive } = require('../utils/marketTime');

// Use centralized market time utility instead of local calculation
const isMarketOpen = () => {
    return isMarketActive();
};

// Wrap the imported transformSecurity to pass required dependencies
const transformSecurity = (security, marketOpen = null) => {
    return transformSecurityLib(security, marketOpen, staticStockMap, isMarketOpen);
};

// ==================== fetchMarketSummary Helpers ====================

const toF = (v) => parseFloat(v) || 0;
const toI = (v) => parseInt(v, 10) || null;

/** Transform a raw bulk index entry to standard shape */
function transformIndexEntry(idx) {
    return {
        id: idx.id,
        name: idx.index,
        value: toF(idx.currentValue),
        change: toF(idx.change),
        changePercent: toF(idx.perChange),
        high: toF(idx.high),
        low: toF(idx.low),
        previousClose: toF(idx.previousClose),
        advance: toI(idx.advance),
        decline: toI(idx.decline),
        unchanged: toI(idx.unchanged)
    };
}

/** Transform a datewise index response entry to standard shape */
function transformDatewiseIndex(idx) {
    return {
        id: idx.indexId,
        name: idx.index,
        value: parseFloat(idx.indexValue) || parseFloat(idx.closeValue) || 0,
        change: toF(idx.change),
        changePercent: toF(idx.perChange),
        high: toF(idx.highValue),
        low: toF(idx.lowValue),
        previousClose: toF(idx.previousClose)
    };
}

/** Resolve first parseable int from a list of field candidates */
const resolveInt = (obj, fields) => {
    for (const f of fields) {
        const v = parseInt(obj[f], 10);
        if (!isNaN(v)) return v;
    }
    return null;
};

/** Extract market breadth (advance/decline/unchanged) from NEPSE main index */
function extractBreadth(idx) {
    return {
        advancedCompanies: resolveInt(idx, ['advance', 'positive', 'up']),
        declinedCompanies: resolveInt(idx, ['decline', 'negative', 'down']),
        unchangedCompanies: resolveInt(idx, ['unchanged', 'neutral', 'noChange'])
    };
}

/** Summary detail label → field name mapping */
const SUMMARY_DETAIL_MAP = [
    ['turnover', 'totalTurnover', parseFloat],
    ['transaction', 'totalTransactions', (v) => Math.round(parseFloat(v) || 0)],
    ['traded shares', 'totalVolume', (v) => Math.round(parseFloat(v) || 0)],
    ['scrips traded', 'totalScripsTraded', (v) => Math.round(parseFloat(v) || 0)],
];

/** Classify a single summary item, returning { field, value } or null */
function classifySummaryItem(detail, rawValue) {
    // Market cap (exclude float market cap)
    if (detail.includes('market capitalization') && !detail.includes('float')) {
        return { field: 'totalMarketCap', value: parseFloat(rawValue) || 0 };
    }
    for (const [keyword, field, parser] of SUMMARY_DETAIL_MAP) {
        if (detail.includes(keyword)) return { field, value: parser(rawValue) };
    }
    return null;
}

/** Parse market summary items from the summary API response */
function parseSummaryItems(data) {
    const result = { totalTurnover: 0, totalTransactions: 0, totalVolume: 0, totalScripsTraded: 0, totalMarketCap: 0 };
    if (!data || !Array.isArray(data)) return result;

    for (const item of data) {
        const classified = classifySummaryItem((item.detail || '').toLowerCase(), item.value);
        if (classified) result[classified.field] = classified.value;
    }
    return result;
}

/** Check if a datewise-indices response has valid data */
function hasIndexData(res) {
    return res.data && Array.isArray(res.data) && res.data.length > 0;
}

/**
 * Fetch market summary and all indices from NEPSE
 */
const DEFAULT_BREADTH = { advancedCompanies: null, declinedCompanies: null, unchangedCompanies: null };
const ALL_INDEX_IDS = [51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67];

/** Process bulk indices response into a map + breadth */
function processBulkIndices(data) {
    const indicesMap = new Map();
    let breadth = { ...DEFAULT_BREADTH };
    if (!Array.isArray(data)) return { indicesMap, breadth };

    for (const idx of data) {
        if (idx.id === 58) breadth = extractBreadth(idx);
        indicesMap.set(idx.id, transformIndexEntry(idx));
    }
    return { indicesMap, breadth };
}

/** Fetch and fill any missing indices via datewise endpoint */
async function fetchMissingIndices(indicesMap, headers, today) {
    const missingIds = ALL_INDEX_IDS.filter(id => !indicesMap.has(id));
    if (missingIds.length === 0) return;

    const responses = await Promise.all(
        missingIds.map(id =>
            nepseAxios.get(`${BASE_URL}/api/nots/datewise-indices?indexId=${id}&startDate=${today}&endDate=${today}`, { headers, httpsAgent: nepseHttpsAgent })
                .catch(() => ({ data: [] }))
        )
    );

    for (const res of responses) {
        if (hasIndexData(res)) {
            const idx = res.data[0];
            indicesMap.set(idx.indexId, transformDatewiseIndex(idx));
        }
    }
}

const fetchMarketSummary = async (token) => {
    try {
        const headers = createHeaders(token);
        const today = new Date().toISOString().split('T')[0];

        const [bulkIndicesRes, summaryResponse] = await Promise.all([
            nepseAxios.get(`${BASE_URL}/api/nots/nepse-index`, { headers, httpsAgent: nepseHttpsAgent }).catch(() => ({ data: [] })),
            nepseAxios.get(`${BASE_URL}/api/nots/market-summary`, { headers, httpsAgent: nepseHttpsAgent }).catch(() => null)
        ]);

        const { indicesMap, breadth } = processBulkIndices(bulkIndicesRes.data);
        await fetchMissingIndices(indicesMap, headers, today);

        const indices = Array.from(indicesMap.values());
        const nepseIndex = indices.find(idx => idx.id === 58) || indices[0];
        const summary = parseSummaryItems(summaryResponse?.data);

        const isOpen = isMarketActive();
        const state = require('../utils/marketTime').getMarketState();

        return {
            isOpen,
            state,
            indexValue: nepseIndex.value,
            indexChange: nepseIndex.change,
            indexChangePercent: nepseIndex.changePercent,
            indices,
            ...summary,
            activeCompanies: summary.totalScripsTraded,
            ...breadth,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        logger.error(`Error fetching market summary: ${error.message}`);
        return null;
    }
};

// ==================== fetchTopMovers Helpers ====================

/** Endpoint lookup table for top-movers types */
const MOVER_ENDPOINTS = {
    turnover: '/api/nots/top-ten/turnover',
    trade: '/api/nots/top-ten/trade',
    volume: '/api/nots/top-ten/volume'
};

/** Transform a raw top-mover item to standard shape */
function transformMoverItem(item) {
    return {
        symbol: item.symbol,
        companyName: item.securityName || item.name,
        ltp: parseFloat(item.closingPrice) || parseFloat(item.lastTradedPrice) || 0,
        turnover: parseFloat(item.turnover) || 0,
        volume: parseInt(item.shareTraded) || parseInt(item.totalTradedQuantity) || 0,
        trades: parseInt(item.noOfTransactions) || 0
    };
}

/**
 * Fetch top gainers or losers
 */
const fetchTopMovers = async (token, type) => {
    try {
        const headers = createHeaders(token);
        const endpoint = MOVER_ENDPOINTS[type] || MOVER_ENDPOINTS.volume;

        const response = await nepseAxios.get(`${BASE_URL}${endpoint}`, {
            headers,
            httpsAgent: nepseHttpsAgent
        });

        if (!response.data || !Array.isArray(response.data)) {
            return [];
        }

        return response.data.map(transformMoverItem);

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
    initializeLibrary,
    isEquitySecurity
};
