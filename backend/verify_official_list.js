/**
 * Fetch Official NEPSE Company List
 * Cross-verify with database and identify discrepancies
 */

const https = require('https');

const agent = new https.Agent({ rejectUnauthorized: false });

async function fetchCompanyList() {
    console.log('Fetching official NEPSE company list...\n');

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
        console.log(`Total companies from NEPSE API: ${companies.length}\n`);

        // Analyze by status
        const active = companies.filter(c => c.status === 'A');
        const inactive = companies.filter(c => c.status !== 'A');

        console.log(`Active companies: ${active.length}`);
        console.log(`Inactive companies: ${inactive.length}\n`);

        // Group by instrument type if available
        const byInstrument = {};
        companies.forEach(c => {
            const type = c.instrumentType || c.securityType || 'Unknown';
            byInstrument[type] = byInstrument[type] || [];
            byInstrument[type].push(c.symbol);
        });

        console.log('Companies by Instrument Type:');
        Object.entries(byInstrument).forEach(([type, symbols]) => {
            console.log(`  ${type}: ${symbols.length}`);
        });

        // Save the list
        const fs = require('fs');
        fs.writeFileSync('./official_companies.json', JSON.stringify(companies, null, 2));
        console.log('\nSaved to official_companies.json');

        // Return active company symbols
        return active.map(c => c.symbol);

    } catch (error) {
        console.error('Error:', error.message);
        return [];
    }
}

// Compare with our database
async function compareWithDatabase(officialSymbols) {
    console.log('\n--- Comparing with Database ---\n');

    const { prisma } = require('./src/services/database/connection');

    const dbStocks = await prisma.stock.findMany({ select: { symbol: true } });
    const dbSymbols = new Set(dbStocks.map(s => s.symbol));
    const officialSet = new Set(officialSymbols);

    console.log(`Official NEPSE companies: ${officialSymbols.length}`);
    console.log(`Database stocks: ${dbSymbols.size}`);

    // Find discrepancies
    const inDbNotOfficial = [...dbSymbols].filter(s => !officialSet.has(s));
    const inOfficialNotDb = officialSymbols.filter(s => !dbSymbols.has(s));

    console.log(`\nIn DB but NOT in official list (${inDbNotOfficial.length}):`);
    console.log(inDbNotOfficial.slice(0, 30).join(', '));
    if (inDbNotOfficial.length > 30) console.log(`... and ${inDbNotOfficial.length - 30} more`);

    console.log(`\nIn Official but NOT in DB (${inOfficialNotDb.length}):`);
    console.log(inOfficialNotDb.slice(0, 30).join(', '));
    if (inOfficialNotDb.length > 30) console.log(`... and ${inOfficialNotDb.length - 30} more`);

    await prisma.$disconnect();

    return { inDbNotOfficial, inOfficialNotDb };
}

fetchCompanyList().then(symbols => {
    if (symbols.length > 0) {
        compareWithDatabase(symbols);
    }
});
