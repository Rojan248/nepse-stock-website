const axios = require('axios');
const https = require('https');

const agent = new https.Agent();

async function main() {
    const res = await axios.get('https://www.sharesansar.com/company/nabil', {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' },
        timeout: 20000, httpsAgent: agent
    });
    const html = res.data;

    // Extract full myPriceHistoryOptions
    const optStart = html.indexOf('myPriceHistoryOptions');
    if (optStart > -1) {
        const block = html.slice(optStart, optStart + 3000);
        console.log('myPriceHistoryOptions:\n', block);
    }

    // Also look for columns definition near pricehistory
    const allOccurrences = [];
    let pos = 0;
    while ((pos = html.indexOf('"columns"', pos)) !== -1) {
        allOccurrences.push(pos);
        pos++;
    }
    console.log(`\n\nTotal "columns" occurrences: ${allOccurrences.length}`);

    // Find one near pricehistory
    const phIdx = html.indexOf('myPriceHistoryOptions');
    for (const occ of allOccurrences) {
        if (Math.abs(occ - phIdx) < 1500) {
            console.log(`\nColumns near priceHistory (at ${occ}, phIdx=${phIdx}):`);
            console.log(html.slice(occ, occ + 1000));
        }
    }
}
main().catch(console.error);
