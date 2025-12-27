const NEPSE_STOCKS = require('../../data/nepseStocks');
const logger = require('../utils/logger');

/**
 * Mock Fetcher Service
 * Simulates real market data for development & weekend testing
 */

// Helper to generate realistic random price change
const generatePrice = (basePrice) => {
    // -2% to +2% fluctuation
    const fluctuation = (Math.random() * 0.04) - 0.02;
    return Math.round(basePrice * (1 + fluctuation) * 10) / 10;
};

const fetchData = async () => {
    logger.info('[MockFetcher] Generating weekend market data...');

    // Simulate network delay (500ms)
    await new Promise(resolve => setTimeout(resolve, 500));

    const today = new Date();

    // Generate stocks
    const stocks = NEPSE_STOCKS.map((stock, index) => {
        const basePrice = stock.base || 300; // fallback base price

        // Edge Case: Force one stock to have 0 price to test database shield
        if (index === 0) {
            return {
                symbol: stock.symbol,
                companyName: stock.name,
                sector: stock.sector,
                prices: { ltp: 0, previousClose: 0, change: 0, changePercent: 0, high: 0, low: 0, open: 0 },
                trading: { volume: 0, turnover: 0, totalTrades: 0 },
                timestamp: today.toISOString()
            };
        }

        const ltp = generatePrice(basePrice);
        const previousClose = basePrice;
        const change = ltp - previousClose;
        const changePercent = (change / previousClose) * 100;

        return {
            symbol: stock.symbol,
            companyName: stock.name,
            sector: stock.sector,
            prices: {
                ltp,
                previousClose,
                change: Math.round(change * 100) / 100,
                changePercent: Math.round(changePercent * 100) / 100,
                high: ltp * 1.01,
                low: ltp * 0.99,
                open: previousClose
            },
            trading: {
                volume: Math.floor(Math.random() * 50000),
                turnover: Math.floor(Math.random() * 10000000),
                totalTrades: Math.floor(Math.random() * 500)
            },
            timestamp: today.toISOString()
        };
    });

    // Generate Market Summary
    const marketSummary = {
        indexValue: 2000 + (Math.random() * 20 - 10),
        indexChange: Math.random() * 10 - 5,
        totalTurnover: stocks.reduce((acc, s) => acc + s.trading.turnover, 0),
        totalVolume: stocks.reduce((acc, s) => acc + s.trading.volume, 0),
        activeCompanies: stocks.length,
        timestamp: today.toISOString()
    };

    return {
        stocks,
        marketSummary,
        source: 'mock-weekend-mode',
        timestamp: today.toISOString()
    };
};

module.exports = {
    fetchData
};
