const axios = require('axios');

async function discover() {
    try {
        const url = 'https://nepse-api.herokuapp.com/api/indices';
        console.log(`Testing ${url}...`);
        const res = await axios.get(url, { timeout: 10000 });
        console.log(`Success! Items:`, res.data.length);
        if (Array.isArray(res.data) && res.data.length > 0) {
            console.log('Sample:', JSON.stringify(res.data[0]));
        }
        process.exit(0);
    } catch (e) {
        console.log(`Failed:`, e.message);
        process.exit(0);
    }
}
discover();
