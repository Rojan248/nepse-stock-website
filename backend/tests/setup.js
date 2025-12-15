// Test environment setup
require('dotenv').config({ path: '.env.test' });

// Increase timeout for async operations
jest.setTimeout(30000);

// Global test utilities
global.testUtils = {
    mockStock: {
        symbol: 'TEST',
        companyName: 'Test Company Limited',
        sector: 'Banking',
        prices: { open: 100, high: 110, low: 95, close: 105, ltp: 105 },
        volume: 10000,
        turnover: 1050000,
        noOfTransactions: 50,
        change: 5,
        changePercent: 5.0,
        previousClose: 100,
        marketCap: 10000000000,
        timestamp: new Date()
    },
    mockIPO: {
        companyName: 'Test IPO Company',
        sector: 'Hydropower',
        shareManager: 'Test Share Manager',
        issueManager: 'Test Issue Manager',
        priceRange: { min: 100, max: 100 },
        totalShares: 1000000,
        status: 'upcoming',
        dates: {
            announcement: new Date(),
            applicationOpen: new Date(Date.now() + 86400000),
            applicationClose: new Date(Date.now() + 86400000 * 7)
        },
        minimumShares: 10,
        maximumShares: 500,
        timestamp: new Date()
    },
    mockMarketSummary: {
        indexValue: 2500.50,
        indexChange: 25.30,
        indexChangePercent: 1.02,
        totalTransactions: 50000,
        totalTurnover: 5000000000,
        totalVolume: 15000000,
        activeCompanies: 200,
        advancedCompanies: 120,
        declinedCompanies: 60,
        unchangedCompanies: 20,
        timestamp: new Date()
    }
};

// Cleanup after all tests
afterAll(async () => {
    // Close any open connections
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
    }
});
