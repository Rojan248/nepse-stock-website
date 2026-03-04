/**
 * Test NEPSE security-specific endpoint with NABIL
 */
const axios = require('axios');
const https = require('https');

const agent = new https.Agent();

async function main() {
    const nepseModule = await import('nepse-api-helper');
    const nepseClient = nepseModule.nepseClient;
    const createHeaders = nepseModule.createHeaders;
    await nepseClient.initialize({ useWasm: true });
    const token = await nepseClient.getToken();
    const authHeaders = {
        ...createHeaders(token),
        'Referer': 'https://www.nepalstock.com.np/'
    };

    // First find NABIL's securityId
    const allStocks = await axios.get('https://www.nepalstock.com.np/api/nots/securityDailyTradeStat/58', {
        headers: authHeaders, timeout: 15000, httpsAgent: agent
    });
    const nabil = allStocks.data.find(s => s.symbol === 'NABIL');
    console.log('NABIL entry:', JSON.stringify(nabil));

    if (!nabil) {
        console.error('NABIL not found in NEPSE response');
        return;
    }

    const nabilId = nabil.securityId;
    console.log(`\nNABIL securityId: ${nabilId}`);

    // Try security-specific endpoints
    const endpoints = [
        `security/${nabilId}`,
        `nepse-data/security/1/${nabilId}`,
        `security/${nabilId}/price-history`,
        `security/${nabilId}/history`,
        `security/${nabilId}/chart`,
        `security/priceHistory/${nabilId}`,
        `nepse-data/today-price?id=${nabilId}&startIndex=0&endIndex=500`,
        `technical/security/chart/${nabilId}?startDate=2025-01-01&endDate=2026-01-01`
    ];

    for (const ep of endpoints) {
        try {
            const res = await axios.get(`https://www.nepalstock.com.np/api/nots/${ep}`, {
                headers: authHeaders, timeout: 10000, httpsAgent: agent
            });
            const d = res.data;
            const isArr = Array.isArray(d);
            console.log(`\nGET /${ep}`);
            console.log(`  Status: ${res.status}, type: ${typeof d}, isArr: ${isArr}`);
            if (isArr) {
                console.log(`  len: ${d.length}`);
                if (d.length > 0) console.log('  First:', JSON.stringify(d[0]).slice(0, 300));
            } else if (typeof d === 'object') {
                console.log('  Keys:', Object.keys(d).slice(0, 8).join(', '));
                console.log('  Sample:', JSON.stringify(d).slice(0, 300));
            } else {
                console.log('  Data:', String(d).slice(0, 200));
            }
        } catch(e) {
            console.log(`\nGET /${ep} -> [${e.response?.status}] ${e.message.slice(0, 50)}`);
        }
    }
}

main().catch(console.error);
