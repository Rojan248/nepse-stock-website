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

        console.log('Testing official today-price endpoint (v2)...');

        // 1. Get Market Status/Date
        const marketRes = await nepseAxios.get(`${BASE_URL}/api/nots/nepse-data/market-open`, { headers, httpsAgent: agent });
        const marketData = marketRes.data;
        console.log('Market Status:', JSON.stringify(marketData));

        // Extract correct business date (YYYY-MM-DD from 2026-01-08T15:00:00)
        // If market is closed, we MUST use the 'asOf' date, otherwise we get nothing or error
        const businessDate = marketData.asOf.split('T')[0];
        console.log(`Using Business Date: ${businessDate}`);

        // 2. Test today-price with ID 800700
        const url = `${BASE_URL}/api/nots/nepse-data/today-price?page=0&size=500&businessDate=${businessDate}`;
        const payload = { id: 800700 }; // Try the browser specific ID first

        console.log(`Fetching: ${url}`);
        console.log(`Payload: ${JSON.stringify(payload)}`);

        try {
            const res = await nepseAxios.post(url, payload, {
                headers: {
                    ...headers,
                    'Content-Type': 'application/json',
                    'Origin': 'https://nepalstock.com.np',
                    'Referer': 'https://nepalstock.com.np/today-price'
                },
                httpsAgent: agent
            });

            const data = res.data.content || res.data;
            // Handle pagination structure
            const items = data.content || data;

            console.log(`Response Status: ${res.status}`);
            console.log(`Count: ${Array.isArray(items) ? items.length : 'Not array'}`);

            if (Array.isArray(items) && items.length > 0) {
                console.log('Sample:', JSON.stringify(items[0], null, 2));

                const aig = items.find(d => d.symbol === 'AIG');
                const uail = items.find(d => d.symbol === 'UAIL');
                const nifra = items.find(d => d.symbol === 'NIFRA');

                console.log('AIG found?', !!aig);
                console.log('UAIL found?', !!uail);
                console.log('NIFRA found?', !!nifra);
            } else {
                console.log('Full Response:', JSON.stringify(res.data).substring(0, 500));
            }

        } catch (e) {
            console.log('Failed:', e.message);
            if (e.response) {
                console.log('Error Status:', e.response.status);
                // console.log('Error Data:', e.response.data);
            }
        }

    } catch (e) {
        console.error(e);
    }
}

main();
