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

        // 1. Get Company List (Source of IDs)
        console.log('Fetching Company List...');
        const compRes = await nepseAxios.get(`${BASE_URL}/api/nots/company/list`, { headers, httpsAgent: agent });
        const companies = compRes.data; // List of {id, symbol, status: 'A', ...}

        // 2. Get Trade Stat (Source of Today's Data)
        console.log('Fetching Trade Stats...');
        const tradeRes = await nepseAxios.get(`${BASE_URL}/api/nots/securityDailyTradeStat/58`, { headers, httpsAgent: agent });
        const traded = new Set(tradeRes.data.map(s => s.symbol));

        // 3. Find a missing active stock
        const missing = companies.find(c => c.status === 'A' && !traded.has(c.symbol));

        if (missing) {
            console.log(`Found missing active stock: ${missing.symbol} (ID: ${missing.id})`);

            // 4. Try to get price for this stock
            // A. Security Details
            try {
                const url = `${BASE_URL}/api/nots/security/${missing.id}`;
                console.log(`Fetching details: ${url}`);
                const res = await nepseAxios.get(url, { headers, httpsAgent: agent });
                console.log('Details:', JSON.stringify(res.data, null, 2));
            } catch (e) {
                console.log('Details Fetch Failed:', e.message);
            }

            // B. Graph History (Last resort for price)
            try {
                // history?symbol=.. or similar
                // Actually the graph endpoint is /api/nots/graph/history/{symbol} ?? No.
                // It's /api/nots/market/graph/history/{symbol} ??
                // Let's guess or check helper.
                // helper has fetchCompanyHistory?
            } catch (e) { }

        } else {
            console.log('No missing active stocks found? That implies 100% gathered.');
        }

    } catch (e) {
        console.error(e);
    }
}

main();
