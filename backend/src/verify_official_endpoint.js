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

        console.log('Testing official today-price endpoint...');

        // 1. Get Market Status/Date first (to know business date)
        const marketRes = await nepseAxios.get(`${BASE_URL}/api/nots/nepse-data/market-open`, { headers, httpsAgent: agent });
        const marketDate = marketRes.data.isOpen !== 'false' ? new Date().toISOString().split('T')[0] : '2026-01-08'; // Fallback to date seen in browser if needed, but ideally dynamic
        console.log('Market Status:', marketRes.data);

        // 2. Test today-price with ID 800700
        console.log(`\nFetching today-price for date ${marketDate} with ID 800700...`);

        const payload = { id: 800700 }; // As found by browser
        const url = `${BASE_URL}/api/nots/nepse-data/today-price?page=0&size=500&businessDate=${marketDate}`;

        try {
            const res = await nepseAxios.post(url, payload, {
                headers: { ...headers, 'Content-Type': 'application/json' },
                httpsAgent: agent
            });

            const data = res.data.content || res.data;
            console.log(`Count: ${Array.isArray(data) ? data.length : 'Not array'}`);

            if (Array.isArray(data) && data.length > 0) {
                console.log('Sample:', JSON.stringify(data[0], null, 2));

                // Check for previously missing stocks
                const aig = data.find(d => d.symbol === 'AIG');
                const uail = data.find(d => d.symbol === 'UAIL');
                const nifra = data.find(d => d.symbol === 'NIFRA');

                console.log('AIG found?', !!aig);
                console.log('UAIL found?', !!uail);
                console.log('NIFRA found?', !!nifra);
            }

        } catch (e) {
            console.log('Failed:', e.message);
            if (e.response) console.log(e.response.data);
        }

    } catch (e) {
        console.error(e);
    }
}

main();
