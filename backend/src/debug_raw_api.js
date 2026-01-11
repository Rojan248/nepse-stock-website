const { nepseClient, nepseAxios, createHeaders, BASE_URL } = require('nepse-api-helper');
const https = require('https');

// Custom HTTPS agent
const agent = new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true,
    timeout: 10000
});

async function main() {
    try {
        console.log('Initializing NEPSE client...');
        await nepseClient.initialize({ useWasm: true });
        const token = await nepseClient.getToken();
        console.log('Token received.');

        const headers = createHeaders(token);

        console.log('Fetching Security Daily Trade Stat (Index 58)...');
        // Index 58 is usually the main index containing most scripts
        const url = `${BASE_URL}/api/nots/securityDailyTradeStat/58`;

        const response = await nepseAxios.get(url, {
            headers,
            httpsAgent: agent
        });

        const data = response.data;
        if (!Array.isArray(data)) {
            console.error('Response is not an array:', data);
            return;
        }

        console.log(`Received ${data.length} records.`);

        // Look for problematic stocks
        const targets = ['AIG', 'NIFRA', 'HIDCL', 'UPPER']; // Common stocks, plus AIG which was null

        targets.forEach(symbol => {
            const match = data.find(d => d.symbol === symbol);
            if (match) {
                console.log(`\n--- RAW DATA FOR ${symbol} ---`);
                console.log(JSON.stringify(match, null, 2));
            } else {
                console.log(`\n--- ${symbol} NOT FOUND IN RESPONSE ---`);
            }
        });

        // Statistics
        const zeroLtp = data.filter(d => !d.lastTradedPrice && !d.closePrice).length;
        const zeroPrevClose = data.filter(d => !d.previousClose).length;
        console.log(`\nStats: Records with no LTP: ${zeroLtp}, Records with no PrevClose: ${zeroPrevClose}`);

    } catch (e) {
        console.error('Error:', e.message);
        if (e.response) {
            console.error('Response status:', e.response.status);
            console.error('Response data:', e.response.data);
        }
    }
}

main();
