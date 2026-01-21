const axios = require('axios');
const https = require('https');
const libraryFetcher = require('./scrapers/libraryFetcher');
const proxyFetcher = require('./scrapers/proxyFetcher');
const customScraper = require('./scrapers/customScraper');
const alertService = require('./alertService');
const logger = require('./utils/logger');
const NEPSE_STOCKS = require('../data/nepseStocks');
const { tryFallbackSources } = require('./fetchers/fallbackSources');
const { isValidMarketData, isValidMarketMeta } = require('./utils/dataValidation');
const {
    shouldUpdateMarketData,
    mergeMarketSummaryData,
    isBreadthMissing,
    applyBreadthFallback
} = require('./utils/marketDataHelpers');

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
 */

// Create a lookup map for quick symbol -> stock info lookup
const stockInfoMap = new Map();
NEPSE_STOCKS.forEach(stock => {
    stockInfoMap.set(stock.symbol.toUpperCase(), {
        name: stock.name,
        sector: stock.sector
    });
});

// Track data source and update time
let lastDataSource = null;
let lastUpdateTime = null;
let consecutiveFailures = 0;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

/**
 * Fetch live market meta (total transactions) from NEPSE public API
 * @returns {Promise<Object|null>} { totalTransactions, totalTurnover, totalVolume } or null
 */
const fetchLiveMarketMeta = async () => {
    /**
     * Try a single NEPSE endpoint
     */
    const tryEndpoint = async (url) => {
        try {
            const resp = await marketOpenClient.get(url);
            const body = resp.data || {};
            const totalTransactions = parseInt(body.totalTransaction || body.totalTransactions || body.totalTrades || 0) || null;
            const totalTurnover = body.totalTurnover ? parseFloat(body.totalTurnover) : null;
            const totalVolume = body.totalVolume ? parseFloat(body.totalVolume) : null;
            if (totalTransactions !== null || totalTurnover !== null || totalVolume !== null) {
                return { totalTransactions, totalTurnover, totalVolume };
            }
        } catch (err) {
            logger.debug(`market-open endpoint failed (${url}): ${err.message}`);
        }
        return null;
    };

    // 1. Try Primary & Alt NEPSE endpoints concurrently
    try {
        const primaryResult = await Promise.any([
            tryEndpoint(MARKET_OPEN_URL).then(res => { if (!res) throw new Error('No Data'); return res; }),
            tryEndpoint(MARKET_OPEN_ALT).then(res => { if (!res) throw new Error('No Data'); return res; })
        ]);
        if (primaryResult) return primaryResult;
    } catch (e) {
        logger.debug('Primary NEPSE endpoints failed, trying fallbacks...');
    }

    // 2. Try fallback sources (Merolagani, NepseAlpha, ShareSansar)
    return await tryFallbackSources();
};

/**
 * Force refresh of transaction count from the live market-open endpoint
 * Persists into latest market summary via Prisma
 */
const { prisma } = require('./database/connection');
const { isMarketActive } = require('./utils/marketTime');

// Compute breadth from database stocks as a reliable fallback
const computeBreadthFromDb = async () => {
    try {
        const [advanced, declined, unchanged] = await Promise.all([
            prisma.stock.count({ where: { percentageChange: { gt: 0 } } }),
            prisma.stock.count({ where: { percentageChange: { lt: 0 } } }),
            prisma.stock.count({ where: { OR: [{ percentageChange: 0 }, { percentageChange: null }] } })
        ]);

        // If all counts are zero/unchanged, derive breadth from price comparison
        if (advanced === 0 && declined === 0) {
            const stocks = await prisma.stock.findMany({
                select: { lastTradedPrice: true, ltp: true, previousClose: true }
            });

            let adv = 0, dec = 0, unc = 0;
            stocks.forEach(s => {
                const ltp = parsePrice(s.lastTradedPrice ?? s.ltp ?? 0);
                const prev = parsePrice(s.previousClose ?? 0);
                if (ltp === 0 || prev === 0) {
                    unc++;
                } else if (ltp > prev) {
                    adv++;
                } else if (ltp < prev) {
                    dec++;
                } else {
                    unc++;
                }
            });

            return { advanced: adv, declined: dec, unchanged: unc };
        }

        return { advanced, declined, unchanged };
    } catch (e) {
        logger.debug(`computeBreadthFromDb failed: ${e.message}`);
        return null;
    }
};
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
 * Sync all market data from web scraping - comprehensive update
 * Fetches transactions, turnover, volume, index data and saves to database
 * Uses the primary library fetcher to avoid logic duplication
 * @returns {Object} Result with updated fields
 */
