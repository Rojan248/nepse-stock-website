const axios = require('axios');
const https = require('https');
const libraryFetcher = require('./scrapers/libraryFetcher');
const proxyFetcher = require('./scrapers/proxyFetcher');
const customScraper = require('./scrapers/customScraper');
const mockFetcher = require('./scrapers/mockFetcher');
const logger = require('./utils/logger');
const { recordSyncSuccess, recordSyncFailure } = require('./utils/alertService');

// Import consolidated enrichment functions from dataEnricher
const { normalizeStockData } = require('./utils/dataNormalizer');
const {
    parsePrice,
    updateMarketBreadth,
    enrichStocksWithNames,
    calculateMarketSummary,
    enrichAndFinalize,
    stockInfoMap,
    isKnownSymbol,
    computeBreadthFromDb
} = require('./dataEnricher');

// Import market data helpers for complex conditional decomposition
const {
    hasValidMarketMeta,
    parseMarketMetaResponse,
    extractTransactionFromHTML
} = require('./utils/marketDataHelpers');

// Import historical data fetcher for re-export (backward compatibility)
const { fetchPreviousTradingDayData } = require('./historicalDataFetcher');

// Live market meta endpoint (contains totalTransaction)
const MARKET_OPEN_URL = 'https://nepalstock.com.np/api/nots/nepse-data/market-open';
const MARKET_OPEN_ALT = 'https://nepalstock.com/api/nots/nepse-data/market-open';
const marketOpenClient = axios.create({
    timeout: 4000,
    httpsAgent: new https.Agent({ keepAlive: true }),
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': 'https://nepalstock.com.np/'
    }
});

/**
 * Unified Data Fetcher with Intelligent Fallback
 * Priority: Development (Mock) → Library → Proxy → Custom
 * 
 * Note: Stock enrichment and market summary calculation logic has been
 * extracted to dataEnricher.js to eliminate code duplication.
 */

// Track data source and update time
let lastDataSource = null;
let lastUpdateTime = null;
let consecutiveFailures = 0;
let lastError = null;
let lastFetchDurationMs = null;
let lastFetchStartedAt = null;
let lastSuccessfulDurationMs = null;
let rateLimitEvents = 0;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

const sourceStats = {};

const emptySourceStats = () => ({
    attempts: 0,
    successes: 0,
    failures: 0,
    invalid: 0,
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastDurationMs: null,
    lastError: null
});

const ensureSourceStats = (source) => {
    if (!sourceStats[source]) sourceStats[source] = emptySourceStats();
    return sourceStats[source];
};

const RATE_LIMIT_ERROR_PATTERN = /429|rate/i;

const applySourceAttemptStatus = (stats, status) => {
    if (status === 'success') {
        stats.successes++;
        stats.lastSuccessAt = stats.lastAttemptAt;
        stats.lastError = null;
        return;
    }

    if (status === 'invalid') {
        stats.invalid++;
        return;
    }

    stats.failures++;
};

const getAttemptErrorMessage = (status, error) => error?.message || status;

const isRateLimitError = (error) => {
    const responseStatus = error?.response?.status;
    return responseStatus === 429 || RATE_LIMIT_ERROR_PATTERN.test(error?.message || '');
};

const recordSourceAttempt = (source, status, durationMs, error = null) => {
    const stats = ensureSourceStats(source);
    stats.attempts++;
    stats.lastAttemptAt = new Date().toISOString();
    stats.lastDurationMs = durationMs;

    applySourceAttemptStatus(stats, status);

    if (status === 'success') {
        return;
    }

    stats.lastError = getAttemptErrorMessage(status, error);
    if (isRateLimitError(error)) {
        rateLimitEvents++;
    }
};

// ==================== Market Meta Fetching ====================

const SCRAPE_HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' };

