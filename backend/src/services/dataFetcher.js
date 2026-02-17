const axios = require('axios');
const https = require('https');
const libraryFetcher = require('./scrapers/libraryFetcher');
const proxyFetcher = require('./scrapers/proxyFetcher');
const customScraper = require('./scrapers/customScraper');
const mockFetcher = require('./scrapers/mockFetcher');
const logger = require('./utils/logger');
const NEPSE_STOCKS = require('../data/nepseStocks');

// Import consolidated enrichment functions from dataEnricher
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
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

/**
 * Fetch live market meta (total transactions) from NEPSE public API
 * REFACTORED: Complex conditionals decomposed into helper functions
 */
const fetchLiveMarketMeta = async () => {
    // Try primary endpoint using decomposed helpers
    const tryEndpoint = async (url) => {
        const resp = await marketOpenClient.get(url);
        const meta = parseMarketMetaResponse(resp);

        if (hasValidMarketMeta(meta.totalTransactions, meta.totalTurnover, meta.totalVolume)) {
            return meta;
        }
        return null;
    };

    // Attempt primary endpoint
    try {
        const primary = await tryEndpoint(MARKET_OPEN_URL);
        if (primary) return primary;
    } catch (err) {
        logger.debug(`market-open primary failed: ${err.message}`);
    }

    // Attempt alternate endpoint
    try {
        const alt = await tryEndpoint(MARKET_OPEN_ALT);
        if (alt) return alt;
    } catch (err) {
        logger.debug(`market-open alt failed: ${err.message}`);
    }

    // Fallback 1: Merolagani HTML scrape
    try {
        const resp = await axios.get('https://merolagani.com/MarketSummary.aspx', {
            timeout: 5000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' }
        });
        const result = extractTransactionFromHTML(resp.data, (msg) => logger.info(`Merolagani: ${msg}`));
        if (result) return result;
    } catch (err) {
        logger.debug(`merolagani fallback failed: ${err.message}`);
    }

    // Fallback 2: NepseAlpha
    try {
        const alpha = await axios.get('https://nepsealpha.com/trading-menu', {
            timeout: 5000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' }
        });
        const result = extractTransactionFromHTML(alpha.data, (msg) => logger.info(`NepseAlpha: ${msg}`));
        if (result) return result;
    } catch (err) {
        logger.debug(`nepsealpha fallback failed: ${err.message}`);
    }

    return null;
};

/**
 * Force refresh of transaction count from the live market-open endpoint
 * Persists into latest market summary via Prisma
 */
