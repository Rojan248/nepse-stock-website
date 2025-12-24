const nepseStocks = require('../../data/nepseStocks');
const logger = require('../utils/logger');

// Cache base prices to allow realistic trends during a session
const basePrices = new Map();

/**
 * Get formatted time HH:mm:ss
 */
const getTime = () => {
    const now = new Date();
    return now.toTimeString().split(' ')[0];
};

function getRandomFluctuation(price) {
    // Fluctuate between -2% and +2%
    const percent = (Math.random() * 4 - 2) / 100;
    return parseFloat((price + (price * percent)).toFixed(1));
}

async function fetchData() {
    logger.info("⚠️ [MockFetcher] Generating simulation data...");

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const stocks = nepseStocks.map(stock => {
        // Initialize base price if not exists
        if (!basePrices.has(stock.symbol)) {
            // Random price between 100 and 3000
            const randomPrice = Math.floor(Math.random() * 2900) + 100;
            basePrices.set(stock.symbol, randomPrice);
        }

        const basePrice = basePrices.get(stock.symbol);
        const newPrice = getRandomFluctuation(basePrice);

        // Update base price slightly to create trends (optional, but keeps it drifting)
        // basePrices.set(stock.symbol, newPrice); 

        const change = parseFloat((newPrice - basePrice).toFixed(1));
        const pChange = parseFloat(((newPrice - basePrice) / basePrice * 100).toFixed(2));

        return {
            symbol: stock.symbol,
            companyName: stock.name,
            sector: stock.sector || "Others",
            ltp: newPrice,
            change: change,
            changePercent: pChange,
            open: basePrice,
            high: Math.max(basePrice, newPrice),
            low: Math.min(basePrice, newPrice),
            volume: Math.floor(Math.random() * 5000) + 100,
            turnover: newPrice * (Math.floor(Math.random() * 1000) + 10),
            status: "Active",
            timestamp: new Date().toISOString()
        };
    });

    return {
        source: 'mock',
        timestamp: new Date().toISOString(),
        stocks: stocks,
        marketSummary: {
            totalTurnover: stocks.reduce((acc, s) => acc + (s.turnover || 0), 0),
            totalVolume: stocks.reduce((acc, s) => acc + (s.volume || 0), 0),
            totalTransactions: Math.floor(Math.random() * 50000) + 10000,
            indexValue: 2000 + (Math.random() * 50 - 25), // Mock index around 2000
            indexChange: (Math.random() * 10) - 5,
            indexChangePercent: (Math.random() * 0.5) - 0.25,
            timestamp: new Date().toISOString()
        }
    };
}

module.exports = { fetchData };
