require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const dataFetcher = require('./src/services/dataFetcher');
const depthFetcher = require('./src/services/depthFetcher');
const logger = require('./src/services/utils/logger');

async function validateDbAndFetcher() {
    console.log('--- STARTING VALIDATION ---');
    try {
        // 1. Check DB Data
        console.log('\n>>> Database Check:');
        const stockCount = await prisma.stock.count();
        console.log(`Total Stocks in DB: ${stockCount}`);

        const latestSummary = await prisma.marketSummary.findFirst({ orderBy: { timestamp: 'desc' } });
        console.log('Latest Market Summary in DB:', latestSummary);

        const someStocks = await prisma.stock.findMany({ take: 3 });
        console.log('Sample Stocks from DB:');
        someStocks.forEach(s => {
            console.log(`  - ${s.symbol}: ${s.companyName}, LTP: ${s.lastTradedPrice}, Change: ${s.percentageChange}%`);
        });

        // 2. Check Fetcher Data (Official/Live)
        console.log('\n>>> Fetcher Check (Live Data):');
        // Force production environment to avoid mock data
        process.env.NODE_ENV = 'production';
        process.env.USE_MOCK_DATA = 'false';

        console.log('Running fetchLatestData()...');
        const liveData = await dataFetcher.fetchLatestData();
        if (liveData) {
            console.log(`Fetched ${liveData.stocks ? liveData.stocks.length : 0} stocks live.`);
            console.log('Live Market Summary:', liveData.marketSummary);
            if (liveData.stocks && liveData.stocks.length > 0) {
                const sampleLive = liveData.stocks.slice(0, 3);
                console.log('Sample Live Stock [0]:', JSON.stringify(liveData.stocks[0], null, 2));
            }
        } else {
            console.warn('fetchLatestData() returned null or failed.');
        }

        console.log('\n>>> Depth Fetcher Check:');
        // Test with a known active symbol, e.g., 'NABIL' or 'NICA'
        const symbolToTest = 'NICA';
        console.log(`Fetching market depth for ${symbolToTest}...`);
        const depth = await depthFetcher.getDepth(symbolToTest);
        console.log(`Depth for ${symbolToTest}:`, JSON.stringify(depth, null, 2));

        console.log('\n--- VALIDATION COMPLETE ---');
    } catch (e) {
        console.error('Validation Script Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

validateDbAndFetcher();
