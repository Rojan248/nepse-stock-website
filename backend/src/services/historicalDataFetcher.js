/**
 * Historical Data Fetcher
 * Handles fetching data from previous trading days
 * Extracted from dataFetcher.js to separate live data concerns from historical data
 */

const axios = require('axios');
const https = require('https');
const logger = require('./utils/logger');

const PREVIOUS_TRADING_DAY_TIMEOUT_MS = 10000;

const createNepseHttpsAgent = () => new https.Agent({ keepAlive: true });

const buildPreviousTradingDayRequestOptions = (headers) => ({
    headers,
    httpsAgent: createNepseHttpsAgent(),
    timeout: PREVIOUS_TRADING_DAY_TIMEOUT_MS,
    maxRedirects: 0
});

/**
 * Fetch data from the previous trading day (Security Daily Trade Stat)
 * Useful for correcting zeroed-out data on weekends/holidays
 * @returns {Object|null} Previous day's market breadth or null
 */
const fetchPreviousTradingDayData = async () => {
    try {
        logger.info('Fetching previous trading day data (SecurityDailyTradeStat)...');
        const nepseModule = await import('nepse-api-helper');
        const nepseClient = nepseModule.nepseClient;
        const createHeaders = nepseModule.createHeaders;
        
        await nepseClient.initialize({ useWasm: true });
        const token = await nepseClient.getToken();

        const headers = { ...createHeaders(token), 'Referer': 'https://www.nepalstock.com.np/' };

        // Fetch securityDailyTradeStat (Index 58 is usually "All Scrips" or similar broad index)
        const url = 'https://www.nepalstock.com.np/api/nots/securityDailyTradeStat/58';
        
        const res = await axios.get(url, buildPreviousTradingDayRequestOptions(headers));
        const data = res.data;
        
        if (!Array.isArray(data) || data.length === 0) {
            logger.warn('No previous trading day data found');
            return null;
        }
        
        logger.info(`Fetched ${data.length} records from previous trading day.`);
        
        let advanced = 0;
        let declined = 0;
        let unchanged = 0;
        
        data.forEach(stock => {
            const diff = stock.difference || (stock.closePrice - stock.previousClose);
            if (diff > 0) advanced++;
            else if (diff < 0) declined++;
            else unchanged++;
        });
        
        return {
            advanced,
            declined,
            unchanged,
            totalTraded: data.length
        };

    } catch (e) {
        logger.error(`Error fetching previous trading day data: ${e.message}`);
        return null;
    }
};

module.exports = {
    fetchPreviousTradingDayData,
    __test__: {
        buildPreviousTradingDayRequestOptions,
        createNepseHttpsAgent
    }
};
