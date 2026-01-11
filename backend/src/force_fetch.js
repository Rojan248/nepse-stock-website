const dataFetcher = require('./services/dataFetcher');
const stockOperations = require('./services/database/stockOperations');
const marketOperations = require('./services/database/marketOperations');
const ipoOperations = require('./services/database/ipoOperations');
const { prisma } = require('./services/database/connection');
const logger = require('./services/utils/logger');

async function main() {
    try {
        console.log('Force fetching data...');
        const data = await dataFetcher.fetchLatestData();

        if (!data) {
            console.error('No data received');
            return;
        }

        console.log(`Received ${data.stocks.length} stocks from ${data.source}`);

        // Save stocks
        if (data.stocks && data.stocks.length > 0) {
            await stockOperations.saveStocks(data.stocks);
            console.log('Stocks saved.');
        }

        // Save IPOs
        if (data.ipos && data.ipos.length > 0) {
            await ipoOperations.saveIPOs(data.ipos);
            console.log('IPOs saved.');
        }

        // Save market summary
        if (data.marketSummary) {
            await marketOperations.upsertMarketSummary(data.marketSummary);
            console.log('Market summary saved.');
        }

        console.log('Update complete.');

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
