/**
 * Update Filebase Utility
 * Manually fetches the latest NEPSE data and updates local JSON files.
 * Usage: node update_filebase.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const logger = require('./src/services/utils/logger');
const dataFetcher = require('./src/services/dataFetcher');
const { initializeLocalStorage, saveAllData } = require('./src/services/database/localStorage');
const stockOperations = require('./src/services/database/stockOperations');
const ipoOperations = require('./src/services/database/ipoOperations');
const marketOperations = require('./src/services/database/marketOperations');
const { initTimeSync } = require('./src/services/utils/marketTime');

async function updateFilebase() {
    console.log('--- Starting Local Filebase Update ---');

    try {
        // 1. Initialize logic
        console.log('Initializing local storage and time sync...');
        initializeLocalStorage();
        await initTimeSync();

        // 2. Fetch data
        console.log('Fetching latest data from NEPSE API (Library -> Proxy -> Custom)...');
        const data = await dataFetcher.fetchLatestData();

        if (!data) {
            console.error('❌ Failed to fetch data from any source.');
            process.exit(1);
        }

        console.log(`✓ Data fetched successfully from: ${data.source}`);

        // 3. Save Stocks
        if (data.stocks && data.stocks.length > 0) {
            console.log(`Saving ${data.stocks.length} stocks...`);
            await stockOperations.saveStocks(data.stocks);
        }

        // 4. Save IPOs
        if (data.ipos && data.ipos.length > 0) {
            console.log(`Saving ${data.ipos.length} IPOs...`);
            await ipoOperations.saveIPOs(data.ipos);
        }

        // 5. Save Market Summary
        if (data.marketSummary) {
            console.log('Saving market summary...');
            await marketOperations.upsertMarketSummary(data.marketSummary);
        }

        // 6. Save Top Movers
        if (data.topTurnover || data.topTrades || data.topVolume || data.topGainers || data.topLosers) {
            console.log('Saving top movers data...');
            await marketOperations.saveTopMovers(
                data.topTurnover,
                data.topTrades,
                data.topVolume,
                data.topGainers,
                data.topLosers
            );
        }

        // 7. Force save to disk
        console.log('Persisting changes to JSON files...');
        saveAllData();

        console.log('--- Filebase Update Completed Successfully! ✅ ---');
        process.exit(0);

    } catch (error) {
        console.error(`❌ Unexpected error during update: ${error.message}`);
        console.error(error.stack);
        process.exit(1);
    }
}

updateFilebase();
