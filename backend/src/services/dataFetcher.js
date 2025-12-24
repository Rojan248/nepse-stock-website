const libraryFetcher = require('./scrapers/libraryFetcher');
const proxyFetcher = require('./scrapers/proxyFetcher');
const customScraper = require('./scrapers/customScraper');
const mockFetcher = require('./scrapers/mockFetcher');
const logger = require('./utils/logger');
const NEPSE_STOCKS = require('../data/nepseStocks');

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
    let gainers = 0;
    let losers = 0;
    let unchanged = 0;
    let tradedCompanies = 0;

    stocks.forEach(stock => {
        const change = stock.change || stock.prices?.change || 0;
        const volume = stock.volume || stock.trading?.volume || 0;
        const turnover = stock.turnover || stock.trading?.turnover || 0;
        const trades = stock.totalTrades || stock.trading?.totalTrades || 0;

        calcTurnover += turnover;
        calcVolume += volume;
        calcTrades += trades;

        if (volume > 0) {
            tradedCompanies++;
            if (change > 0) gainers++;
            else if (change < 0) losers++;
            else unchanged++;
        }
    });

    // Prefer API values if available, otherwise use calculated values
    return {
        ...existingSummary,
        // Use API turnover/volume/transactions if available, otherwise use calculated
        totalTurnover: existingSummary.totalTurnover || calcTurnover || 0,
        totalVolume: existingSummary.totalVolume || calcVolume || 0,
        totalTransactions: existingSummary.totalTransactions || calcTrades || 0,
        // Use API company counts if available, otherwise use calculated
        activeCompanies: existingSummary.activeCompanies || tradedCompanies || 0,
        advancedCompanies: existingSummary.advancedCompanies || gainers || 0,
        declinedCompanies: existingSummary.declinedCompanies || losers || 0,
        unchangedCompanies: existingSummary.unchangedCompanies || unchanged || 0,
        timestamp: new Date().toISOString()
    };
};

/**
 * Fetch latest NEPSE data using fallback strategy
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

    // Try Option 1: Library Fetcher
    try {
        logger.debug('Attempting library fetcher (Option 1)...');
        const data = await libraryFetcher.fetchData();

        if (data && isValidData(data)) {
            // Enrich stocks with proper company names and sectors from our mapping
            data.stocks = enrichStocksWithNames(data.stocks);
            // Calculate/enhance market summary from stock data
            data.marketSummary = calculateMarketSummary(data.stocks, data.marketSummary);
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
    getFetchStatus
};
