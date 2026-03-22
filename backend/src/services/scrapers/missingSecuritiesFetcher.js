/**
 * Fetch Missing Securities Logic
 * Extracted from libraryFetcher.js to reduce file complexity.
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
        totalTradeQuantity: mcs.totalTradeQuantity || 0,
        totalTradeValue: 0,
        totalTrades: mcs.totalTrades || 0,
        percentageChange: 0,
        lastUpdatedDateTime: mcs.lastUpdatedDateTime
    };
}

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

module.exports = {
    fetchMissingSecurities
};
