const { prisma } = require('./database/connection');
const logger = require('./utils/logger');
const { isMarketActive } = require('./utils/marketTime');
const { fetchLiveMarketMeta } = require('./fetchers/marketMetaFetcher');

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

module.exports = {
    mergeMarketSummary,
    fixTransactionData,
    scrapeOfficialWebsite,
    syncMarketDataFromWeb
};
