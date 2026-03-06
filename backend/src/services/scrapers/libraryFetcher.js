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
let initializationPromise = null;

// Custom HTTPS agent for NEPSE requests only
const nepseHttpsAgent = new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true,
    timeout: TIMEOUT
});

/** Shift elements right from startIdx and place item at its sorted position */
function shiftAndInsert(arr, item, startIdx, compareFn) {
    let i = startIdx;
    while (i >= 0 && compareFn(item, arr[i]) < 0) {
        arr[i + 1] = arr[i];
        i--;
    }
    arr[i + 1] = item;
}

/**
 * Safely insert an item into a sorted array of top K elements
 * @param {Array} arr - The sorted array to insert into
 * @param {Object} item - The item to insert
 * @param {number} k - Maximum number of elements to keep
 * @param {Function} compareFn - Comparison function (should return < 0 if item is better than arr[i])
 */
function insertSorted(arr, item, k, compareFn) {
    if (arr.length < k) {
        arr.push(item);
        shiftAndInsert(arr, item, arr.length - 2, compareFn);
    } else if (compareFn(item, arr[k - 1]) < 0) {
        shiftAndInsert(arr, item, k - 2, compareFn);
    }
}

/**
 * Attempt to initialize the NEPSE library with a given mode
 * @param {boolean} useWasm - Whether to use WASM mode
 * @param {string} modeLabel - Human-readable mode label for logging
 * @returns {Promise<boolean>} True if initialization succeeded
 */
const tryInitialize = async (useWasm, modeLabel) => {
    try {
        const nepseModule = await import('nepse-api-helper');
        nepseClient = nepseModule.nepseClient;
        nepseAxios = nepseModule.nepseAxios;
        createHeaders = nepseModule.createHeaders;
        BASE_URL = nepseModule.BASE_URL;

        const customLogger = {
            info: (msg, ...args) => logger.debug(`[NEPSE-API] ${msg}`, ...args),
            warn: (msg, ...args) => logger.warn(`[NEPSE-API] ${msg}`, ...args),
            error: (msg, ...args) => logger.error(`[NEPSE-API] ${msg}`, ...args)
        };

        await nepseClient.initialize({ useWasm, logger: customLogger });
        isInitialized = true;
        logger.info(`✓ NEPSE API Helper library initialized successfully (${modeLabel})`);
        return true;
    } catch (error) {
        logger.warn(`Failed to initialize nepse-api-helper (${modeLabel}): ${error.message}`);
        return false;
    }
};

/** Initialization modes to try in priority order */
const INIT_MODES = [
    { useWasm: true, label: 'WASM mode' },
    { useWasm: false, label: 'TypeScript mode' },
];

/**
 * Initialize the NEPSE library, trying WASM first then TypeScript fallback
 */
const initializeLibrary = async () => {
    for (const { useWasm, label } of INIT_MODES) {
        const success = await tryInitialize(useWasm, label);
        if (success) return true;
    }
    logger.error('Library initialization failed completely');
    return false;
};

/** Ensure the NEPSE library is initialized, returning true if ready.
 *  Coalesces concurrent calls into a single initializeLibrary invocation. */
async function ensureInitialized() {
    if (isInitialized) return true;
    if (!initializationPromise) {
        initializationPromise = initializeLibrary().finally(() => {
            initializationPromise = null;
        });
    }
    const initialized = await initializationPromise;
    if (!initialized) logger.debug('Library not available, returning null');
    return initialized;
}

/** Ranking definitions: [resultKey, compareFn, filterFn?] */
const RANKING_DEFS = [
    ['topTurnover', (a, b) => b.turnover - a.turnover],
    ['topTrades', (a, b) => b.totalTrades - a.totalTrades],
    ['topVolume', (a, b) => b.volume - a.volume],
    ['topGainers', (a, b) => b.changePercent - a.changePercent, (s) => s.volume > 0],
    ['topLosers', (a, b) => a.changePercent - b.changePercent, (s) => s.volume > 0],
];

/** Compute top-K rankings across multiple dimensions in a single O(N*K) pass */
function computeRankings(securities, k = 50) {
    const lists = Object.fromEntries(RANKING_DEFS.map(([name]) => [name, []]));
    for (const s of securities) {
        for (const [name, compareFn, filterFn] of RANKING_DEFS) {
            if (!filterFn || filterFn(s)) {
                insertSorted(lists[name], s, k, compareFn);
            }
        }
    }
    return lists;
}

/**
 * Fetch all stock data using the library
 * @returns {Object|null} Standardized data object or null on failure
 */
