/**
 * Final cleanup - remove ALL bonds, debentures, and mutual funds
 * Uses the official unified Filter to avoid false positives (like RURU)
 */

const { isEquitySecurity } = require('./src/services/utils/securityFilters');
const { prisma } = require('./src/services/database/connection');

async function finalCleanup() {
    console.log('=== Final Cleanup (Unified Filter) ===\n');

    try {
        const allStocks = await prisma.stock.findMany({
            select: { symbol: true, companyName: true, sector: true }
        });

        console.log(`Current total: ${allStocks.length}\n`);

        const toRemove = allStocks.filter(s => !isEquitySecurity(s));

        console.log(`Found ${toRemove.length} non-equity securities to remove:`);
        toRemove.forEach(s => console.log(`  ${s.symbol}: ${s.companyName} (${s.sector})`));

        if (toRemove.length > 0) {
            const symbols = toRemove.map(s => s.symbol);
            const result = await prisma.stock.deleteMany({
                where: { symbol: { in: symbols } }
            });
            console.log(`\nDeleted: ${result.count}`);
        } else {
            console.log('\nNothing to delete.');
        }

        const remaining = await prisma.stock.count();
        console.log(`\n=== FINAL COUNT: ${remaining} stocks ===`);

        await prisma.$disconnect();
    } catch (error) {
        console.error('Error:', error.message);
        await prisma.$disconnect();
    }
}

finalCleanup();
