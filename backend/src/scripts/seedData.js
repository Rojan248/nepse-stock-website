/**
 * Seed Data Script (Local Storage Version)
 * Populates local JSON storage with extensive dummy data
 * Usage: node src/scripts/seedData.js
 */

const { initializeLocalStorage, stockOps, marketOps, ipoOps, saveAllData } = require('../services/database/localStorage');

// Import Data
const NEPSE_STOCKS = require('../data/nepseStocks');

// Helper to generate random number in range
const random = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min, max) => parseFloat((Math.random() * (max - min) + min).toFixed(2));

const seedData = async () => {
    try {
        console.log('Initializing Local Storage...');
        initializeLocalStorage();

        // 0. Clean up existing stocks (Delete all)
        console.log('Cleaning up existing stocks...');
        stockOps.clearAllStocks();
        console.log('Deleted old stock records.');

        // 1. Seed Stocks
        console.log(`Seeding ${NEPSE_STOCKS.length} Real NEPSE Stocks...`);
        const stocks = [];

        // Generate stock data for each base stock
        NEPSE_STOCKS.forEach(base => {
            stocks.push(generateStock(base));
        });

        function generateStock(base) {
            // Generate a random target percentage first
            const targetPercent = randomFloat(-5, 5);

            // Calculate change value and round to 1 decimal place (standard tick)
            // Note: LTP = Base + Change
            const change = parseFloat((base.base * (targetPercent / 100)).toFixed(1));

            // Recalculate the exact percentage based on the rounded change
            // This ensures displayed % matches the math: (Change / Base) * 100
            const changePercent = base.base === 0 ? 0 : parseFloat(((change / base.base) * 100).toFixed(2));

            const ltp = parseFloat((base.base + change).toFixed(1));

            // Generate valid OHLC data consistent with LTP
            // Open: usually close to base/prevClose
            const open = parseFloat((base.base * (1 + randomFloat(-0.02, 0.02))).toFixed(1));

            // High/Low must bound the Open and LTP
            const price1 = open;
            const price2 = ltp;
            const fluctuation = base.base * randomFloat(0.01, 0.04);

            const high = parseFloat((Math.max(price1, price2) + Math.abs(fluctuation)).toFixed(1));
            const low = parseFloat((Math.min(price1, price2) - Math.abs(fluctuation / 2)).toFixed(1));

            return {
                symbol: base.symbol,
                companyName: base.name,
                sector: base.sector,
                ltp: ltp,
                change: change,
                changePercent: changePercent,
                open: open,
                high: Math.max(high, ltp, open), // Safety check
                low: Math.min(low, ltp, open),   // Safety check
                close: base.base,
                volume: random(1000, 100000),
                turnover: 0 // Calculated later
            };
        }

        // Calculate total stats
        let totalTurnover = 0;
        let totalVolume = 0;
        let active = 0, advanced = 0, declined = 0, unchanged = 0;

        stocks.forEach(stock => {
            stock.turnover = Math.floor(stock.volume * stock.ltp);
            totalTurnover += stock.turnover;
            totalVolume += stock.volume;

            if (stock.change > 0) advanced++;
            else if (stock.change < 0) declined++;
            else unchanged++;
            active++;
        });

        // Save all stocks
        stockOps.saveStocks(stocks);
        console.log(`Saved ${stocks.length} stocks to local storage.`);

        // 2. Seed Market Summary
        console.log('Seeding Market Summary...');
        marketOps.saveMarketSummary({
            indexValue: 2045.67,
            indexChange: 12.45,
            indexChangePercent: 0.61,
            totalTurnover: totalTurnover,
            totalVolume: totalVolume,
            totalTransactions: random(40000, 60000),
            activeCompanies: active,
            advancedCompanies: advanced,
            declinedCompanies: declined,
            unchangedCompanies: unchanged,
            status: 'OPEN'
        });
        console.log('Saved market summary.');

        // 3. Seed IPOs
        console.log('Seeding IPOs...');
        const ipos = [
            {
                companyName: 'Sarbottam Cement Limited',
                sector: 'Manufacturing',
                status: 'open',
                priceRange: { min: 360.90, max: 360.90 },
                dates: {
                    announcement: '2023-12-01',
                    open: '2024-01-25',
                    close: '2024-01-29'
                },
                issueManager: 'Global IME Capital',
                shareManager: 'Global IME Capital',
                totalShares: 2000000,
                subscriptionRatio: 1.5
            },
            {
                companyName: 'Reliable Life Insurance',
                sector: 'Life Insurance',
                status: 'upcoming',
                priceRange: { min: 257, max: 257 },
                dates: {
                    announcement: '2024-02-15',
                    open: '2024-03-01'
                },
                issueManager: 'Civil Capital',
                totalShares: 6000000
            }
        ];

        // Save all IPOs
        ipoOps.saveIPOs(ipos);
        console.log(`Saved ${ipos.length} IPOs.`);

        // Force immediate save to disk
        saveAllData();

        console.log('Data seeding completed! ✅');
        process.exit(0);
    } catch (error) {
        console.error(`Error seeding data: ${error.message}`);
        process.exit(1);
    }
};

seedData();
