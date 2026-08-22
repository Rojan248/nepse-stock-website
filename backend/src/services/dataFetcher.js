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
    enrichAndFinalize,
    isKnownSymbol
} = require('./dataEnricher');

// Import historical data fetcher for re-export (backward compatibility)
const { fetchPreviousTradingDayData } = require('./historicalDataFetcher');

// Import decomposed market meta, summary sync, and anomaly detection modules
const {
    fetchLiveMarketMeta,
    getTrueTransactionCount
} = require('./fetchers/marketMetaFetcher');
const {
    fixTransactionData,
    scrapeOfficialWebsite,
    syncMarketDataFromWeb
} = require('./marketSummarySync');
const { hasPriceAnomalies } = require('./priceAnomalyDetector');

/**
 * Unified Data Fetcher with Intelligent Fallback
 * Priority: Development (Mock) → Library → Proxy → Custom
 *
 * Note: Market meta fetching lives in fetchers/marketMetaFetcher.js,
 * market summary persistence in marketSummarySync.js, and price anomaly
 * detection in priceAnomalyDetector.js.
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

// ==================== Fetch Success Handling ====================

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
 * Handle fetch failure - logs and records error
 * @param {string} source - Source name
 * @param {Error} error - The error encountered
 */
const handleFetchFailure = (source, error) => {
    logger.warn(`${source} fetcher failed: ${error.message}`);
    lastError = error.message;
    // Optional: record failure in metrics
};

// ==================== Main Orchestration ====================

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
 * Sleep utility
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