const syncMarketDataFromWeb = async () => {
    try {
        const marketOpen = isMarketActive();

        // Use the centralized library fetcher
        const libData = await libraryFetcher.fetchData();

        if (!libData || !libData.marketSummary) {
            logger.warn('syncMarketDataFromWeb: No data from library fetcher');
            return { updated: false, reason: 'Library fetcher returned no data' };
        }

        const summary = libData.marketSummary;

        // Placeholder - do not run this tool yet until I read schema again.

        // Get latest cached data and merge with API data
        const latest = await prisma.marketSummary.findFirst({ orderBy: { timestamp: 'desc' } });
        let merged = mergeMarketSummaryData(summary, latest);

        // Determine if we should update based on market state and data changes
        const { shouldUpdate, reason } = shouldUpdateMarketData(latest, merged, marketOpen);

        if (!shouldUpdate) {
            logger.debug(`syncMarketDataFromWeb: ${reason}, skipping DB write`);
            return {
                updated: false,
                reason,
                latest: latest ? { ...latest, source: 'cached-latest' } : merged
            };
        }

        // Log closing report detection if market is closed but data changed
        if (reason === 'closing-report-detected') {
            logger.info('syncMarketDataFromWeb: Closing Report detected - Saving to DB.');
        }

        // Apply breadth fallback if needed
        if (isBreadthMissing(merged)) {
            const dbBreadth = await computeBreadthFromDb();
            if (dbBreadth) {
                merged = applyBreadthFallback(merged, dbBreadth);
                logger.info(`syncMarketDataFromWeb: Applied DB breadth A=${dbBreadth.advanced} D=${dbBreadth.declined} U=${dbBreadth.unchanged}`);
            }
        }

        // Only create new record if we have meaningful data
        if (merged.totalTransactions || merged.totalTurnover) {
            await prisma.marketSummary.create({ data: merged });
            logger.info(`syncMarketDataFromWeb: Updated - Tx=${merged.totalTransactions}, Turnover=${merged.totalTurnover}`);
            return {
                updated: true,
                source: 'library-fetcher',
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
 * Safe price parser - handles strings with commas, null, undefined, NaN
 * @param {any} value - Value to parse as price
 * @returns {number} Parsed price or 0 if invalid
 */
const parsePrice = (value) => {
    if (value === null || value === undefined) return 0;
    // Convert to string, remove commas, parse float
    const cleaned = String(value).replace(/,/g, '').trim();
    const parsed = parseFloat(cleaned);
    return Number.isNaN(parsed) ? 0 : parsed;
};

/**
 * Calculate market breadth from stock data using robust price comparison
 * @param {Array} stocks - Array of stock objects
 * @returns {Object} { advanced, declined, unchanged }
 */
const updateMarketBreadth = (stocks) => {
    let advanced = 0, declined = 0, unchanged = 0;

    if (!Array.isArray(stocks)) {
        return { advanced, declined, unchanged };
    }

    stocks.forEach(stock => {
        // Try multiple field names for current price
        const current = parsePrice(
            stock.lastTradedPrice || stock.ltp || stock.close ||
            stock.prices?.ltp || stock.prices?.close
        );
        // Try multiple field names for previous close
        const prev = parsePrice(
            stock.previousClose || stock.previousClosingPrice ||
            stock.previous_close || stock.prices?.previousClose
        );

        // If either price is 0/invalid, count as unchanged (no data)
        if (current === 0 || prev === 0) {
            unchanged++;
        } else if (current > prev) {
            advanced++;
        } else if (current < prev) {
            declined++;
        } else {
            unchanged++;
        }
    });

    logger.debug(`Market Breadth: Advanced=${advanced}, Declined=${declined}, Unchanged=${unchanged}`);
    return { advanced, declined, unchanged };
};

/**
 * Sleep utility
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Enrich stock data with company names from the static mapping
 * This ensures we always have real company names even if the data source doesn't provide them
 * @param {Array} stocks - Array of stock objects
 * @returns {Array} Enriched stock array
 */
const enrichStocksWithNames = (stocks) => {
    if (!Array.isArray(stocks)) return stocks;

    return stocks.map(stock => {
        const symbol = (stock.symbol || '').toUpperCase();
        const stockInfo = stockInfoMap.get(symbol);

        // Check if companyName is missing, generic (like COMxxx), or just the symbol
        const needsName = !stock.companyName ||
            stock.companyName.startsWith('COM') ||
            stock.companyName === symbol ||
            stock.companyName.length < 3;

        if (stockInfo && needsName) {
            return {
                ...stock,
                companyName: stockInfo.name,
                sector: stock.sector === 'Others' ? stockInfo.sector : stock.sector
            };
        }

        // If we have stockInfo but sector is 'Others' or 'NEPSE Index', use our sector mapping
        if (stockInfo && (stock.sector === 'Others' || stock.sector === 'NEPSE Index')) {
            return {
                ...stock,
                sector: stockInfo.sector
            };
        }

        return stock;
    });
};

/**
 * Calculate market summary from stock data
 * @param {Array} stocks - Array of stock objects
 * @param {Object} existingSummary - Existing market summary from API (may have index data)
 * @returns {Object} Enhanced market summary
 */
const calculateMarketSummary = (stocks, existingSummary = {}) => {
    if (!Array.isArray(stocks) || stocks.length === 0) {
        return existingSummary;
    }

    // Calculate statistics from stock data as fallback
    let calcTurnover = 0;
    let calcVolume = 0;
    let calcTrades = 0;
    let tradedCompanies = 0;

    stocks.forEach(stock => {
        const volume = parsePrice(stock.volume || stock.trading?.volume);
        const turnover = parsePrice(stock.turnover || stock.trading?.turnover);
        const trades = parsePrice(
            stock.totalTrades
            || stock.trading?.totalTrades
            || stock.trading?.trades
            || stock.trading?.noOfTransactions
            || stock.noOfTransactions
        );

        calcTurnover += turnover;
        calcVolume += volume;
        calcTrades += trades;

        if (volume > 0) {
            tradedCompanies++;
        }
    });

    // Use robust price-based breadth calculation
    const breadth = updateMarketBreadth(stocks);

    // Prefer API values if available, otherwise use calculated values
    return {
        ...existingSummary,
        // Preserve NEPSE index values from API if present
        indexValue: existingSummary.indexValue || null,
        indexChange: existingSummary.indexChange || null,
        indexChangePercent: existingSummary.indexChangePercent || null,
        // Use API turnover/volume/transactions if available, otherwise use calculated
        totalTurnover: existingSummary.totalTurnover || calcTurnover || 0,
        totalVolume: existingSummary.totalVolume || calcVolume || 0,
        totalTransactions: (existingSummary.totalTransactions && existingSummary.totalTransactions > 0)
            ? existingSummary.totalTransactions
            : (calcTrades || 0),
        // Use API company counts if available, otherwise use robust breadth calculation
        activeCompanies: existingSummary.activeCompanies || tradedCompanies || 0,
        advancedCompanies: existingSummary.advancedCompanies || breadth.advanced || 0,
        declinedCompanies: existingSummary.declinedCompanies || breadth.declined || 0,
        unchangedCompanies: existingSummary.unchangedCompanies || breadth.unchanged || 0,
        timestamp: new Date().toISOString()
    };
};

/**
 * Fetch latest NEPSE data using fallback strategy
 * @returns {Object|null} Data object or null if all sources fail
 */
const fetchLatestData = async () => {
    logger.info('Starting data fetch cycle...');

    // NOTE: Mock fetcher removed - always use real scraped data

    // Try Option 1: Library Fetcher
    try {
        logger.debug('Attempting library fetcher (Option 1)...');
        const data = await libraryFetcher.fetchData();

        if (data && isValidData(data)) {
            // Enrich stocks with proper company names and sectors from our mapping
            data.stocks = enrichStocksWithNames(data.stocks);
            // Calculate/enhance market summary from stock data
            data.marketSummary = calculateMarketSummary(data.stocks, data.marketSummary);
            // Patch missing totals from live meta endpoint
            const liveMeta = await fetchLiveMarketMeta();
            if (liveMeta) {
                data.marketSummary = {
                    ...data.marketSummary,
                    totalTransactions: data.marketSummary.totalTransactions || liveMeta.totalTransactions || 0,
                    totalTurnover: data.marketSummary.totalTurnover || liveMeta.totalTurnover || data.marketSummary.totalTurnover,
                    totalVolume: data.marketSummary.totalVolume || liveMeta.totalVolume || data.marketSummary.totalVolume
                };
            }
            lastDataSource = data.source || 'library';
            lastUpdateTime = new Date();
            consecutiveFailures = 0;
            logger.info(`✓ Successfully fetched data using library (${data.stocks.length} stocks)`);
            return data;
        }
        logger.warn('Library fetcher returned invalid data, trying proxy...');
    } catch (error) {
        logger.warn(`Library fetcher failed: ${error.message}`);
    }

    // Try Option 2: Proxy Fetcher
    try {
        logger.debug('Attempting proxy fetcher (Option 2)...');
        const data = await proxyFetcher.fetchData();

        if (data && isValidData(data)) {
            // Enrich stocks with proper company names from our mapping
            data.stocks = enrichStocksWithNames(data.stocks);
            // Calculate/enhance market summary from stock data
            data.marketSummary = calculateMarketSummary(data.stocks, data.marketSummary);
            const liveMeta = await fetchLiveMarketMeta();
            if (liveMeta) {
                data.marketSummary = {
                    ...data.marketSummary,
                    totalTransactions: data.marketSummary.totalTransactions || liveMeta.totalTransactions || 0,
                    totalTurnover: data.marketSummary.totalTurnover || liveMeta.totalTurnover || data.marketSummary.totalTurnover,
                    totalVolume: data.marketSummary.totalVolume || liveMeta.totalVolume || data.marketSummary.totalVolume
                };
            }
            lastDataSource = data.source || 'proxy';
            lastUpdateTime = new Date();
            consecutiveFailures = 0;
            logger.info(`✓ Successfully fetched data using proxy (${data.stocks.length} stocks)`);
            return data;
        }
        logger.warn('Proxy fetcher returned invalid data, trying custom...');
    } catch (error) {
        logger.warn(`Proxy fetcher failed: ${error.message}`);
    }

    // Try Option 3: Custom Scraper (currently placeholder)
    try {
        logger.debug('Attempting custom scraper (Option 3)...');
        const data = await customScraper.fetchData();

        if (data && isValidData(data)) {
            // Enrich stocks with proper company names from our mapping
            data.stocks = enrichStocksWithNames(data.stocks);
            // Calculate/enhance market summary from stock data
            data.marketSummary = calculateMarketSummary(data.stocks, data.marketSummary);
            const liveMeta = await fetchLiveMarketMeta();
            if (liveMeta) {
                data.marketSummary = {
                    ...data.marketSummary,
                    totalTransactions: data.marketSummary.totalTransactions || liveMeta.totalTransactions || 0,
                    totalTurnover: data.marketSummary.totalTurnover || liveMeta.totalTurnover || data.marketSummary.totalTurnover,
                    totalVolume: data.marketSummary.totalVolume || liveMeta.totalVolume || data.marketSummary.totalVolume
                };
            }
            lastDataSource = data.source || 'custom';
            lastUpdateTime = new Date();
            consecutiveFailures = 0;
            logger.info(`✓ Successfully fetched data using custom scraper (${data.stocks.length} stocks)`);
            return data;
        }
    } catch (error) {
        logger.warn(`Custom scraper failed: ${error.message}`);
    }

    // All sources failed
    consecutiveFailures++;
    logger.error(`All data sources failed. Consecutive failures: ${consecutiveFailures}`);

    if (consecutiveFailures >= 3) {
        await alertService.sendAlert(`CRITICAL: All 3 data sources (Library, Proxy, Custom) are failing. Consecutive failures: ${consecutiveFailures}. Please investigate immediately.`, 'error');
    }

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
/**
 * Fetch data from the previous trading day (Security Daily Trade Stat)
 * Useful for correcting zeroed-out data on weekends/holidays
 */
const fetchPreviousTradingDayData = async () => {
    try {
        logger.info('Fetching previous trading day data (SecurityDailyTradeStat)...');
        const nepseModule = await import('nepse-api-helper');
        const nepseClient = nepseModule.nepseClient;
        const createHeaders = nepseModule.createHeaders;

        await nepseClient.initialize({ useWasm: true });
        const token = await nepseClient.getToken();

        const agent = new https.Agent({ rejectUnauthorized: false });
        const headers = { ...createHeaders(token), 'Referer': 'https://www.nepalstock.com.np/' };

        // Fetch securityDailyTradeStat (Index 58 is usually "All Scrips" or similar broad index)
        const url = `https://www.nepalstock.com.np/api/nots/securityDailyTradeStat/58`;

        const res = await axios.get(url, { headers, httpsAgent: agent });
        const data = res.data;

        if (!Array.isArray(data) || data.length === 0) {
            logger.warn('No previous trading day data found');
            return null;
        }

        logger.info(`Fetched ${data.length} records from previous trading day.`);

        let advanced = 0;
        let declined = 0;
        let unchanged = 0;

        data.forEach(stock => {
            const diff = stock.difference || (stock.closePrice - stock.previousClose);
            if (diff > 0) advanced++;
            else if (diff < 0) declined++;
            else unchanged++;
        });

        return {
            advanced,
            declined,
            unchanged,
            totalTraded: data.length
        };

    } catch (e) {
        logger.error(`Error fetching previous trading day data: ${e.message}`);
        return null;
    }
};

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
    syncMarketDataFromWeb,
    fetchPreviousTradingDayData
};