/** Data-driven list of market meta sources to try in priority order */
const MARKET_META_SOURCES = [
    {
        name: 'market-open-primary',
        fetch: () => marketOpenClient.get(MARKET_OPEN_URL),
        parse: (resp) => {
            const meta = parseMarketMetaResponse(resp);
            return hasValidMarketMeta(meta.totalTransactions, meta.totalTurnover, meta.totalVolume) ? meta : null;
        }
    },
    {
        name: 'market-open-alt',
        fetch: () => marketOpenClient.get(MARKET_OPEN_ALT),
        parse: (resp) => {
            const meta = parseMarketMetaResponse(resp);
            return hasValidMarketMeta(meta.totalTransactions, meta.totalTurnover, meta.totalVolume) ? meta : null;
        }
    },
    {
        name: 'merolagani',
        fetch: () => axios.get('https://merolagani.com/MarketSummary.aspx', { timeout: 5000, headers: SCRAPE_HEADERS }),
        parse: (resp) => extractTransactionFromHTML(resp.data, (msg) => logger.info(`Merolagani: ${msg}`))
    },
    {
        name: 'nepsealpha',
        fetch: () => axios.get('https://nepsealpha.com/trading-menu', { timeout: 5000, headers: SCRAPE_HEADERS }),
        parse: (resp) => extractTransactionFromHTML(resp.data, (msg) => logger.info(`NepseAlpha: ${msg}`))
    }
];

/**
 * Execute a single source fetch with timeout and validation wrapper
 * @param {Object} source - The source configuration object
 * @returns {Promise<Object>} Resolves with valid data, rejects otherwise
 */
const fetchSourceWithTimeout = (source) => {
    return new Promise((resolve, reject) => {
        // Safety timeout slightly longer than the axios timeouts (4000-5000ms)
        const timer = setTimeout(() => {
            const msg = `Timeout waiting for ${source.name}`;
            logger.debug(msg);
            reject(new Error(msg));
        }, 6000);

        source.fetch()
            .then(resp => {
                clearTimeout(timer);
                try {
                    const result = source.parse(resp);
                    if (result) {
                        resolve(result);
                    } else {
                        // Log invalid data but reject so Promise.any keeps trying
                        logger.debug(`${source.name} returned invalid data`);
                        reject(new Error('Invalid data'));
                    }
                } catch (parseErr) {
                    logger.debug(`${source.name} parse failed: ${parseErr.message}`);
                    reject(parseErr);
                }
            })
            .catch(err => {
                clearTimeout(timer);
                logger.debug(`${source.name} failed: ${err.message}`);
                reject(err);
            });
    });
};

/**
 * Fetch live market meta (total transactions) from NEPSE public API
 * Tries multiple sources concurrently using Promise.any
 */
const fetchLiveMarketMeta = async () => {
    try {
        // Launch all requests in parallel
        // fastest successful response wins
        const result = await Promise.any(
            MARKET_META_SOURCES.map(source => fetchSourceWithTimeout(source))
        );
        return result;
    } catch (err) {
        // Promise.any throws AggregateError if ALL promises reject
        if (err instanceof AggregateError) {
            logger.debug(`All ${MARKET_META_SOURCES.length} market meta sources failed`);
        } else {
            logger.error(`Unexpected error in fetchLiveMarketMeta: ${err.message}`);
        }
        return null;
    }
};

// ==================== Market Summary Merging ====================

const { prisma } = require('./database/connection');
const { isMarketActive } = require('./utils/marketTime');

/** Field mappings for merging scraped data → DB market summary */
const MARKET_SUMMARY_FIELDS = [
    ['indexValue', 'nepseIndex'],
    ['indexChange', 'indexChange'],
    ['indexChangePercent', 'indexChangePercent'],
    ['totalTransactions', 'totalTransactions'],
    ['totalTurnover', 'totalTurnover'],
    ['totalVolume', 'totalVolume'],
    ['activeCompanies', 'totalScripsTraded'],
    ['advancedCompanies', 'advanced'],
    ['declinedCompanies', 'declined'],
    ['unchangedCompanies', 'unchanged'],
];

/**
 * Merge scraped data with latest DB record, preferring scraped values.
 * @param {Object} scraped - New data (keys may differ from DB columns)
 * @param {Object|null} latest - Latest DB record to fall back on
 * @param {Object} [overrides] - Extra fields to force-set (e.g. totalTransactions)
 * @returns {Object} Merged market summary ready for DB insertion
 */
function mergeMarketSummary(scraped, latest, overrides = {}) {
    const merged = { timestamp: new Date() };
    for (const [dbField, srcField] of MARKET_SUMMARY_FIELDS) {
        merged[dbField] = scraped?.[srcField] ?? latest?.[dbField] ?? null;
    }
    return { ...merged, ...overrides };
}

/**
 * Force refresh of transaction count from the live market-open endpoint
 * Persists into latest market summary via Prisma
 */
