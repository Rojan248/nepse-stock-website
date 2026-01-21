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
 */
const fetchLiveMarketMeta = async () => {
    // Try primary
    const tryEndpoint = async (url) => {
        const resp = await marketOpenClient.get(url);
        const body = resp.data || {};
        const totalTransactions = parseInt(body.totalTransaction || body.totalTransactions || body.totalTrades || 0) || null;
        const totalTurnover = body.totalTurnover ? parseFloat(body.totalTurnover) : null;
        const totalVolume = body.totalVolume ? parseFloat(body.totalVolume) : null;
        if (totalTransactions !== null || totalTurnover !== null || totalVolume !== null) {
            return { totalTransactions, totalTurnover, totalVolume };
        }
        return null;
    };

    try {
        const primary = await tryEndpoint(MARKET_OPEN_URL);
        if (primary) return primary;
    } catch (err) {
        logger.debug(`market-open primary failed: ${err.message}`);
    }

    try {
        const alt = await tryEndpoint(MARKET_OPEN_ALT);
        if (alt) return alt;
    } catch (err) {
        logger.debug(`market-open alt failed: ${err.message}`);
    }

    // Fallback: Merolagani HTML scrape (using robust text-pattern search)
    try {
        const resp = await axios.get('https://merolagani.com/MarketSummary.aspx', {
            timeout: 5000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' }
        });
        const html = resp.data || '';
        // Robust regex: look for 'Total Transactions' followed by any tags/whitespace, then a number
        // This handles: <th>Total Transactions</th>....<td>64,407</td> or similar patterns
        const match = html.match(/Total\s+Transactions[^0-9]*([0-9,]+)/i);
        if (match && match[1]) {
            const raw = match[1].replace(/,/g, '');
            const count = parseInt(raw, 10);
            if (!Number.isNaN(count) && count > 0) {
                logger.info(`Transaction Match Found (Merolagani): ${count}`);
                return { totalTransactions: count, totalTurnover: null, totalVolume: null };
            }
        }
    } catch (err) {
        logger.debug(`merolagani fallback failed: ${err.message}`);
    }

    // Fallback 2: NepseAlpha
    try {
        const alpha = await axios.get('https://nepsealpha.com/trading-menu', {
            timeout: 5000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' }
        });
        const alphaMatch = alpha.data.match(/Transactions[^0-9]*([0-9,]+)/i);
        if (alphaMatch && alphaMatch[1]) {
            const count = parseInt(alphaMatch[1].replace(/,/g, ''), 10);
            if (!Number.isNaN(count) && count > 0) {
                logger.info(`Transaction Match Found (NepseAlpha): ${count}`);
                return { totalTransactions: count, totalTurnover: null, totalVolume: null };
            }
        }
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

/**
 * Custom Web Scraper - Fetches market data using nepse-api-helper library
 * This properly authenticates with NEPSE API to get real data
 * @returns {Object|null} Market data object or null
 */
const scrapeOfficialWebsite = async () => {
    const result = {
        nepseIndex: null,
        indexChange: null,
        indexChangePercent: null,
        totalTransactions: null,
        totalTurnover: null,
        totalVolume: null,
        totalScripsTraded: null,
        advanced: null,
        declined: null,
        unchanged: null
    };
    
    try {
        // Use nepse-api-helper library for authenticated access
        const { nepseClient, nepseAxios, createHeaders, BASE_URL } = require('nepse-api-helper');
        
        logger.info('Custom Scraper: Initializing NEPSE API helper...');
        await nepseClient.initialize({ useWasm: true });
        
        const token = await nepseClient.getToken();
        const headers = createHeaders(token);
        
        // Fetch market summary
        logger.info('Custom Scraper: Fetching market summary...');
        const summaryResp = await nepseAxios.get(`${BASE_URL}/api/nots/market-summary`, { headers, timeout: 10000 });
        
        if (summaryResp.data && Array.isArray(summaryResp.data)) {
            summaryResp.data.forEach(item => {
                const detail = (item.detail || '').toLowerCase();
                const value = parseFloat(item.value) || 0;
                
                if (detail.includes('turnover')) {
                    result.totalTurnover = value;
                } else if (detail.includes('transactions')) {
                    result.totalTransactions = Math.round(value);
                } else if (detail.includes('traded shares')) {
                    result.totalVolume = Math.round(value);
                } else if (detail.includes('scrips traded')) {
                    result.totalScripsTraded = Math.round(value);
                }
            });
            logger.info(`Custom Scraper: Market Summary - Tx=${result.totalTransactions}, Vol=${result.totalVolume}, Turnover=${result.totalTurnover}`);
        }
        
        // Fetch NEPSE Index
        logger.info('Custom Scraper: Fetching NEPSE index...');
        const indexData = await nepseClient.getNepseIndex();
        
        if (indexData && Array.isArray(indexData)) {
            // Find NEPSE Index (id 58)
            const nepseIdx = indexData.find(i => i.id === 58) || indexData.find(i => i.index && i.index.toLowerCase().includes('nepse'));
            
            if (nepseIdx) {
                result.nepseIndex = parseFloat(nepseIdx.currentValue) || null;
                result.indexChange = parseFloat(nepseIdx.change) || null;
                result.indexChangePercent = parseFloat(nepseIdx.perChange) || null;
                logger.info(`Custom Scraper: NEPSE Index = ${result.nepseIndex}, Change = ${result.indexChangePercent}%`);
            }
        }
        
        // Fetch securities to calculate advance/decline
        logger.info('Custom Scraper: Fetching securities for breadth calculation...');
        try {
            const securities = await nepseClient.getSecurities();
            if (securities && Array.isArray(securities)) {
                let advanced = 0, declined = 0, unchanged = 0;
                const seen = new Set();

                securities.forEach(sec => {
                    const symbol = (sec.symbol || sec.securitySymbol || '').toUpperCase();
                    if (!symbol || seen.has(symbol)) return;
                    if (!stockInfoMap.has(symbol)) return; // Ignore instruments outside our equities list
                    seen.add(symbol);

                    // Try multiple change fields; fall back to price comparison when change is missing/zero
                    const changeFields = [
                        sec.percentageChange,
                        sec.percentChange,
                        sec.perChange,
                        sec.changePercent,
                        sec.change_percentage
                    ];
                    let change = changeFields
                        .map(v => parseFloat(v))
                        .find(v => Number.isFinite(v));

                    if (!Number.isFinite(change)) {
                        const ltp = parsePrice(sec.lastTradedPrice || sec.ltp || sec.closePrice || 0);
                        const prev = parsePrice(sec.previousClose || sec.previousClosingPrice || sec.prevClose || sec.previous_close || 0);
                        if (ltp && prev) {
                            change = ((ltp - prev) / prev) * 100;
                        }
                    }

                    if (Number.isFinite(change)) {
                        if (change > 0) advanced++;
                        else if (change < 0) declined++;
                        else unchanged++;
                    } else {
                        // If still unknown, count as unchanged to keep totals aligned
                        unchanged++;
                    }
                });

                result.totalScripsTraded = seen.size;
                result.advanced = advanced;
                result.declined = declined;
                result.unchanged = unchanged;
                logger.info(`Custom Scraper: Breadth - Advanced=${advanced}, Declined=${declined}, Unchanged=${unchanged}`);
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
const fetchLatestData = async () => {
    logger.info('Starting data fetch cycle...');

    // Development Mode Override: Use Mock Fetcher
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

    // Fetcher configurations: [fetcher, sourceName]
    // Loop eliminates the 3x code duplication that was causing "bumpy road" smell
    const fetchers = [
        { fetcher: libraryFetcher, name: 'library' },
        { fetcher: proxyFetcher, name: 'proxy' },
        { fetcher: customScraper, name: 'custom' }
    ];

    for (const { fetcher, name } of fetchers) {
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
    }

    // All sources failed
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
