const https = require('https');
const axios = require('axios');

async function discover() {
    try {
        const nepseModule = await import('nepse-api-helper');
        const nepseClient = nepseModule.nepseClient;
        await nepseClient.initialize({ useWasm: true });
        const token = await nepseClient.getToken();

        const agent = new https.Agent({ rejectUnauthorized: false });

        const headers = {
            'Accept': 'application/json, text/plain, */*',
            'Referer': 'https://www.nepalstock.com.np/datewise-indices',
            'Origin': 'https://www.nepalstock.com.np',
            'Authorization': `Salter ${token}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        };

        const id = 51;
        const end = '2025-12-22';
        const start = '2025-12-15';

        const url = `https://www.nepalstock.com.np/api/nots/datewise-indices?indexId=${id}&startDate=${start}&endDate=${end}`;
        console.log(`Testing URL: ${url}`);

        try {
            const res = await axios.get(url, { headers, httpsAgent: agent });
            console.log(`Success! Items:`, res.data.length);
            if (res.data.length > 0) {
                const latest = res.data.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
                console.log('Latest Item:', JSON.stringify(latest));
            }
        } catch (e) {
            console.log(`Failed:`, e.message, e.response?.status);
            console.log(`Response Data:`, e.response?.data);
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
discover();
