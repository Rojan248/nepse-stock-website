/**
 * Synchronize database with official NEPSE company list
 * Only keep ACTIVE EQUITY companies
 */

const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });

async function syncWithOfficial() {
    console.log('=== NEPSE Official List Sync ===\n');

    try {
        // Import the nepse-api-helper
        const nepseModule = await import('nepse-api-helper');
        const { nepseClient, nepseAxios, createHeaders, BASE_URL } = nepseModule;

        // Initialize
        await nepseClient.initialize({ useWasm: true });
        const token = await nepseClient.getToken();
        const headers = createHeaders(token);

        // Fetch company list
        const res = await nepseAxios.get(`${BASE_URL}/api/nots/company/list`, {
            headers,
            httpsAgent: agent
        });

        const companies = res.data;

        // Filter to ACTIVE EQUITY only
        const activeEquity = companies.filter(c =>
            c.status === 'A' &&
            c.instrumentType === 'Equity'
        );

        console.log(`Total from NEPSE: ${companies.length}`);
        console.log(`Active Equity only: ${activeEquity.length}`);

        const officialSymbols = new Set(activeEquity.map(c => c.symbol));

        // Connect to database
        const { prisma } = require('./src/services/database/connection');

        const dbStocks = await prisma.stock.findMany({ select: { symbol: true } });
        const dbSymbols = new Set(dbStocks.map(s => s.symbol));

        console.log(`Current DB stocks: ${dbSymbols.size}\n`);

        // Find discrepancies
        const toRemove = [...dbSymbols].filter(s => !officialSymbols.has(s));
        const missing = [...officialSymbols].filter(s => !dbSymbols.has(s));

        console.log(`Symbols to REMOVE (not in official equity list): ${toRemove.length}`);
        if (toRemove.length > 0 && toRemove.length <= 50) {
            console.log(toRemove.join(', '));
        }

        console.log(`\nSymbols MISSING from DB: ${missing.length}`);
        if (missing.length > 0 && missing.length <= 30) {
            console.log(missing.join(', '));
        }

        // Delete non-official stocks
        if (toRemove.length > 0) {
            console.log(`\nDeleting ${toRemove.length} non-official symbols...`);
            const result = await prisma.stock.deleteMany({
                where: { symbol: { in: toRemove } }
            });
            console.log(`Deleted: ${result.count}`);
        }

        const remaining = await prisma.stock.count();
        console.log(`\n=== FINAL COUNT: ${remaining} stocks ===`);

        await prisma.$disconnect();

        return { removed: toRemove.length, remaining, missing: missing.length };

    } catch (error) {
        console.error('Error:', error.message);
        return null;
    }
}

syncWithOfficial().then(result => {
    if (result) {
        console.log('\nSync complete!');
        console.log(JSON.stringify(result, null, 2));
    }
});
