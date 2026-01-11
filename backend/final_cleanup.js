/**
 * Final cleanup - remove ALL bonds, debentures, and mutual funds
 * Then force a fresh data fetch
 */

async function finalCleanup() {
    console.log('=== Final Cleanup ===\n');

    const { prisma } = require('./src/services/database/connection');

    try {
        // Get all stocks
        const allStocks = await prisma.stock.findMany({
            select: { symbol: true, companyName: true, sector: true }
        });

        console.log(`Current total: ${allStocks.length}\n`);

        // Find non-equity by name patterns
        const toRemove = allStocks.filter(s => {
            const name = (s.companyName || '').toLowerCase();
            const symbol = (s.symbol || '').toUpperCase();
            const sector = (s.sector || '').toLowerCase();

            // Bonds and Debentures
            if (name.includes('bond')) return true;
            if (name.includes('debenture')) return true;
            if (name.includes('rinpatra')) return true;

            // Mutual Funds
            if (sector === 'mutual fund') return true;
            if (name.includes('mutual fund')) return true;
            if (name.includes('equity fund')) return true;
            if (name.includes('growth fund')) return true;
            if (name.includes('balanced fund')) return true;
            if (name.includes('yojana') && !name.includes('hydropower') && !name.includes('hydro power')) return true;

            // Specific fund patterns
            if (/\b(fund|scheme|kosh)\b/i.test(name)) return true;

            return false;
        });

        console.log(`Found ${toRemove.length} non-equity securities to remove:`);
        toRemove.forEach(s => console.log(`  ${s.symbol}: ${s.companyName}`));

        if (toRemove.length > 0) {
            const symbols = toRemove.map(s => s.symbol);
            const result = await prisma.stock.deleteMany({
                where: { symbol: { in: symbols } }
            });
            console.log(`\nDeleted: ${result.count}`);
        }

        const remaining = await prisma.stock.count();
        console.log(`\n=== FINAL COUNT: ${remaining} stocks ===`);

        await prisma.$disconnect();
        return { removed: toRemove.length, remaining };

    } catch (error) {
        console.error('Error:', error.message);
        await prisma.$disconnect();
        return null;
    }
}

finalCleanup().then(r => {
    if (r) console.log(JSON.stringify(r, null, 2));
});
