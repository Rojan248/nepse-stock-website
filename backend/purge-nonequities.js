require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { isEquitySecurity } = require('./src/services/utils/securityFilters');

async function cleanDB() {
    console.log('--- STARTING DB CLEANUP ---');
    try {
        const allStocks = await prisma.stock.findMany();
        let deletedCount = 0;

        console.log(`Analyzing ${allStocks.length} stocks currently in the database...`);

        for (const stock of allStocks) {
            // Apply our new strict filters
            const isEquity = isEquitySecurity({
                symbol: stock.symbol,
                companyName: stock.companyName,
                sectorName: stock.sector
            });

            // Also forcefully check sector strings that might have snuck in
            const strictSectorExclusion = stock.sector
                ? (stock.sector.toLowerCase().includes('others') ||
                    stock.sector.toLowerCase().includes('mutual fund') ||
                    stock.sector.toLowerCase().includes('bond') ||
                    stock.sector.toLowerCase().includes('debenture'))
                : false;

            if (!isEquity || strictSectorExclusion) {
                console.log(`[DELETING] Non-equity found: ${stock.symbol} (${stock.sector}) - ${stock.companyName}`);
                await prisma.stock.delete({ where: { id: stock.id } });
                deletedCount++;
            }
        }

        console.log(`\nCleanup Complete! Deleted ${deletedCount} non-equity stocks.`);
        const remaining = await prisma.stock.count();
        console.log(`Remaining stocks: ${remaining}`);
    } catch (e) {
        console.error('Cleanup error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

cleanDB();