const fixTransactionData = async () => {
    try {
        const meta = await fetchLiveMarketMeta();
        if (!meta || meta.totalTransactions == null) {
            logger.warn('fixTransactionData: meta missing totalTransactions');
            return { updated: false };
        }

        const latest = await prisma.marketSummary.findFirst({ orderBy: { timestamp: 'desc' } });
        const merged = mergeMarketSummary(meta, latest, { totalTransactions: meta.totalTransactions });

        await prisma.marketSummary.create({ data: merged });
        logger.info(`fixTransactionData: updated totalTransactions=${meta.totalTransactions}`);
        return { updated: true, totalTransactions: meta.totalTransactions };
    } catch (error) {
        logger.error(`fixTransactionData failed: ${error.message}`);
        return { updated: false, error: error.message };
    }
};

// ==================== scrapeOfficialWebsite helpers ====================

/** Mapping from market summary detail keywords to result field + transform */
const SUMMARY_FIELD_MAP = [
    { keyword: 'turnover', field: 'totalTurnover', transform: v => v },
    { keyword: 'transactions', field: 'totalTransactions', transform: v => Math.round(v) },
    { keyword: 'traded shares', field: 'totalVolume', transform: v => Math.round(v) },
    { keyword: 'scrips traded', field: 'totalScripsTraded', transform: v => Math.round(v) },
];

/** Parse market summary API array into result fields */
function parseMarketSummaryItems(items, result) {
    if (!items || !Array.isArray(items)) return;

    for (const item of items) {
        const detail = (item.detail || '').toLowerCase();
        const value = parseFloat(item.value) || 0;
        const mapping = SUMMARY_FIELD_MAP.find(m => detail.includes(m.keyword));
        if (mapping) result[mapping.field] = mapping.transform(value);
    }
}

/** Find the NEPSE main index entry (id=58 or name match) */
function findNepseEntry(indexData) {
    if (!Array.isArray(indexData)) return null;
    return indexData.find(i => i.id === 58)
        || indexData.find(i => (i.index || '').toLowerCase().includes('nepse'))
        || null;
}

/** Extract NEPSE index data from index API array */
function parseNepseIndex(indexData, result) {
    const nepseIdx = findNepseEntry(indexData);
    if (!nepseIdx) return;

    result.nepseIndex = parseFloat(nepseIdx.currentValue) || null;
    result.indexChange = parseFloat(nepseIdx.change) || null;
    result.indexChangePercent = parseFloat(nepseIdx.perChange) || null;
}



// ==================== Main scraper ====================

/**
 * Custom Web Scraper - Fetches market data using nepse-api-helper library
 * This properly authenticates with NEPSE API to get real data
 * @returns {Object|null} Market data object or null
 */
const scrapeOfficialWebsite = async () => {
    const result = {
        nepseIndex: null, indexChange: null, indexChangePercent: null,
        totalTransactions: null, totalTurnover: null, totalVolume: null,
        totalScripsTraded: null, advanced: null, declined: null, unchanged: null
    };

    try {
        const { nepseClient, nepseAxios, createHeaders, BASE_URL } = require('nepse-api-helper');

        logger.info('Custom Scraper: Initializing NEPSE API helper...');
        await nepseClient.initialize({ useWasm: true });

        const token = await nepseClient.getToken();
        const headers = createHeaders(token);

        // 1. Market summary
        logger.info('Custom Scraper: Fetching market summary...');
        const summaryResp = await nepseAxios.get(`${BASE_URL}/api/nots/market-summary`, { headers, timeout: 10000 });
        parseMarketSummaryItems(summaryResp.data, result);
        logger.info(`Custom Scraper: Market Summary - Tx=${result.totalTransactions}, Vol=${result.totalVolume}, Turnover=${result.totalTurnover}`);

        // 2. NEPSE Index
        logger.info('Custom Scraper: Fetching NEPSE index...');
        const indexData = await nepseClient.getNepseIndex();
        parseNepseIndex(indexData, result);
        if (result.nepseIndex) {
            logger.info(`Custom Scraper: NEPSE Index = ${result.nepseIndex}, Change = ${result.indexChangePercent}%`);
        }


        const hasMeaningfulData = result.totalTransactions || result.nepseIndex || result.totalTurnover;
        if (hasMeaningfulData) {
            logger.info(`Custom Scraper SUCCESS: Tx=${result.totalTransactions}, Index=${result.nepseIndex}`);
            return result;
        }

    } catch (err) {
        logger.error(`Custom Scraper failed: ${err.message}`);
    }

    logger.warn('Custom Scraper: Failed to get data');
    return null;
};



