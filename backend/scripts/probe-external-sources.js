const axios = require('axios');
const cheerio = require('cheerio');

async function probeMerolagani() {
    console.log('Probing Merolagani...');
    try {
        const { data } = await axios.get('https://merolagani.com/MarketSummary.aspx', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const $ = cheerio.load(data);

        // Try to find NEPSE Index
        // Usually in a table or specific ID
        // Looking for "NEPSE Index" text
        let nepseIndex = null;
        let turnover = null;

        // Merolagani structure changes, but often has tables
        // Debug: print all table rows text to see what we get
        $('table tr').each((i, el) => {
           console.log('Row:', $(el).text().trim().replace(/\s+/g, ' '));
        });

        $('tbody tr').each((i, el) => {
            const text = $(el).text().trim();
            // Merolagani often puts label in th or first td
            const label = $(el).find('th, td').first().text().trim();
            const value = $(el).find('td').last().text().trim();
            
            if (label.includes('NEPSE Index')) nepseIndex = value;
            if (label.includes('Total Turnover')) turnover = value;
        });

        // Regex fallback
        if (!nepseIndex) {
            const match = data.match(/NEPSE Index.*?([\d,]+\.?\d*)/i);
            if (match) nepseIndex = match[1];
        }
        if (!turnover) {
            const match = data.match(/Total Turnover.*?([\d,]+\.?\d*)/i);
            if (match) turnover = match[1];
        }

        console.log('Merolagani Data (Regex):');
        console.log('Index:', nepseIndex);
        console.log('Turnover:', turnover);

    } catch (e) {
        console.error('Merolagani failed:', e.message);
    }
}

async function probeSharesansar() {
    console.log('\nProbing Sharesansar...');
    try {
        const { data } = await axios.get('https://www.sharesansar.com/market-summary');
        const $ = cheerio.load(data);

        // Sharesansar usually has a clear market summary table
        // Look for "NEPSE Index"
        let nepseIndex = null;
        let turnover = null;

        // They often use specific classes or IDs
        // Let's try searching for text
        $('tr').each((i, el) => {
            const th = $(el).find('th').text().trim();
            const td = $(el).find('td').text().trim();
            
            if (th.includes('NEPSE Index')) nepseIndex = td;
            if (th.includes('Total Turnover')) turnover = td;
        });

        console.log('Sharesansar Data:');
        console.log('Index:', nepseIndex);
        console.log('Turnover:', turnover);

    } catch (e) {
        console.error('Sharesansar failed:', e.message);
    }
}

async function run() {
    await probeMerolagani();
    await probeSharesansar();
}

run();
