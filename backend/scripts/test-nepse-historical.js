/**
 * Test NEPSE official API historical data using nepse-api-helper auth
 * Tests if we can query past dates for all-stock daily data
 */
const axios = require('axios');
const https = require('https');

const agent = new https.Agent({ rejectUnauthorized: false });

async function getNepseToken() {
    const nepseModule = await import('nepse-api-helper');
    const nepseClient = nepseModule.nepseClient;
    const createHeaders = nepseModule.createHeaders;
    await nepseClient.initialize({ useWasm: true });
    const token = await nepseClient.getToken();
    const headers = createHeaders(token);
    return { headers };
}

async function tryNepseEndpoint(authHeaders, path, params = {}) {
    const url = `https://www.nepalstock.com.np/api/nots/${path}`;
    try {
        const res = await axios.get(url, {
            params,
            headers: {
                ...authHeaders,
                'Referer': 'https://www.nepalstock.com.np/'
            },
            timeout: 15000,
            httpsAgent: agent
        });
        const d = res.data;
        const isArr = Array.isArray(d);
        const len = isArr ? d.length : (typeof d === 'object' ? Object.keys(d).length : String(d).length);
        console.log(`\nGET /${path}?${JSON.stringify(params)}`);
        console.log(`  Status: ${res.status}, type: ${typeof d}, isArr: ${isArr}, len: ${len}`);
        if (isArr && d.length > 0) {
            console.log('  First entry keys:', Object.keys(d[0]).join(', '));
            console.log('  First:', JSON.stringify(d[0]).slice(0, 300));
        } else if (typeof d === 'object' && !isArr) {
            console.log('  Keys:', Object.keys(d).slice(0, 8).join(', '));
        }
        return d;
    } catch(e) {
        console.log(`\nGET /${path}?${JSON.stringify(params)} -> [${e.response?.status}] ${e.message.slice(0, 60)}`);
        return null;
    }
}

async function main() {
    console.log('Authenticating with NEPSE...');
    let authHeaders;
    try {
        const auth = await getNepseToken();
        authHeaders = auth.headers;
        console.log('Auth headers obtained:', Object.keys(authHeaders).slice(0,5).join(', '));
    } catch(e) {
        console.log('Auth failed:', e.message);
        // Try without auth
        authHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json'
        };
    }

    const pastDate = '2025-01-16';
    const pastDate2 = '2025-02-15';

    // Test 1: securityDailyTradeStat with businessDate
    await tryNepseEndpoint(authHeaders, 'securityDailyTradeStat/58', {});
    await tryNepseEndpoint(authHeaders, 'securityDailyTradeStat/58', { businessDate: pastDate });
    await tryNepseEndpoint(authHeaders, 'securityDailyTradeStat/58', { businessDate: pastDate, id: '0' });

    // Test 2: today-price with businessDate
    await tryNepseEndpoint(authHeaders, 'nepse-data/today-price', {});
    await tryNepseEndpoint(authHeaders, 'nepse-data/today-price', { businessDate: pastDate });
    await tryNepseEndpoint(authHeaders, 'nepse-data/today-price', { id: '0', businessDate: pastDate, startIndex: '0', endIndex: '500' });

    // Test 3: security/all or similar historical endpoint
    await tryNepseEndpoint(authHeaders, 'security/ALL', {});
    await tryNepseEndpoint(authHeaders, 'nepse-data/today-price', { id: '0', startIndex: '0', endIndex: '10', businessDate: pastDate2 });

    // Test 4: datewise-indices (known to exist)
    await tryNepseEndpoint(authHeaders, 'datewise-indices', { indexId: '58', startDate: '2025-01-01', endDate: '2025-02-01' });

    // Test 5: company-wise historical
    await tryNepseEndpoint(authHeaders, 'company/1', {});
    await tryNepseEndpoint(authHeaders, 'security/1', {});
}

main().catch(console.error);
