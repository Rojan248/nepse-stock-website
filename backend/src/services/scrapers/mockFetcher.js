/**
 * Mock Data Fetcher
 * Provides mock/development data for testing
 * Only used in development environment
 */

const logger = require('../utils/logger');

/**
 * Fetch mock stock data for development/testing
 * @returns {Object|null} Mock data or null if disabled
 */
const fetchData = async () => {
    // Returns null in production - mock data is disabled by default
    if (process.env.NODE_ENV !== 'development' || !process.env.USE_MOCK_DATA) {
        return null;
    }

    logger.debug('Mock fetcher: Providing development data');

    // Return minimal mock data structure
    return {
        stocks: [],
        marketSummary: null,
        source: 'mock',
        timestamp: new Date().toISOString()
    };
};

module.exports = {
    fetchData
};
