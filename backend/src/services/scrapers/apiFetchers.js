/**
 * API Fetchers
 * Individual API source fetching logic extracted from proxyFetcher
 */

const axios = require('axios');
const https = require('https');
const logger = require('../utils/logger');
const { TIMEOUT, HEADERS } = require('./proxyConfig');
const { transformNepAlphaStock, transformShareSansarStock, transformMarketSummary, transformStock } = require('./apiTransformers');

// Shared Keep-Alive Agent for performance
const httpsAgent = new https.Agent({ keepAlive: true });

/**
 * Create axios instance with standard config
 * @param {string} baseURL - Base URL for the client
 * @param {Object} customHeaders - Optional custom headers
 * @returns {AxiosInstance} Configured axios instance
 */
const createClient = (baseURL, customHeaders = {}) => axios.create({
    baseURL,
    timeout: TIMEOUT,
    maxRedirects: 0,
    httpsAgent,
    headers: { ...HEADERS.default, ...customHeaders }
});

// ShareSansar Parsing routines disabled due to WAF HTML restrictions.

/**
 * Extract array of securities from different possible response structures
 * @param {Object} data - The API response data
 * @returns {Array|null} Array of securities or null
 */
const extractSecuritiesArray = (data) => {
    let securities = data;
    if (securities.data) securities = securities.data;
    if (securities.securities) securities = securities.securities;
    if (securities.stocks) securities = securities.stocks;
    return Array.isArray(securities) ? securities : null;
};

/**
 * Fetch from NepAlpha API - Primary NEPSE data source
 * @returns {Promise<Object|null>} Standardized data or null
 */
const fetchFromNepAlpha = async () => {
    try {
        const client = axios.create({
            timeout: TIMEOUT,
            maxRedirects: 0,
            headers: HEADERS.nepAlpha
        });

        const response = await client.get('https://nepalstock.com.np/api/nots/nepse-data/today-price');

        if (response.data && Array.isArray(response.data)) {
            const stocks = response.data.map(transformNepAlphaStock);
            return {
                stocks,
                ipos: [],
                marketSummary: null,
                source: 'nepalpha',
                timestamp: new Date().toISOString()
            };
        }
    } catch (error) {
        logger.debug(`NepAlpha fetch failed: ${error.message}`);
    }
    return null;
};

/**
 * Fetch from ShareSansar API
 * Disabled to remove Cheerio dependencies.
 * @returns {Promise<Object|null>} Standardized data or null
 */
const fetchFromShareSansar = async () => {
    logger.debug(`ShareSansar fetch disabled due to DOM restrictions.`);
    return null;
};

/**
 * Fetch market summary from a specific source
 * @param {AxiosInstance} client - Configured axios client
 * @param {Object} source - Source configuration object
 * @returns {Promise<Object|null>} Market summary or null
 */
const fetchMarketSummaryFromSource = async (client, source) => {
    try {
        const response = await client.get(source.marketEndpoint);
        if (response.data) {
            return transformMarketSummary(response.data);
        }
    } catch (error) {
        logger.debug(`Market summary fetch from ${source.name} failed: ${error.message}`);
    }
    return null;
};

/**
 * Fetch stocks from a specific source
 * @param {AxiosInstance} client - Configured axios client
 * @param {Object} source - Source configuration object
 * @returns {Promise<Array>} Array of transformed stocks
 */
const fetchStocksFromSource = async (client, source) => {
    try {
        const response = await client.get(source.stocksEndpoint);

        if (response.data) {
            const securities = extractSecuritiesArray(response.data);
            if (securities && securities.length > 0) {
                return securities.map(transformStock);
            }
        }
    } catch (error) {
        logger.debug(`Stocks fetch from ${source.name} failed: ${error.message}`);
    }
    return [];
};

/**
 * Check if data is stale (not from today in Nepal Time)
 * @param {Object} marketData - Market data with timestamp
 * @returns {boolean} True if data is stale
 */
const isStaleData = (marketData) => {
    if (!marketData || !marketData.timestamp) return false;

    const now = new Date();
    const nptOffset = 5.75 * 60 * 60 * 1000; // GMT+5:45
    const nptDate = new Date(now.getTime() + nptOffset).toISOString().split('T')[0];
    const sourceDate = marketData.timestamp.split('T')[0];

    return sourceDate !== nptDate;
};

module.exports = {
    createClient,
    fetchFromNepAlpha,
    fetchFromShareSansar,
    fetchMarketSummaryFromSource,
    fetchStocksFromSource,
    isStaleData
};
