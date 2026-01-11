/**
 * Debug the change calculation issue
 */

async function debugChange() {
    try {
        const nepseModule = await import('nepse-api-helper');
        const { nepseClient, nepseAxios, createHeaders, BASE_URL } = nepseModule;
        const https = require('https');
        const agent = new https.Agent({ rejectUnauthorized: false });

        await nepseClient.initialize({ useWasm: true });
        const token = await nepseClient.getToken();
        const headers = createHeaders(token);

        // Fetch just a few stocks
        const res = await nepseAxios.get(`${BASE_URL}/api/nots/securityDailyTradeStat/58`, {
            headers,
            httpsAgent: agent,
            timeout: 10000
        });

        const stocks = res.data.slice(0, 5);

        console.log('=== RAW DATA FROM NEPSE ===');
        stocks.forEach(s => {
            console.log(`\n${s.symbol}:`);
            console.log(`  lastTradedPrice: ${s.lastTradedPrice}`);
            console.log(`  previousClose: ${s.previousClose}`);
            console.log(`  openPrice: ${s.openPrice}`);
            console.log(`  closePrice: ${s.closePrice}`);
            console.log(`  percentageChange (from API): ${s.percentageChange}`);
            console.log(`  pointChange (from API): ${s.pointChange}`);
        });

    } catch (error) {
        console.error('Error:', error.message);
    }
}

debugChange();