/**
 * Sync all market data from web scraping - comprehensive update
 * Fetches transactions, turnover, volume, index data and saves to database
 * @returns {Object} Result with updated fields
 */
const syncMarketDataFromWeb = async () => {
    try {
        const webData = await scrapeOfficialWebsite();
        if (!webData) {
            logger.warn('syncMarketDataFromWeb: No data from website scraper');
            return { updated: false, reason: 'Scraper returned no data' };
        }

        const latest = await prisma.marketSummary.findFirst({ orderBy: { timestamp: 'desc' } });
        let merged = mergeMarketSummary(webData, latest);

        // If market is closed, return cached snapshot without writing
        if (!isMarketActive()) {
            logger.info('syncMarketDataFromWeb: Market closed, keeping last stored market summary');
            return { updated: false, reason: 'market-closed', latest: latest ? { ...latest, source: 'cached-latest' } : merged };
        }



        // Only persist if we have meaningful data
        if (!merged.totalTransactions && !merged.totalTurnover) {
            return { updated: false, reason: 'No meaningful data scraped' };
        }

        await prisma.marketSummary.create({ data: merged });
        logger.info(`syncMarketDataFromWeb: Updated - Tx=${merged.totalTransactions}, Turnover=${merged.totalTurnover}`);
        return { updated: true, source: 'custom-scraper', ...merged };
    } catch (error) {
        logger.error(`syncMarketDataFromWeb failed: ${error.message}`);
        return { updated: false, error: error.message };
    }
};

// Public helper mirroring the requested name
const getTrueTransactionCount = async () => {
    const meta = await fetchLiveMarketMeta();
    return meta?.totalTransactions ?? 0;
};

/**
 * Sleep utility
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Ensure market summary exists, fallback to database if not
 * @param {Object} data - Fetched data
 */
const ensureMarketSummary = async (data) => {
    if (data.marketSummary) return;
    try {
        const { prisma } = require('./database/connection');
        const latestSummary = await prisma.marketSummary.findFirst({ orderBy: { timestamp: 'desc' }, take: 1 });
        data.marketSummary = latestSummary || {};
    } catch (e) {
        logger.debug(`Failed to load DB fallback summary in fetch success: ${e.message}`);
        data.marketSummary = {};
    }
};

/**
 * Filter non-equity stocks from data
 * @param {Object} data - Fetched data
 */
const filterEquityStocks = (data) => {
    if (!Array.isArray(data.stocks)) return;
    const before = data.stocks.length;
    data.stocks = data.stocks.filter(s => s.isOrdinaryShare === true || isKnownSymbol(s.symbol));
    const removed = before - data.stocks.length;
    if (removed > 0) {
        logger.info(`handleFetchSuccess: Filtered out ${removed} non-ordinary securities (${before} → ${data.stocks.length})`);
    }
};

/**
 * Handle successful fetch - updates tracking state, enriches data, and logs result
 * @param {Object} data - Fetched data
 * @param {string} source - Data source name
 * @returns {Object} The enriched data
 */
const handleFetchSuccess = async (data, source) => {
    await ensureMarketSummary(data);
    filterEquityStocks(data);
    await enrichAndFinalize(data, fetchLiveMarketMeta);

    lastDataSource = data.source || source;
    lastUpdateTime = new Date();
    consecutiveFailures = 0;
    lastError = null;

    // Record successful sync for alertService
    recordSyncSuccess(source);
    
    // Phase 2: Standardize all stocks using the NEW normalization utility
    if (Array.isArray(data.stocks)) {
        data.stocks = data.stocks.map(s => normalizeStockData(s, source)).filter(Boolean);
        data.source = source; // Explicitly set source on data object
    }

    logger.info(`✓ Successfully fetched data using ${source} (${data.stocks?.length || 0} stocks)`);
    return data;
};

/**
 * Check for price anomalies between incoming data and current database state.
 * Rejects data if a single stock moves by more than ±15% (NEPSE circuit breaker limit).
 * @param {Array} incomingStocks - Array of normalized incoming stocks
 * @returns {Promise<boolean>} True if internal anomalies detected
 */
