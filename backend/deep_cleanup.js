/**
 * Deep cleanup - remove ALL non-equity securities based on sector and symbol patterns
 */

async function deepCleanup() {
    console.log('=== Deep Cleanup - Remove All Non-Equity ===\n');

    const { prisma } = require('./src/services/database/connection');

    try {
        const allStocks = await prisma.stock.findMany({
            select: { symbol: true, companyName: true, sector: true }
        });

        console.log(`Current total: ${allStocks.length}\n`);

        // Sectors that are NOT equity
        const nonEquitySectors = [
            'Mutual Fund',
            'NEPSE Index',
            'Corporate Debenture'
        ];

        const toRemove = allStocks.filter(s => {
            const sector = (s.sector || '').toLowerCase();
            const symbol = (s.symbol || '').toUpperCase();
            const name = (s.companyName || '').toLowerCase();

            // Remove by sector
            if (nonEquitySectors.some(ns => sector === ns.toLowerCase())) return true;
            if (sector.includes('index')) return true;

            // Remove bonds/debentures by name
            if (name.includes('bond')) return true;
            if (name.includes('debenture')) return true;
            if (name.includes('rinpatra')) return true;

            // Remove mutual funds by name
            if (name.includes('mutual fund')) return true;
            if (name.includes('equity fund')) return true;
            if (name.includes('growth fund')) return true;
            if (name.includes('balanced fund')) return true;
            if (name.includes(' kosh')) return true;
            if (/\b(fund|scheme)\b/i.test(name) && !name.includes('hydropower')) return true;

            // Remove by symbol patterns
            if (/B\d{2,4}$/.test(symbol)) return true;  // Bonds
            if (/D\d{2,4}$/.test(symbol)) return true;  // Debentures
            if (/\d{2}[_/]\d{2}/.test(symbol)) return true;  // Double-year patterns
            if (symbol.endsWith('PO')) return true;  // Promoter shares

            return false;
        });

        console.log(`Found ${toRemove.length} non-equity securities to remove:\n`);

        // Group by sector
        const bySector = {};
        toRemove.forEach(s => {
            const sec = s.sector || 'Unknown';
            bySector[sec] = bySector[sec] || [];
            bySector[sec].push(s.symbol);
        });

        Object.entries(bySector).forEach(([sector, symbols]) => {
            console.log(`${sector}:`);
            symbols.forEach(sym => console.log(`  - ${sym}`));
        });

        if (toRemove.length > 0) {
            const symbols = toRemove.map(s => s.symbol);
            const result = await prisma.stock.deleteMany({
                where: { symbol: { in: symbols } }
            });
            console.log(`\nDeleted: ${result.count}`);
        }

        // Get final sector breakdown
        const remaining = await prisma.stock.findMany({
            select: { sector: true }
        });

        const sectorCount = {};
        remaining.forEach(s => {
            const sec = s.sector || 'Unknown';
            sectorCount[sec] = (sectorCount[sec] || 0) + 1;
        });

        console.log(`\n=== FINAL BREAKDOWN (${remaining.length} stocks) ===`);
        Object.entries(sectorCount)
            .sort((a, b) => b[1] - a[1])
            .forEach(([sec, count]) => {
                console.log(`  ${sec}: ${count}`);
            });

        await prisma.$disconnect();
        return { removed: toRemove.length, remaining: remaining.length, sectorCount };

    } catch (error) {
        console.error('Error:', error.message);
        await prisma.$disconnect();
        return null;
    }
}

deepCleanup();
