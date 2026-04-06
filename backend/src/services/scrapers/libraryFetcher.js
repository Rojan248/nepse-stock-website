const https = require('https');
const logger = require('../utils/logger');
const { stockInfoMap: staticStockMap } = require('../../data/nepseStocks');
const { SECTOR_IDS, ALL_SECTORS, MAX_RETRIES, RETRY_DELAY, CONCURRENCY_LIMIT, TIMEOUT } = require('./libraryConfig');
const { transformSecurity: transformSecurityLib, sanitizeSymbol } = require('./libraryTransformers');
const { fetchMissingSecurities, enrichWithOHLC } = require('./missingSecuritiesFetcher');
const { fetchMarketSummary } = require('./marketSummaryFetcher');

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
            fetchMarketSummary(token, { nepseAxios, BASE_URL, nepseHttpsAgent, createHeaders })
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
    fetchMissingSecuritiesFn: runtimeDeps.fetchMissingSecuritiesFn || ((comps, tok) => fetchMissingSecurities(comps, tok, {
        nepseAxios, BASE_URL, nepseHttpsAgent, createHeaders
    })),
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

        // ── OHLC Enrichment ─────────────────────────────────────────────
        // The securityDailyTradeStat bulk endpoint does NOT return
        // openPrice, highPrice, or lowPrice. We must fetch them from
        // the per-security detail endpoint for every traded stock.
        const ohlcDeps = {
            nepseAxios: deps.nepseAxiosClient,
            BASE_URL: deps.baseUrl,
            nepseHttpsAgent: deps.httpsAgent,
            createHeaders: deps.createHeadersFn
        };
        const enrichedSecurities = await enrichWithOHLC(mergedSecurities, token, ohlcDeps);

        const tradedSymbols = new Set(enrichedSecurities.map(s => s.symbol));
        const missingCompanies = companyList
            .filter(c => c.status === 'A' && !tradedSymbols.has(c.symbol))
            .filter(c => deps.isKnownSymbolFn(c.symbol));

        logger.info(`Found ${missingCompanies.length} active EQUITY stocks missing from trade report. Fetching details...`);

        const missingSecurities = await deps.fetchMissingSecuritiesFn(missingCompanies, token);
        const allSecurities = [...enrichedSecurities, ...missingSecurities];

        logger.info(`Total securities after merging: ${allSecurities.length}`);

        const transformed = filterEquitySecurities(allSecurities, deps.transformSecurityFn, deps.isKnownSymbolFn);
        logger.info(`Filtered to ${transformed.length} equity securities (excluded mutual funds, bonds, debentures)`);

        return transformed;

    } catch (error) {
        logger.error(`Error fetching securities with prices: ${error.message}`);
        return null;
    }
};



const { isMarketActive } = require('../utils/marketTime');

// Wrap the imported transformSecurity to pass required dependencies
const transformSecurity = (security, marketOpen = null) => {
    return transformSecurityLib(security, marketOpen, staticStockMap, isMarketActive);
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