const hasPriceAnomalies = async (incomingStocks) => {
    if (!incomingStocks || incomingStocks.length === 0) return false;

    try {
        const symbols = incomingStocks.map(s => s.symbol);
        const existingMap = await loadExistingPriceMap(symbols);

        for (const stock of incomingStocks) {
            const anomaly = getPriceAnomaly(stock, existingMap);
            if (!anomaly) continue;
            logPriceAnomaly(stock.symbol, anomaly);
            return true;
        }
    } catch (error) {
        logger.error(`Anomaly detection failed: ${error.message}`);
        return false; // Fail safe
    }
    return false;
};

const loadExistingPriceMap = async (symbols) => {
    const existingStocks = await prisma.stock.findMany({
        where: { symbol: { in: symbols } },
        select: { symbol: true, lastTradedPrice: true }
    });

    return new Map(existingStocks.map(s => [s.symbol, s.lastTradedPrice]));
};

const hasUsablePrice = (price) => Number(price) > 0;

const calculatePriceDelta = (oldPrice, newPrice) => Math.abs(newPrice - oldPrice) / oldPrice;

const getPriceAnomaly = (stock, existingMap) => {
    const oldPrice = existingMap.get(stock.symbol);
    const newPrice = stock.lastTradedPrice;

    if (!hasUsablePrice(oldPrice) || !hasUsablePrice(newPrice)) {
        return null;
    }

    const delta = calculatePriceDelta(oldPrice, newPrice);
    return delta > 0.15 ? { oldPrice, newPrice, delta } : null;
};

const logPriceAnomaly = (symbol, { oldPrice, newPrice, delta }) => {
    const percent = (delta * 100).toFixed(1);
    logger.error(`[Anomaly] Rejecting data: ${symbol} moved ${percent}% (${oldPrice} -> ${newPrice})`);
};

/**
 * Handle fetch failure - logs and records error
 * @param {string} source - Source name
 * @param {Error} error - The error encountered
 */
const handleFetchFailure = (source, error) => {
    logger.warn(`${source} fetcher failed: ${error.message}`);
    lastError = error.message;
    // Optional: record failure in metrics
};

/**
 * Fetch latest NEPSE data using fallback strategy
 * Priority: Mock (dev) → Library → Proxy → Custom
 * Uses a loop-based approach to eliminate code triplication
 * @returns {Object|null} Data object or null if all sources fail
 */
/**
 * Check for development mode override
 * @returns {Object|null} Mock data if applicable
 */
const checkDevModeOverride = async () => {
    if (process.env.NODE_ENV === 'development' || process.env.USE_MOCK_DATA === 'true') {
        try {
            logger.info('DEV MODE: Using Mock Fetcher for simulation...');
            const data = await mockFetcher.fetchData();
            if (data) {
                lastDataSource = 'mock';
                lastUpdateTime = new Date();
                consecutiveFailures = 0;
                lastError = null;
                logger.info(`✓ [Mock] Generated data for ${data.stocks.length} stocks`);
                return data;
            }
        } catch (error) {
            logger.error(`Mock fetcher failed: ${error.message}`);
        }
    }
    return null;
};

/**
 * Attempt to fetch using a single fetcher configuration
 * @param {Object} config - { fetcher, name }
 * @returns {Object|null} Valid data object or null
 */
const attemptSingleFetcher = async ({ fetcher, name }) => {
    const started = Date.now();
    try {
        logger.debug(`Attempting ${name} fetcher...`);
        const data = await fetcher.fetchData();
        const duration = Date.now() - started;

        if (data && isValidData(data)) {
            // Phase 2: Pre-write Anomaly Detection
            if (await hasPriceAnomalies(data.stocks)) {
                logger.warn(`${name} data rejected due to price anomalies. Trying next source...`);
                recordSourceAttempt(name, 'invalid', duration, new Error('price anomalies'));
                return null;
            }

            const result = await handleFetchSuccess(data, name);
            recordSourceAttempt(name, 'success', duration);
            return result;
        }
        logger.warn(`${name} fetcher returned invalid data, trying next...`);
        recordSourceAttempt(name, 'invalid', duration, new Error('invalid data'));
    } catch (error) {
        const duration = Date.now() - started;
        handleFetchFailure(name, error);
        recordSourceAttempt(name, 'failure', duration, error);
    }
    return null;
};

