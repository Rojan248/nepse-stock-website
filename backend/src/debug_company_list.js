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

        console.log('Fetching Company List...');
        const res = await nepseAxios.get(`${BASE_URL}/api/nots/company/list`, { headers, httpsAgent: agent });
        const data = res.data;

        console.log(`Total Companies: ${data.length}`);

        // Log first 2 items to see structure
        console.log('Sample:', JSON.stringify(data.slice(0, 2), null, 2));

        // Check for UAIL vs AIG
        const aig = data.find(d => d.symbol === 'AIG');
        const uail = data.find(d => d.symbol === 'UAIL');

        console.log('AIG present?', !!aig);
        console.log('UAIL present?', !!uail);

    } catch (e) {
        console.error(e);
    }
}

main();
