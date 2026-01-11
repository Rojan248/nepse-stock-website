const { nepseClient, nepseAxios, createHeaders, BASE_URL } = require('nepse-api-helper');
const https = require('https');

const agent = new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true
});

async function main() {
    try {
        await nepseClient.initialize({ useWasm: true });
        const token = await nepseClient.getToken();
        const headers = createHeaders(token);

        console.log('Fetching Index List...');
        // Try to find the endpoint for index list. Usually /api/nots/index/list
        // Or sometimes just /api/nots/nepse-index

        let indices = [];
        try {
            const res = await nepseAxios.get(`${BASE_URL}/api/nots/index/list`, { headers, httpsAgent: agent });
            indices = res.data;
            console.log(`Found ${indices.length} indices.`);
        } catch (e) {
            console.log('Failed to fetch index list, trying legacy endpoint...');
        }

        // If list fetch fails, try some known IDs: 
        // 58 (NEPSE), 51 (Sensitive), others for sectors?
        // Actually sectors have their own ID?

        const knownIndices = indices.length > 0 ? indices : [{ id: 58, name: 'NEPSE' }];

        const allStocks = new Map();

        for (const idx of knownIndices) {
            console.log(`Fetching stats for Index ${idx.id} (${idx.indexName || idx.name || ''})...`);
            try {
                const res = await nepseAxios.get(`${BASE_URL}/api/nots/securityDailyTradeStat/${idx.id}`, { headers, httpsAgent: agent });
                const data = res.data;
                console.log(`  -> ${data.length} stocks`);

                data.forEach(s => {
                    if (!allStocks.has(s.symbol)) {
                        allStocks.set(s.symbol, s);
                    }
                });
            } catch (e) {
                console.log(`  -> Failed: ${e.message}`);
            }
        }

        console.log(`\nTotal Unique Stocks Found: ${allStocks.size}`);

        // Check for AIG, UAIL
        console.log('AIG:', !!allStocks.get('AIG'));
        console.log('UAIL:', !!allStocks.get('UAIL'));

        if (indices.length > 0) {
            console.log('Indices found:', indices.map(i => `${i.id}:${i.indexName}`).join(', '));
        }

    } catch (e) {
        console.error(e);
    }
}

main();
