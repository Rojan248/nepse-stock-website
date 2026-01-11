const { nepseClient, nepseAxios, createHeaders } = require('nepse-api-helper');
const https = require('https');

const agent = new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true
});

async function main() {
    try {
        console.log('Initializing...');
        await nepseClient.initialize({ useWasm: true });
        const token = await nepseClient.getToken();

        // Force non-www URL to match browser
        const BASE_URL_OVERRIDE = 'https://nepalstock.com.np';

        // Manually construct headers to match browser EXACTLY
        const headers = {
            'Authorization': `Salter ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Origin': 'https://nepalstock.com.np',
            'Referer': 'https://nepalstock.com.np/today-price',
            'Host': 'nepalstock.com.np' // Usually prohibited to set in Node but let's try via axios config
        };

        // 1. Get Market Status/Date
        console.log('Fetching market status...');
        const marketRes = await nepseAxios.get(`${BASE_URL_OVERRIDE}/api/nots/nepse-data/market-open`, {
            headers,
            httpsAgent: agent
        });
        const marketData = marketRes.data;
        const businessDate = marketData.asOf.split('T')[0];
        console.log(`Business Date: ${businessDate}`);

        // 2. Test today-price with various IDs
        const idsToTry = [800700, 58, 80, 206, 137]; // 206/137 are random guesses based on typical NEPSE ids

        for (const id of idsToTry) {
            console.log(`\nTrying ID: ${id}`);
            const url = `${BASE_URL_OVERRIDE}/api/nots/nepse-data/today-price?page=0&size=20&businessDate=${businessDate}`;
            try {
                const res = await nepseAxios.post(url, { id }, {
                    headers,
                    httpsAgent: agent
                });
                const data = res.data.content || res.data;
                console.log(`SUCCESS! Count: ${Array.isArray(data) ? data.length : 'Not array'}`);
                if (Array.isArray(data) && data.length > 0) {
                    console.log('Sample:', data[0].symbol);
                }
                break; // Stop if success
            } catch (e) {
                console.log(`Failed (${e.response ? e.response.status : e.message})`);
            }
        }

    } catch (e) {
        console.error(e);
    }
}

main();
