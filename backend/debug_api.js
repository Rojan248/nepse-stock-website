const axios = require('axios');

async function checkApi() {
    try {
        console.log('--- Checking Market Summary ---');
        try {
            const summary = await axios.get('http://localhost:5000/api/market-summary');
            console.log(JSON.stringify(summary.data, null, 2));
        } catch (e) {
            console.log('Market Summary Error:', e.message);
        }

        console.log('\n--- Checking Stocks ---');
        try {
            const stocks = await axios.get('http://localhost:5000/api/stocks?limit=1');
            console.log(JSON.stringify(stocks.data, null, 2));
        } catch (e) {
            console.log('Stocks Error:', e.message);
        }

    } catch (err) {
        console.error('Global Error:', err.message);
    }
}

checkApi();
