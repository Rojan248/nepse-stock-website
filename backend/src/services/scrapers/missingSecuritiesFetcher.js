/**
 * Fetch Missing Securities Logic & OHLC Enrichment
 * Extracted from libraryFetcher.js to reduce file complexity.
 * Also provides OHLC enrichment for traded stocks whose bulk endpoint
 * lacks openPrice/highPrice/lowPrice fields.
 */
const logger = require('../utils/logger');
const { CONCURRENCY_LIMIT } = require('./libraryConfig');

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
        const chunkPromises = chunk.map(async (item) => {
            const id = item.securityId || item.id;
            const symbol = item.symbol;
            try {
                const res = await deps.nepseAxios.get(`${deps.BASE_URL}/api/nots/security/${id}`, {
                    headers,
                    httpsAgent: deps.nepseHttpsAgent,
                    timeout: 8000
                });
                const data = res.data;
                if (data && data.securityMcsData) {
                    resultMap.set(symbol, data.securityMcsData);
                }
            } catch (error) {
                logger.debug(`Failed to fetch detail for ${symbol} (${id}): ${error.message}`);
            }
        });

        await Promise.all(chunkPromises);

        // delay between chunks to avoid NEPSE rate-limiting
        if (i + CONCURRENCY_LIMIT < items.length) {
            await new Promise(r => setTimeout(r, 300));
        }
    }

    return resultMap;
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
        const chunkPromises = chunk.map(async (company) => {
            try {
                const res = await deps.nepseAxios.get(`${deps.BASE_URL}/api/nots/security/${company.id}`, {
                    headers,
                    httpsAgent: deps.nepseHttpsAgent
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
        return {
            ...sec,
            openPrice: mcs.openPrice || sec.openPrice || 0,
            highPrice: mcs.highPrice || sec.highPrice || 0,
            lowPrice: mcs.lowPrice || sec.lowPrice || 0,
            totalTradeQuantity: mcs.totalTradeQuantity || sec.totalTradeQuantity || 0,
            totalTradedQuantity: mcs.totalTradeQuantity || sec.totalTradedQuantity || 0,
            totalTrades: mcs.totalTrades || sec.totalTrades || 0,
            totalTradedValue: mcs.totalTradedValue || sec.totalTradedValue || 0,
            fiftyTwoWeekHigh: mcs.fiftyTwoWeekHigh || 0,
            fiftyTwoWeekLow: mcs.fiftyTwoWeekLow || 0
        };
    });

    const duration = Date.now() - startTime;
    logger.info(`OHLC Enrichment: Enriched ${enriched}/${securities.length} stocks in ${duration}ms`);

    return result;
};

module.exports = {
    fetchMissingSecurities,
    enrichWithOHLC
};