const { prisma } = require('./database/connection');
const { isMarketActive } = require('./utils/marketTime');
const fixTransactionData = async () => {
    try {
        const meta = await fetchLiveMarketMeta();
        if (!meta || meta.totalTransactions == null) {
            logger.warn('fixTransactionData: meta missing totalTransactions');
            return { updated: false };
        }

        // Insert a new market summary row with updated totals, preserving latest other fields if present
        const latest = await prisma.marketSummary.findFirst({ orderBy: { timestamp: 'desc' } });
        const merged = {
            indexValue: latest?.indexValue ?? null,
            indexChange: latest?.indexChange ?? null,
            indexChangePercent: latest?.indexChangePercent ?? null,
            totalTransactions: meta.totalTransactions,
            totalTurnover: meta.totalTurnover ?? latest?.totalTurnover ?? null,
            totalVolume: meta.totalVolume ?? latest?.totalVolume ?? null,
            activeCompanies: latest?.activeCompanies ?? null,
            advancedCompanies: latest?.advancedCompanies ?? null,
            declinedCompanies: latest?.declinedCompanies ?? null,
            unchangedCompanies: latest?.unchangedCompanies ?? null,
            timestamp: new Date()
        };

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

/** Extract NEPSE index data from index API array */
function parseNepseIndex(indexData, result) {
    if (!indexData || !Array.isArray(indexData)) return;

    const nepseIdx = indexData.find(i => i.id === 58)
        || indexData.find(i => i.index && i.index.toLowerCase().includes('nepse'));

    if (!nepseIdx) return;

    result.nepseIndex = parseFloat(nepseIdx.currentValue) || null;
    result.indexChange = parseFloat(nepseIdx.change) || null;
    result.indexChangePercent = parseFloat(nepseIdx.perChange) || null;
}

/** Resolve the percentage change for a single security */
function resolveSecurityChange(sec) {
    const changeFields = [
        sec.percentageChange, sec.percentChange, sec.perChange,
        sec.changePercent, sec.change_percentage
    ];
    const direct = changeFields.map(v => parseFloat(v)).find(v => Number.isFinite(v));
    if (Number.isFinite(direct)) return direct;

    // Fall back to price comparison
    const ltp = parsePrice(sec.lastTradedPrice || sec.ltp || sec.closePrice || 0);
    const prev = parsePrice(sec.previousClose || sec.previousClosingPrice || sec.prevClose || sec.previous_close || 0);
    if (ltp && prev) return ((ltp - prev) / prev) * 100;

    return undefined;
}

/** Classify a change value into advanced/declined/unchanged bucket */
function classifyChange(change) {
    if (!Number.isFinite(change)) return 'unchanged';
    if (change > 0) return 'advanced';
    if (change < 0) return 'declined';
    return 'unchanged';
}

/** Compute market breadth from securities array */
function computeSecurityBreadth(securities) {
    if (!securities || !Array.isArray(securities)) return null;

    let advanced = 0, declined = 0, unchanged = 0;
    const seen = new Set();

    for (const sec of securities) {
        const symbol = (sec.symbol || sec.securitySymbol || '').toUpperCase();
        if (!symbol || seen.has(symbol) || !stockInfoMap.has(symbol)) continue;
        seen.add(symbol);

        const bucket = classifyChange(resolveSecurityChange(sec));
        if (bucket === 'advanced') advanced++;
        else if (bucket === 'declined') declined++;
        else unchanged++;
    }

    return { advanced, declined, unchanged, totalScripsTraded: seen.size };
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

        // 3. Market breadth
        logger.info('Custom Scraper: Fetching securities for breadth calculation...');
        try {
            const securities = await nepseClient.getSecurities();
            const breadth = computeSecurityBreadth(securities);
            if (breadth) {
                result.totalScripsTraded = breadth.totalScripsTraded;
                result.advanced = breadth.advanced;
                result.declined = breadth.declined;
                result.unchanged = breadth.unchanged;
                logger.info(`Custom Scraper: Breadth - Advanced=${breadth.advanced}, Declined=${breadth.declined}, Unchanged=${breadth.unchanged}`);
            }
        } catch (secErr) {
            logger.debug(`Could not fetch securities for breadth: ${secErr.message}`);
        }

        // Check if we got meaningful data
        if (result.totalTransactions || result.nepseIndex || result.totalTurnover) {
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
        const marketOpen = isMarketActive();

        // Use the custom website scraper
        const webData = await scrapeOfficialWebsite();

        if (!webData) {
            logger.warn('syncMarketDataFromWeb: No data from website scraper');
            return { updated: false, reason: 'Scraper returned no data' };
        }

        // Get the latest record to merge with
        const latest = await prisma.marketSummary.findFirst({ orderBy: { timestamp: 'desc' } });

        // Build merged data, preferring scraped values
        let merged = {
            indexValue: webData.nepseIndex ?? latest?.indexValue ?? null,
            indexChange: webData.indexChange ?? latest?.indexChange ?? null,
            indexChangePercent: webData.indexChangePercent ?? latest?.indexChangePercent ?? null,
            totalTransactions: webData.totalTransactions ?? latest?.totalTransactions ?? null,
            totalTurnover: webData.totalTurnover ?? latest?.totalTurnover ?? null,
            totalVolume: webData.totalVolume ?? latest?.totalVolume ?? null,
            activeCompanies: webData.totalScripsTraded ?? latest?.activeCompanies ?? null,
            advancedCompanies: webData.advanced ?? latest?.advancedCompanies ?? null,
            declinedCompanies: webData.declined ?? latest?.declinedCompanies ?? null,
            unchangedCompanies: webData.unchanged ?? latest?.unchangedCompanies ?? null,
            timestamp: new Date()
        };

        // If market is closed, do NOT overwrite the DB; return the latest stored snapshot (last open day)
        if (!marketOpen) {
            logger.info('syncMarketDataFromWeb: Market closed, keeping last stored market summary');
            return {
                updated: false,
                reason: 'market-closed',
                latest: latest ? { ...latest, source: 'cached-latest' } : merged
            };
        }

        // If breadth looks empty (all zero/unchanged only), try DB fallback
        const breadthMissing = (merged.advancedCompanies ?? 0) === 0
            && (merged.declinedCompanies ?? 0) === 0
            && (merged.unchangedCompanies ?? 0) >= 0;

        if (breadthMissing) {
            const dbBreadth = await computeBreadthFromDb(prisma);
            if (dbBreadth) {
                merged = {
                    ...merged,
                    advancedCompanies: dbBreadth.advanced,
                    declinedCompanies: dbBreadth.declined,
                    unchangedCompanies: dbBreadth.unchanged
                };
                logger.info(`syncMarketDataFromWeb: Applied DB breadth fallback A=${dbBreadth.advanced} D=${dbBreadth.declined} U=${dbBreadth.unchanged}`);
            }
        }

        // Only create new record if we have meaningful data
        if (merged.totalTransactions || merged.totalTurnover) {
            await prisma.marketSummary.create({ data: merged });
            logger.info(`syncMarketDataFromWeb: Updated - Tx=${merged.totalTransactions}, Turnover=${merged.totalTurnover}`);
            return {
                updated: true,
                source: 'custom-scraper',
                ...merged
            };
        }

        return { updated: false, reason: 'No meaningful data scraped' };
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
 * Handle successful fetch - updates tracking state, enriches data, and logs result
 * @param {Object} data - Fetched data
 * @param {string} source - Data source name
 * @returns {Object} The enriched data
 */
const handleFetchSuccess = async (data, source) => {
    await enrichAndFinalize(data, fetchLiveMarketMeta);
    lastDataSource = data.source || source;
    lastUpdateTime = new Date();
    consecutiveFailures = 0;
    logger.info(`✓ Successfully fetched data using ${source} (${data.stocks.length} stocks)`);
    return data;
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
    try {
        logger.debug(`Attempting ${name} fetcher...`);
        const data = await fetcher.fetchData();

        if (data && isValidData(data)) {
            return await handleFetchSuccess(data, name);
        }
        logger.warn(`${name} fetcher returned invalid data, trying next...`);
    } catch (error) {
        logger.warn(`${name} fetcher failed: ${error.message}`);
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
    logger.info('Starting data fetch cycle...');

    // 1. Development Mode Override
    const devData = await checkDevModeOverride();
    if (devData) return devData;

    // 2. Fetcher Strategy
    const fetchers = [
        { fetcher: libraryFetcher, name: 'library' },
        { fetcher: proxyFetcher, name: 'proxy' },
        { fetcher: customScraper, name: 'custom' }
    ];

    // 3. Attempt Fetchers
    for (const config of fetchers) {
        const data = await attemptSingleFetcher(config);
        if (data) return data;
    }

    // 4. All sources failed
    consecutiveFailures++;
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
    consecutiveFailures,
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
    fetchPreviousTradingDayData
};
