const n = require('nepse-api-helper');
const { nepseAxios } = require('nepse-api-helper/dist/http');

async function run() {
    try {
        await n.nepseClient.initialize({ useWasm: true });
        
        // getToken handles getting the auth prove endpoint and caching the token!
        const token = await n.nepseClient.getToken();
        
        // The problem is extracting salts! We need to manually hit /prove to get salts if nepse-api-helper doesn't expose them.
        // Or wait, does nepse-api-helper export getHardCodedNepseExports() that has cdx?
        const w = await n.loadWasmModule();
        
        // Fetch manually with nepseAxios to avoid socket hang up
        const authUrl = n.BASE_URL + '/api/authenticate/prove';
        const res = await nepseAxios.get(authUrl);
        const { salt1, salt2, salt3, salt4, salt5, accessToken } = res.data;
        
        const id = w.cdx(salt1, salt2, salt3, salt4, salt5);
        console.log('Payload ID:', id);

        const headers = n.nepseClient.createHeaders(accessToken);
        
        let businessDate = new Date();
        businessDate.setDate(businessDate.getDate() - 3);
        const dateStr = businessDate.toISOString().split('T')[0];

        const body = { id, businessDate: dateStr };
        
        const pRes = await nepseAxios.post(n.BASE_URL + '/api/nots/nepse-data/today-price?size=500', body, { headers });
        
        if (pRes.data && pRes.data.content) {
            console.log(`Successfully fetched ${pRes.data.content.length} records for ${dateStr}`);
            console.log('Sample:', pRes.data.content[0].symbol, pRes.data.content[0].closePrice);
        } else {
            console.log('No data returned.');
        }

    } catch (e) {
        console.log('Failed:', e.message);
        if (e.response) {
            console.log(e.response.status, e.response.data);
        }
    }
}
run();