const fetchData = async () => {
    try {
        if (!await ensureInitialized()) return null;

        logger.info('Fetching data using NEPSE API Helper library...');

        const token = await nepseClient.getToken();
        const companyList = await fetchCompanyList(token);

        const [securities, marketSummary] = await Promise.all([
            fetchSecuritiesWithPrices(token, companyList),
            fetchMarketSummary(token)
        ]);

        if (!securities || securities.length === 0) {
            logger.warn('Library fetcher: No securities data received');
            return null;
        }

        const result = {
            stocks: securities,
            ipos: [],
            marketSummary,
            ...computeRankings(securities),
            source: 'nepse-api-helper',
            timestamp: new Date().toISOString()
        };

        logger.info(`✓ Library fetcher: Retrieved ${result.stocks.length} stocks from NEPSE`);
        return result;

    } catch (error) {
        logger.error(`Library fetcher error: ${error.message}`);
        isInitialized = false;
        initializationPromise = null;
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
const { isKnownSymbol } = require('../dataEnricher');

/**
 * Merge parallel trade stat responses into a single unique array
 */
const mergeSecurityResponses = (responses) => {
    const allSecuritiesMap = new Map();
    responses.forEach(response => {
        if (response.data && Array.isArray(response.data)) {
            response.data.forEach(security => {
                if (security.symbol && !allSecuritiesMap.has(security.symbol)) {
                    allSecuritiesMap.set(security.symbol, security);
                }
            });
        }
    });
    return Array.from(allSecuritiesMap.values());
};

/** Resolve runtime dependencies with defaults */
const resolveDeps = (runtimeDeps) => ({
    createHeadersFn: runtimeDeps.createHeadersFn || createHeaders,
    nepseAxiosClient: runtimeDeps.nepseAxiosClient || nepseAxios,
    baseUrl: runtimeDeps.baseUrl || BASE_URL,
    httpsAgent: runtimeDeps.httpsAgent || nepseHttpsAgent,
    transformSecurityFn: runtimeDeps.transformSecurityFn || transformSecurity,
    isKnownSymbolFn: runtimeDeps.isKnownSymbolFn || isKnownSymbol,
    fetchMissingSecuritiesFn: runtimeDeps.fetchMissingSecuritiesFn || fetchMissingSecurities,
});

/** Filter and transform raw securities to equity-only list */
const filterEquitySecurities = (allSecurities, transformFn, isKnownFn) => {
    return allSecurities.map(s => transformFn(s)).filter(s => isKnownFn(s.symbol));
};

/**
 * Fetch all securities with price data from NEPSE
 */
const fetchSecuritiesWithPrices = async (token, companyList, runtimeDeps = {}) => {
    try {
        const deps = resolveDeps(runtimeDeps);
        const headers = deps.createHeadersFn(token);

        const fetchPromises = ALL_SECTORS.map(sectorId =>
            deps.nepseAxiosClient.get(`${deps.baseUrl}/api/nots/securityDailyTradeStat/${sectorId}`, {
                headers,
                httpsAgent: deps.httpsAgent,
                timeout: 10000
            }).catch(err => {
                logger.error(`Error fetching Sector ${sectorId}: ${err.message}`);
                return { data: [] };
            })
        );

        const responses = await Promise.all(fetchPromises);
        const mergedSecurities = mergeSecurityResponses(responses);
        logger.debug(`Fetched and merged ${mergedSecurities.length} unique securities from ${fetchPromises.length} primary source(s)`);

        const tradedSymbols = new Set(mergedSecurities.map(s => s.symbol));
        const missingCompanies = companyList
            .filter(c => c.status === 'A' && !tradedSymbols.has(c.symbol))
            .filter(c => deps.isKnownSymbolFn(c.symbol));

        logger.info(`Found ${missingCompanies.length} active EQUITY stocks missing from trade report. Fetching details...`);

        const missingSecurities = await deps.fetchMissingSecuritiesFn(missingCompanies, token);
        const allSecurities = [...mergedSecurities, ...missingSecurities];

        logger.info(`Total securities after merging: ${allSecurities.length}`);

        const transformed = filterEquitySecurities(allSecurities, deps.transformSecurityFn, deps.isKnownSymbolFn);
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

        // delay between chunks to avoid NEPSE rate-limiting
        if (i + CONCURRENCY_LIMIT < companies.length) {
            await new Promise(r => setTimeout(r, 500));
        }
    }

    return results;
};

const { isMarketActive } = require('../utils/marketTime');

// Wrap the imported transformSecurity to pass required dependencies
const transformSecurity = (security, marketOpen = null) => {
    return transformSecurityLib(security, marketOpen, staticStockMap, isMarketActive);
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
    isKnownSymbol,
    __test__: {
        fetchSecuritiesWithPrices
    }
};
