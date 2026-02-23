/**
 * API Fetchers
 * Individual API source fetching logic extracted from proxyFetcher
 */

const axios = require('axios');
const https = require('https');
const cheerio = require('cheerio');
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
    httpsAgent,
    headers: { ...HEADERS.default, ...customHeaders }
});

/**
 * Fetch from NepAlpha API - Primary NEPSE data source
 * @returns {Promise<Object|null>} Standardized data or null
 */
const fetchFromNepAlpha = async () => {
    try {
        const client = axios.create({
            timeout: TIMEOUT,
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
 * @returns {Promise<Object|null>} Standardized data or null
 */
const fetchFromShareSansar = async () => {
    try {
        const client = axios.create({
            timeout: TIMEOUT,
            headers: HEADERS.shareSansar
        });

        const response = await client.get('https://www.sharesansar.com/live-trading');

        if (response.data && typeof response.data === 'string') {
            const $ = cheerio.load(response.data);
            const rows = $('table tbody tr');

            if (rows.length > 0) {
                const stocks = [];
                rows.each((i, el) => {
                    const cells = $(el).find('td');
                    if (cells.length > 0) {
                        // ShareSansar table columns (as of 2026):
                        // 0:S.No | 1:Symbol | 2:LTP | 3:Point Change | 4:% Change | 5:Open | 6:High | 7:Low | 8:Volume | 9:Prev. Close
                        const rawItem = {
                            symbol: $(cells[1]).text().trim(),
                            ltp: $(cells[2]).text().replace(/,/g, '').trim(),
                            change: $(cells[3]).text().replace(/,/g, '').trim(),
                            percentChange: $(cells[4]).text().replace(/,/g, '').trim(),
                            open: $(cells[5]).text().replace(/,/g, '').trim(),
                            high: $(cells[6]).text().replace(/,/g, '').trim(),
                            low: $(cells[7]).text().replace(/,/g, '').trim(),
                            volume: $(cells[8]).text().replace(/,/g, '').trim(),
                            previousClose: $(cells[9]).text().replace(/,/g, '').trim()
                        };
                        if (rawItem.symbol && rawItem.ltp !== '') {
                            stocks.push(transformShareSansarStock(rawItem));
                        }
                    }
                });

                return {
                    stocks,
                    ipos: [],
                    marketSummary: null,
                    source: 'sharesansar',
                    timestamp: new Date().toISOString()
                };
            }
        }
    } catch (error) {
        logger.debug(`ShareSansar fetch failed: ${error.message}`);
    }
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
            let securities = response.data;
            if (securities.data) securities = securities.data;
            if (securities.securities) securities = securities.securities;
            if (securities.stocks) securities = securities.stocks;

            if (Array.isArray(securities) && securities.length > 0) {
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
