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

        console.log('Testing more endpoint variations...');

        // 1. POST to today-price
        console.log('\n--- 1. POST today-price ---');
        try {
            const payload = { id: 58, page: 0, size: 500 };
            const res = await nepseAxios.post(`${BASE_URL}/api/nots/nepse-data/today-price`, payload, {
                headers: { ...headers, 'Content-Type': 'application/json' },
                httpsAgent: agent
            });
            const data = res.data.content || res.data;
            console.log(`Count: ${Array.isArray(data) ? data.length : 'Not array'}`);
            if (Array.isArray(data) && data.length > 0) {
                const aig = data.find(d => d.symbol === 'AIG');
                console.log('AIG (via POST):', aig ? aig.closePrice : 'Not found');
            }
        } catch (e) {
            console.log('POST Failed:', e.message);
        }

        // 2. Security List (Base info)
        console.log('\n--- 2. Company/Security List ---');
        try {
            // This endpoint often lists all companies but maybe not full price data
            const res = await nepseAxios.get(`${BASE_URL}/api/nots/company/list`, { headers, httpsAgent: agent });
            const data = res.data;
            console.log(`Count: ${data.length}`);
            const aig = data.find(d => d.symbol === 'AIG');
            console.log('AIG (via Company List):', JSON.stringify(aig, null, 2));
        } catch (e) {
            console.log('Company List Failed:', e.message);
        }

    } catch (e) {
        console.error(e);
    }
}

main();
