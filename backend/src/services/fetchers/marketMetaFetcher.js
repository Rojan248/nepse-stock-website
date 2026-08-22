const axios = require('axios');
const https = require('https');
const logger = require('../utils/logger');
const { getMarketState } = require('../utils/marketTime');
const {
    hasValidMarketMeta,
    parseMarketMetaResponse,
    extractTransactionFromHTML,
    MIN_PLAUSIBLE_TRANSACTIONS
} = require('../utils/marketDataHelpers');

/**
 * Pre-open matching legitimately produces tiny transaction counts,
 * so the plausibility floor is relaxed only for that state.
 */
const getMinPlausibleTransactions = () =>
    getMarketState() === 'PRE_OPEN' ? 10 : MIN_PLAUSIBLE_TRANSACTIONS;

// Live market meta endpoint (contains totalTransaction)
const MARKET_OPEN_URL = 'https://nepalstock.com.np/api/nots/nepse-data/market-open';
const MARKET_OPEN_ALT = 'https://nepalstock.com/api/nots/nepse-data/market-open';
const marketOpenClient = axios.create({
    timeout: 4000,
    maxRedirects: 0,
    httpsAgent: new https.Agent({ keepAlive: true }),
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': 'https://nepalstock.com.np/'
    }
});

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
        fetch: () => axios.get('https://merolagani.com/MarketSummary.aspx', { timeout: 5000, maxRedirects: 0, headers: SCRAPE_HEADERS }),
        parse: (resp) => extractTransactionFromHTML(resp.data, (msg) => logger.info(`Merolagani: ${msg}`), getMinPlausibleTransactions())
    },
    {
        name: 'nepsealpha',
        fetch: () => axios.get('https://nepsealpha.com/trading-menu', { timeout: 5000, maxRedirects: 0, headers: SCRAPE_HEADERS }),
        parse: (resp) => extractTransactionFromHTML(resp.data, (msg) => logger.info(`NepseAlpha: ${msg}`), getMinPlausibleTransactions())
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
        // Launch all requests in parallel — fastest successful response wins
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

/** Public helper mirroring the requested name */
const getTrueTransactionCount = async () => {
    const meta = await fetchLiveMarketMeta();
    return meta?.totalTransactions ?? 0;
};

module.exports = {
    fetchLiveMarketMeta,
    getTrueTransactionCount
};
