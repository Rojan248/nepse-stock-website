const axios = require('axios');
const https = require('https');

const agent = new https.Agent({ rejectUnauthorized: false });

const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'X-Requested-With': 'XMLHttpRequest',
    'Referer': 'https://www.sharesansar.com/company/nabil',
    'Accept': 'application/json, text/javascript, */*; q=0.01'
};

async function trySSPriceHistory(params) {
    const url = 'https://www.sharesansar.com/company-price-history';
    try {
        // Try GET
        const res = await axios.get(url, {
            params,
            headers,
            timeout: 15000,
            httpsAgent: agent
        });
        const d = res.data;
        const type = typeof d;
        console.log(`\nGET params=${JSON.stringify(params)}`);
        console.log(`  Status: ${res.status}, type: ${type}`);
        if (type === 'object') {
            console.log('  Keys:', Object.keys(d).slice(0, 10).join(', '));
            if (d.data) console.log('  data[0]:', JSON.stringify(d.data[0]).slice(0, 200));
            if (d.recordsTotal !== undefined) console.log('  total:', d.recordsTotal);
        } else {
            console.log('  Body (300):', String(d).slice(0, 300));
        }
    } catch(e) {
        console.log(`\nGET params=${JSON.stringify(params)} -> FAILED: ${e.message.slice(0,60)} [${e.response?.status}]`);
        if (e.response?.data) console.log('  resp:', JSON.stringify(e.response.data).slice(0, 200));
    }

    // Try POST
    try {
        const res = await axios.post(url, new URLSearchParams(params), {
            headers: { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 15000,
            httpsAgent: agent
        });
        const d = res.data;
        const type = typeof d;
        console.log(`POST params=${JSON.stringify(params)}`);
        console.log(`  Status: ${res.status}, type: ${type}`);
        if (type === 'object') {
            console.log('  Keys:', Object.keys(d).slice(0, 10).join(', '));
            if (d.data) console.log('  data[0]:', JSON.stringify(d.data[0]).slice(0, 200));
        } else {
            console.log('  Body (300):', String(d).slice(0, 300));
        }
    } catch(e) {
        console.log(`POST params=${JSON.stringify(params)} -> FAILED: ${e.message.slice(0,60)} [${e.response?.status}]`);
    }
}

async function main() {
    // Try different parameter names
    const variants = [
        { symbol: 'NABIL' },
        { id: 'NABIL' },
        { company: 'NABIL' },
        { slug: 'nabil' },
        { symbol: 'NABIL', draw: 1, length: 100 },
        { symbol: 'NABIL', from: '2024-01-01', to: '2026-03-01' },
        // DataTables format
        { symbol: 'NABIL', draw: '1', start: '0', length: '100' },
        { id: '1', draw: '1', start: '0', length: '100' } // maybe needs numeric company ID
    ];

    for (const v of variants) {
        await trySSPriceHistory(v);
    }
}

main().catch(console.error);
