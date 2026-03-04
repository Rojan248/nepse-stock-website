/**
 * ShareSansar CSRF-aware scraper
 * 1. GET company page to get session cookie + CSRF token
 * 2. POST to company-price-history with CSRF token
 */
const axios = require('axios');
const https = require('https');

const agent = new https.Agent();

async function fetchWithCsrf(symbol) {
    const cookieJar = {};

    // Step 1: GET the company page to get session + CSRF token
    const companyUrl = `https://www.sharesansar.com/company/${symbol.toLowerCase()}`;
    let csrfToken = null;

    console.log(`Fetching company page for ${symbol}...`);
    const initRes = await axios.get(companyUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html'
        },
        timeout: 20000,
        httpsAgent: agent,
        withCredentials: true
    });

    const html = initRes.data;

    // Extract CSRF token from meta tag
    const csrfMeta = html.match(/<meta[^>]+name=["']csrf-token["'][^>]+content=["']([^"']+)["']/i);
    if (csrfMeta) {
        csrfToken = csrfMeta[1];
        console.log('CSRF token found:', csrfToken.slice(0, 20) + '...');
    }

    // Also try to find it in JS
    const csrfJs = html.match(/['"_]csrf['"]\s*[,:]\s*['"]([^'"]{20,})['"]/i);
    if (!csrfToken && csrfJs) {
        csrfToken = csrfJs[1];
        console.log('CSRF from JS found:', csrfToken.slice(0, 20) + '...');
    }

    // Extract set-cookie headers
    const cookies = initRes.headers['set-cookie'] || [];
    const cookieStr = cookies.map(c => c.split(';')[0]).join('; ');
    console.log('Cookies received:', cookieStr.slice(0, 100));

    if (!csrfToken) {
        console.log('No CSRF token found. HTML snippet:');
        console.log(html.slice(0, 1000));
        return null;
    }

    // Step 2: POST to company-price-history with CSRF token
    const postUrl = 'https://www.sharesansar.com/company-price-history';

    const params = new URLSearchParams({
        symbol: symbol,
        from: '2024-01-01',
        to: '2026-03-01',
        _token: csrfToken,
        draw: '1',
        start: '0',
        length: '365'
    });

    console.log('\nPOSTing to company-price-history...');
    try {
        const res = await axios.post(postUrl, params, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRF-TOKEN': csrfToken,
                'Referer': companyUrl,
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Cookie': cookieStr,
                'Origin': 'https://www.sharesansar.com'
            },
            timeout: 20000,
            httpsAgent: agent
        });

        const d = res.data;
        console.log('Status:', res.status);
        console.log('Type:', typeof d);
        if (typeof d === 'object') {
            console.log('Keys:', Object.keys(d));
            if (d.data) {
                console.log(`data.length: ${d.data.length}`);
                console.log('data[0]:', JSON.stringify(d.data[0]).slice(0, 300));
                if (d.data.length > 1) {
                    console.log('data[-1]:', JSON.stringify(d.data[d.data.length-1]).slice(0, 300));
                }
            }
        } else {
            console.log('Body:', String(d).slice(0, 500));
        }
        return d;
    } catch(e) {
        console.log('POST failed:', e.message, '[', e.response?.status, ']');
        if (e.response?.data) console.log('Resp:', JSON.stringify(e.response.data).slice(0, 300));
        return null;
    }
}

fetchWithCsrf('NABIL').catch(console.error);
