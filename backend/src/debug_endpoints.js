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

        console.log('Testing endpoints...');

        // 1. securityDailyTradeStat (Current method)
        console.log('\n--- 1. securityDailyTradeStat ---');
        try {
            const res1 = await nepseAxios.get(`${BASE_URL}/api/nots/securityDailyTradeStat/58`, { headers, httpsAgent: agent });
            console.log(`Count: ${res1.data.length}`);
            const untraded = res1.data.find(d => d.totalTradeQuantity === 0);
            console.log(`Contains untraded? ${!!untraded}`);
        } catch (e) {
            console.log('Failed:', e.message);
        }

        // 2. today-price (Often has everything)
        // Note: Payload often requires size/page but sometimes simple GET works or POST
        console.log('\n--- 2. today-price ---');
        try {
            // Usually it's a POST with page params, detecting...
            // Or try GET /api/nots/nepse-data/today-price?size=500
            const res2 = await nepseAxios.get(`${BASE_URL}/api/nots/nepse-data/today-price?size=500`, { headers, httpsAgent: agent });
            const data2 = res2.data.content || res2.data; // Structure varies
            console.log(`Count: ${Array.isArray(data2) ? data2.length : 'Not array'}`);
            if (Array.isArray(data2) && data2.length > 0) {
                console.log('Sample:', JSON.stringify(data2[0], null, 2));
                // Check for AIG or known missing
                const aig = data2.find(d => d.symbol === 'AIG');
                console.log('AIG found?', !!aig, aig ? aig.closePrice : '');
            }
        } catch (e) {
            console.log('GET Failed, trying POST...');
            try {
                const res2b = await nepseAxios.post(`${BASE_URL}/api/nots/nepse-data/today-price`, {
                    id: 58, // Sometimes sector ID is needed
                    size: 500
                }, { headers, httpsAgent: agent });
                const data2b = res2b.data.content || res2b.data;
                console.log(`POST Count: ${Array.isArray(data2b) ? data2b.length : 'Not array'}`);
            } catch (e2) {
                console.log('POST Failed:', e2.message);
            }
        }

    } catch (e) {
        console.error(e);
    }
}

main();
