/**
 * Proxy-based NEPSE Data Fetcher
 * Uses multiple NEPSE data API sources with fallback
 * Refactored: Configuration, transformers, and fetchers extracted to separate modules
 */

const logger = require('../utils/logger');
const { API_SOURCES, IPO_ENDPOINTS } = require('./proxyConfig');
const { transformIPO } = require('./apiTransformers');
const {
    createClient,
    fetchFromNepAlpha,
    fetchFromShareSansar,
    fetchMarketSummaryFromSource,
    fetchStocksFromSource,
    isStaleData
} = require('./apiFetchers');

/**
 * Fetch all data from multiple proxy sources
 * @returns {Object|null} Standardized data object or null on failure
 */
const fetchData = async () => {
    try {
        logger.info('Fetching data using proxy fetcher...');

        // Try primary sources first
        const nepalphaData = await fetchFromNepAlpha();
        if (nepalphaData?.stocks?.length > 0) {
            logger.info(`Proxy fetcher: Retrieved ${nepalphaData.stocks.length} stocks from NepAlpha`);
            return nepalphaData;
        }

        const shareSansarData = await fetchFromShareSansar();
        if (shareSansarData?.stocks?.length > 0) {
            logger.info(`Proxy fetcher: Retrieved ${shareSansarData.stocks.length} stocks from ShareSansar`);
            return shareSansarData;
        }

        // Try generic API sources
        return await tryGenericSources();

    } catch (error) {
        logger.error(`Proxy fetcher error: ${error.message}`);
        return null;
    }
};

/**
 * Try fetching from generic API sources
 * @returns {Object|null} Data object or null
 */
const tryGenericSources = async () => {
    for (const source of API_SOURCES) {
        try {
            const client = createClient(source.baseUrl);
            const [marketData, stocksData] = await Promise.all([
                fetchMarketSummaryFromSource(client, source),
                fetchStocksFromSource(client, source)
            ]);

            if (stocksData?.length > 0) {
                // Check for stale data
                if (isStaleData(marketData)) {
                    logger.warn(`Stale data detected from ${source.name}`);
                    continue;
                }

                logger.info(`Proxy fetcher: Retrieved ${stocksData.length} stocks from ${source.name}`);
                return {
                    stocks: stocksData,
                    ipos: [],
                    marketSummary: marketData,
                    source: `proxy-${source.name}`,
                    timestamp: new Date().toISOString()
                };
            }
        } catch (sourceError) {
            logger.debug(`${source.name} failed: ${sourceError.message}`);
        }
    }

    logger.warn('Proxy fetcher: No data received from any source');
    return null;
};

/**
 * Fetch IPO representations from a single proxy source across multiple endpoints
 * @param {Object} source - The source config
 * @returns {Promise<Array|null>} Mapped IPO array or null
 */
const fetchIPOFromSource = async (source) => {
    const client = createClient(source.baseUrl);

    for (const endpoint of IPO_ENDPOINTS) {
        try {
            const response = await client.get(endpoint);

            if (response.data) {
                let ipos = response.data;
                if (ipos.data) ipos = ipos.data;
                if (ipos.ipos) ipos = ipos.ipos;

                if (Array.isArray(ipos) && ipos.length > 0) {
                    logger.info(`Fetched ${ipos.length} IPOs from ${source.name}`);
                    return ipos.map(transformIPO);
                }
            }
        } catch (error) {
            logger.debug(`IPO endpoint ${endpoint} on ${source.name} failed: ${error.message}`);
        }
    }
    return null;
};

/**
 * Fetch IPOs from proxy sources
 * @returns {Promise<Array>} Array of IPO objects
 */
const fetchIPOs = async () => {
    for (const source of API_SOURCES) {
        const ipos = await fetchIPOFromSource(source);
        if (ipos) {
            return ipos;
        }
    }

    return [];
};

module.exports = {
    fetchData,
    fetchIPOs
};
