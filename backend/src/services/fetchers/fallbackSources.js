const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Fallback data sources for market transaction data
 * Each source scrapes HTML from financial websites when official NEPSE API is unavailable
 */

/**
 * Fetch transaction count from Merolagani
 * @returns {Promise<Object|null>} { totalTransactions, totalTurnover, totalVolume } or null
 */
const fetchFromMerolagani = async () => {
    try {
        const resp = await axios.get('https://merolagani.com/MarketSummary.aspx', {
            timeout: 5000,
            maxRedirects: 0,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' }
        });
        const html = resp.data || '';
        const match = html.match(/Total\s+Transactions(?:[^0-9<]*|[^0-9]*<[^>]+>[^0-9]*)+([0-9,]+)/i);

        if (match && match[1]) {
            const count = parseInt(match[1].replace(/,/g, ''), 10);
            if (!Number.isNaN(count) && count > 100) {
                logger.info(`Transaction Match Found (Merolagani): ${count}`);
                return { totalTransactions: count, totalTurnover: null, totalVolume: null };
            }
        }
    } catch (err) {
        logger.debug(`merolagani fallback failed: ${err.message}`);
    }

    return null;
};

/**
 * Fetch transaction count from NepseAlpha
 * @returns {Promise<Object|null>} { totalTransactions, totalTurnover, totalVolume } or null
 */
const fetchFromNepseAlpha = async () => {
    try {
        const alpha = await axios.get('https://nepsealpha.com/trading-menu', {
            timeout: 5000,
            maxRedirects: 0,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' }
        });
        const alphaMatch = alpha.data.match(/Transactions["']?\s*[:=]\s*["']?([0-9,]+)/i);

        if (alphaMatch && alphaMatch[1]) {
            const count = parseInt(alphaMatch[1].replace(/,/g, ''), 10);
            if (!Number.isNaN(count) && count > 100) {
                logger.info(`Transaction Match Found (NepseAlpha): ${count}`);
                return { totalTransactions: count, totalTurnover: null, totalVolume: null };
            }
        }
    } catch (err) {
        logger.debug(`nepsealpha fallback failed: ${err.message}`);
    }

    return null;
};

/**
 * Fetch transaction count from ShareSansar
 * @returns {Promise<Object|null>} { totalTransactions, totalTurnover, totalVolume } or null
 */
const fetchFromShareSansar = async () => {
    try {
        const ss = await axios.get('https://www.sharesansar.com/market', {
            timeout: 5000,
            maxRedirects: 0,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' }
        });
        const ssMatch = ss.data.match(/Total\s+Transactions(?:[^0-9<]*|[^0-9]*<[^>]+>[^0-9]*)+([0-9,]+)/i);

        if (ssMatch && ssMatch[1]) {
            const count = parseInt(ssMatch[1].replace(/,/g, ''), 10);
            if (!Number.isNaN(count) && count > 100) {
                logger.info(`Transaction Match Found (ShareSansar): ${count}`);
                return { totalTransactions: count, totalTurnover: null, totalVolume: null };
            }
        }
    } catch (err) {
        logger.debug(`sharesansar fallback failed: ${err.message}`);
    }

    return null;
};

/**
 * Try all fallback sources concurrently and return first successful result
 * @returns {Promise<Object|null>} Market data or null if all fail
 */
const tryFallbackSources = async () => {
    const fallbacks = [
        fetchFromMerolagani(),
        fetchFromNepseAlpha(),
        fetchFromShareSansar()
    ];

    try {
        const result = await Promise.any(
            fallbacks.map(p => p.then(res => {
                if (!res) throw new Error('No data');
                return res;
            }))
        );
        return result;
    } catch (aggregateError) {
        logger.debug('All fallback sources failed.');
        return null;
    }
};

module.exports = {
    fetchFromMerolagani,
    fetchFromNepseAlpha,
    fetchFromShareSansar,
    tryFallbackSources
};
