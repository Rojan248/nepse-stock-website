/**
 * Fetch Missing Securities Logic & OHLC Enrichment
 * Extracted from libraryFetcher.js to reduce file complexity.
 * Also provides OHLC enrichment for traded stocks whose bulk endpoint
 * lacks openPrice/highPrice/lowPrice fields.
 */
const logger = require('../utils/logger');
const { CONCURRENCY_LIMIT } = require('./libraryConfig');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const hasMoreBatches = (nextIndex, items) => nextIndex < items.length;

const maybeDelayNextBatch = async (nextIndex, items, delayMs) => {
    if (hasMoreBatches(nextIndex, items)) await sleep(delayMs);
};

const fetchSecurityById = (deps, id, headers, timeout) => {
    const requestOptions = {
        headers,
        httpsAgent: deps.nepseHttpsAgent,
        maxRedirects: deps.maxRedirects ?? 0
    };
    if (timeout) requestOptions.timeout = timeout;
    return deps.nepseAxios.get(`${deps.BASE_URL}/api/nots/security/${id}`, requestOptions);
};

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
        totalTradeQuantity: mcsField(mcs, ['totalTradeQuantity', 'totalTradedQuantity']),
        totalTradeValue: mcsField(mcs, ['totalTradedValue', 'totalTradeValue', 'turnover']),
        totalTrades: mcsField(mcs, ['totalTrades', 'noOfTransactions']),
        percentageChange: 0,
        fiftyTwoWeekHigh: mcsField(mcs, ['fiftyTwoWeekHigh', 'high52']),
        fiftyTwoWeekLow: mcs.fiftyTwoWeekLow || 0,
        lastUpdatedDateTime: mcs.lastUpdatedDateTime
    };
}

/**
 * Generic batched fetcher - fetch security detail for a list of items by ID
 * @param {Array} items - Array of { securityId, symbol } objects
 * @param {Object} deps - { nepseAxios, BASE_URL, nepseHttpsAgent, createHeaders }
 * @param {Object} headers - Pre-built request headers
 * @returns {Promise<Map<string, Object>>} Map of symbol → securityMcsData
 */
const fetchSecurityDetails = async (items, deps, headers) => {
    const resultMap = new Map();

    for (let i = 0; i < items.length; i += CONCURRENCY_LIMIT) {
        const chunk = items.slice(i, i + CONCURRENCY_LIMIT);
        const details = await Promise.all(chunk.map(item => fetchSecurityMcs(item, deps, headers)));
        for (const detail of details.filter(Boolean)) resultMap.set(detail.symbol, detail.mcs);
        await maybeDelayNextBatch(i + CONCURRENCY_LIMIT, items, 300);
    }

    return resultMap;
};

const fetchSecurityMcs = async (item, deps, headers) => {
    const id = item.securityId || item.id;
    const symbol = item.symbol;
    try {
        const res = await fetchSecurityById(deps, id, headers, 8000);
        const mcs = res.data?.securityMcsData;
        return mcs ? { symbol, mcs } : null;
    } catch (error) {
        logger.debug(`Failed to fetch detail for ${symbol} (${id}): ${error.message}`);
        return null;
    }
};

/**
 * Fetch detailed data for a list of companies using security/{id}
 * Done in batches to control concurrency
 */
const fetchMissingSecurities = async (companies, token, deps) => {
    const results = [];
    const headers = deps.createHeaders(token);

    // Process in chunks
    for (let i = 0; i < companies.length; i += CONCURRENCY_LIMIT) {
        const chunk = companies.slice(i, i + CONCURRENCY_LIMIT);
        const chunkResults = await Promise.all(chunk.map(company => fetchMissingSecurity(company, deps, headers)));
        results.push(...chunkResults.filter(Boolean));
        await maybeDelayNextBatch(i + CONCURRENCY_LIMIT, companies, 500);
    }

    return results;
};

const fetchMissingSecurity = async (company, deps, headers) => {
    try {
        const res = await fetchSecurityById(deps, company.id, headers);
        const data = res.data;
        return data?.securityMcsData ? mapSecurityDetail(data) : null;
    } catch (error) {
        logger.warn(`Failed to fetch details for ${company.symbol} (${company.id}): ${error.message}`);
        return null;
    }
};

const OHLC_MERGE_FIELDS = [
    ['openPrice', 'openPrice', 'openPrice'],
    ['highPrice', 'highPrice', 'highPrice'],
    ['lowPrice', 'lowPrice', 'lowPrice'],
    ['totalTradeQuantity', 'totalTradeQuantity', 'totalTradeQuantity'],
    ['totalTradedQuantity', 'totalTradeQuantity', 'totalTradedQuantity'],
    ['totalTrades', 'totalTrades', 'totalTrades'],
    ['totalTradedValue', 'totalTradedValue', 'totalTradedValue'],
    ['fiftyTwoWeekHigh', 'fiftyTwoWeekHigh', null],
    ['fiftyTwoWeekLow', 'fiftyTwoWeekLow', null],
];

const resolveMergedValue = (sec, mcs, mcsField, secField) => {
    const secValue = secField ? sec[secField] : null;
    return mcs[mcsField] || secValue || 0;
};

function mergeOHLCData(sec, mcs) {
    const merged = { ...sec };
    for (const [targetField, mcsField, secField] of OHLC_MERGE_FIELDS) {
        merged[targetField] = resolveMergedValue(sec, mcs, mcsField, secField);
    }
    return merged;
}

/**
 * Enrich traded securities with OHLC data from per-security endpoint.
 * The bulk securityDailyTradeStat endpoint lacks openPrice/highPrice/lowPrice,
 * so we fetch them from /api/nots/security/{id} for each traded stock.
 *
 * @param {Array} securities - Array of raw security objects from trade stat (must have securityId)
 * @param {string} token - NEPSE API auth token
 * @param {Object} deps - { nepseAxios, BASE_URL, nepseHttpsAgent, createHeaders }
 * @returns {Array} Securities with OHLC fields populated
 */
const enrichWithOHLC = async (securities, token, deps) => {
    if (!securities || securities.length === 0) return securities;

    const headers = deps.createHeaders(token);
    const startTime = Date.now();

    logger.info(`OHLC Enrichment: Fetching detail for ${securities.length} traded stocks...`);

    const detailMap = await fetchSecurityDetails(securities, deps, headers);

    let enriched = 0;
    const result = securities.map(sec => {
        const mcs = detailMap.get(sec.symbol);
        if (!mcs) return sec;

        enriched++;
        return mergeOHLCData(sec, mcs);
    });

    const duration = Date.now() - startTime;
    logger.info(`OHLC Enrichment: Enriched ${enriched}/${securities.length} stocks in ${duration}ms`);

    return result;
};

module.exports = {
    fetchMissingSecurities,
    enrichWithOHLC
};