/**
 * Fetch latest NEPSE data using fallback strategy
 * Priority: Mock (dev) → Library → Proxy → Custom
 * Uses a loop-based approach to eliminate code triplication
 * @returns {Object|null} Data object or null if all sources fail
 */
const fetchLatestData = async () => {
    const fetchStarted = Date.now();
    lastFetchStartedAt = new Date(fetchStarted);
    logger.info('Starting data fetch cycle...');

    // 1. Development Mode Override
    const devData = await checkDevModeOverride();
    if (devData) {
        lastFetchDurationMs = Date.now() - fetchStarted;
        lastSuccessfulDurationMs = lastFetchDurationMs;
        lastError = null;
        return devData;
    }

    // 2. Fetcher Strategy
    const fetchers = [
        { fetcher: libraryFetcher, name: 'library' },
        { fetcher: proxyFetcher, name: 'proxy' },
        { fetcher: customScraper, name: 'custom' }
    ];

    // 3. Attempt Fetchers
    for (const config of fetchers) {
        const data = await attemptSingleFetcher(config);
        if (data) {
            lastFetchDurationMs = Date.now() - fetchStarted;
            lastSuccessfulDurationMs = lastFetchDurationMs;
            return data;
        }
    }

    // 4. All sources failed
    lastFetchDurationMs = Date.now() - fetchStarted;
    lastError = 'All data sources failed';
    consecutiveFailures++;
    recordSyncFailure('all-sources', `All data sources failed. Consecutive failures: ${consecutiveFailures}`);
    logger.error(`All data sources failed. Consecutive failures: ${consecutiveFailures}`);
    return null;
};

/**
 * Fetch with retry logic
 * @param {number} maxRetries - Maximum retry attempts
 * @returns {Object|null} Data or null after retries exhausted
 */
const fetchWithRetry = async (maxRetries = MAX_RETRIES) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const data = await fetchLatestData();

        if (data) {
            return data;
        }

        if (attempt < maxRetries) {
            logger.info(`Retry ${attempt}/${maxRetries} after ${RETRY_DELAY}ms...`);
            await sleep(RETRY_DELAY);
        }
    }

    logger.error(`All ${maxRetries} retry attempts failed`);
    return null;
};

/**
 * Validate data structure
 * @param {Object} data - Data to validate
 * @returns {boolean} True if valid
 */
const isValidData = (data) => {
    if (!data) return false;

    // Must have at least stocks or market summary
    const hasStocks = Array.isArray(data.stocks) && data.stocks.length > 0;
    const hasMarketSummary = data.marketSummary && typeof data.marketSummary === 'object';

    if (!hasStocks && !hasMarketSummary) {
        logger.debug('Invalid data: missing stocks and market summary');
        return false;
    }

    // Validate stock structure if present
    if (hasStocks) {
        const sampleStock = data.stocks[0];
        if (!sampleStock.symbol) {
            logger.debug('Invalid data: stock missing symbol');
            return false;
        }
    }

    return true;
};

/**
 * Get current data source
 * @returns {string|null} Current data source name
 */
const getDataSource = () => lastDataSource;

/**
 * Get last successful update time
 * @returns {Date|null} Last update timestamp
 */
const getLastUpdateTime = () => lastUpdateTime;

/**
 * Get fetch status
 * @returns {Object} Status object
 */
const getFetchStatus = () => ({
    dataSource: lastDataSource,
    lastUpdateTime: lastUpdateTime ? lastUpdateTime.toISOString() : null,
    lastFetchStartedAt: lastFetchStartedAt ? lastFetchStartedAt.toISOString() : null,
    lastFetchDurationMs,
    lastSuccessfulDurationMs,
    lastError,
    consecutiveFailures,
    rateLimitEvents,
    sourceStats,
    isHealthy: consecutiveFailures < 3
});

module.exports = {
    fetchLatestData,
    fetchWithRetry,
    getDataSource,
    getLastUpdateTime,
    getFetchStatus,
    fixTransactionData,
    getTrueTransactionCount,
    parsePrice,
    updateMarketBreadth,
    scrapeOfficialWebsite,
    syncMarketDataFromWeb,
    fetchPreviousTradingDayData,
    hasPriceAnomalies
};
