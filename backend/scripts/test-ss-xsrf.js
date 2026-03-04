/**
 * ShareSansar XSRF-TOKEN approach (Laravel CSRF via cookie)
 */
const axios = require('axios');
const https = require('https');

const agent = new https.Agent();

async function fetchWithXsrf(symbol) {
    // Step 1: GET company page to collect session cookies
    const companyUrl = `https://www.sharesansar.com/company/${symbol.toLowerCase()}`;

    console.log(`Step 1: GET ${companyUrl}`);
    const initRes = await axios.get(companyUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5'
        },
        timeout: 20000,
        httpsAgent: agent
    });

    // Parse all set-cookie headers
    const setCookieHeaders = initRes.headers['set-cookie'] || [];
    console.log(`Got ${setCookieHeaders.length} cookies:`);
    setCookieHeaders.forEach(c => console.log('  ', c.slice(0, 80)));

    // Build cookie string and extract XSRF-TOKEN
    const cookieParts = {};
    setCookieHeaders.forEach(c => {
        const [kv] = c.split(';');
        const eqIdx = kv.indexOf('=');
        if (eqIdx > 0) {
            const k = kv.slice(0, eqIdx).trim();
            const v = kv.slice(eqIdx + 1).trim();
            cookieParts[k] = v;
        }
    });

    const cookieStr = Object.entries(cookieParts).map(([k, v]) => `${k}=${v}`).join('; ');
    console.log('\nCookie string:', cookieStr.slice(0, 120));

    const xsrfRaw = cookieParts['XSRF-TOKEN'];
    if (!xsrfRaw) {
        console.log('No XSRF-TOKEN found!');
        return null;
    }

    // Laravel's axios sends URL-decoded XSRF-TOKEN value as X-XSRF-TOKEN header
    const xsrfDecoded = decodeURIComponent(xsrfRaw);
    console.log('\nXSRF-TOKEN (decoded, first 50):', xsrfDecoded.slice(0, 50));

    // Step 2: POST to company-price-history
    const postUrl = 'https://www.sharesansar.com/company-price-history';

    const variants = [
        { symbol: symbol, from: '2024-01-01', to: '2026-03-04' },
        { symbol: symbol, from: '2024-01-01', to: '2026-03-04', draw: '1', start: '0', length: '500' },
        { company: symbol, from: '2024-01-01', to: '2026-03-04' },
        { id: symbol }
    ];

    for (const body of variants) {
        const params = new URLSearchParams(body);
        console.log(`\nPOST with params: ${JSON.stringify(body)}`);
        try {
            const res = await axios.post(postUrl, params, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-XSRF-TOKEN': xsrfDecoded,
                    'Referer': companyUrl,
                    'Accept': 'application/json, text/javascript, */*; q=0.01',
                    'Cookie': cookieStr,
                    'Origin': 'https://www.sharesansar.com'
                },
                timeout: 20000,
                httpsAgent: agent
            });
            const d = res.data;
            console.log(`  Status: ${res.status}, type: ${typeof d}`);
            if (typeof d === 'object') {
                const keys = Object.keys(d);
                console.log('  Keys:', keys.join(', '));
                if (d.data && Array.isArray(d.data)) {
                    console.log(`  data.length: ${d.data.length}`);
                    if (d.data.length > 0) {
                        console.log('  data[0]:', JSON.stringify(d.data[0]).slice(0, 300));
                    }
                } else {
                    console.log('  Data:', JSON.stringify(d).slice(0, 300));
                }
            } else {
                console.log('  Body:', String(d).slice(0, 300));
            }
        } catch(e) {
            console.log(`  FAILED: [${e.response?.status}] ${e.message.slice(0, 60)}`);
            if (e.response?.data) console.log('  Resp:', String(e.response.data).slice(0, 200));
        }
    }
}

fetchWithXsrf('NABIL').catch(console.error);
