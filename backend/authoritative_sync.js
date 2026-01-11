/**
 * Authoritative sync with official NEPSE company list
 * ONLY keeps stocks that are:
 * 1. In the official company list
 * 2. Status = 'A' (Active)
 * 3. instrumentType = 'Equity'
 */

const fs = require('fs');

async function authoritativeSync() {
    console.log('=== Authoritative NEPSE Sync ===\n');

    const { prisma } = require('./src/services/database/connection');

    try {
        // Load official company list
        const officialData = JSON.parse(fs.readFileSync('./official_companies.json', 'utf-8'));

        // Filter to Active Equity only
        const validCompanies = officialData.filter(c =>
            c.status === 'A' &&
            c.instrumentType === 'Equity'
        );

        const validSymbols = new Set(validCompanies.map(c => c.symbol));

        console.log(`Official Active Equity companies: ${validSymbols.size}`);
        console.log('By Sector:');

        const bySector = {};
        validCompanies.forEach(c => {
            bySector[c.sectorName] = (bySector[c.sectorName] || 0) + 1;
        });
        Object.entries(bySector).sort((a, b) => b[1] - a[1]).forEach(([s, c]) => {
            console.log(`  ${s}: ${c}`);
        });

        // Get current DB stocks
        const dbStocks = await prisma.stock.findMany({
            select: { symbol: true, sector: true }
        });
        const dbSymbols = new Set(dbStocks.map(s => s.symbol));

        console.log(`\nCurrent DB stocks: ${dbSymbols.size}\n`);

        // Find discrepancies
        const toRemove = [...dbSymbols].filter(s => !validSymbols.has(s));
        const missing = [...validSymbols].filter(s => !dbSymbols.has(s));

        console.log(`To REMOVE (in DB but not Active Equity): ${toRemove.length}`);
        if (toRemove.length > 0) {
            console.log(toRemove.join(', '));
        }

        console.log(`\nMISSING (Active Equity not in DB): ${missing.length}`);
        if (missing.length > 0 && missing.length <= 50) {
            console.log(missing.join(', '));
        }

        // Remove non-official stocks
        if (toRemove.length > 0) {
            const result = await prisma.stock.deleteMany({
                where: { symbol: { in: toRemove } }
            });
            console.log(`\nDeleted ${result.count} non-official stocks`);
        }

        const remaining = await prisma.stock.count();
        console.log(`\n=== FINAL COUNT: ${remaining} stocks ===`);

        // Show expected vs actual
        console.log(`\nExpected: ${validSymbols.size} | Actual: ${remaining}`);

        await prisma.$disconnect();
        return { removed: toRemove.length, remaining, expected: validSymbols.size, missing: missing.length };

    } catch (error) {
        console.error('Error:', error.message);
        await prisma.$disconnect();
        return null;
    }
}

authoritativeSync();
