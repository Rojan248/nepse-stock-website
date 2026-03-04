/**
 * ShareSansar - correct approach:
 * 1. GET company page
 * 2. Extract _token meta content and #companyid element
 * 3. POST with company=<companyid> and X-CSRF-Token=<_token>
 */
const axios = require('axios');
const https = require('https');

const agent = new https.Agent();

async function fetchPriceHistory(symbol) {
    const companyUrl = `https://www.sharesansar.com/company/${symbol.toLowerCase()}`;

    console.log(`Fetching company page: ${companyUrl}`);
    const initRes = await axios.get(companyUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html'
        },
        timeout: 20000,
        httpsAgent: agent
    });

    const html = initRes.data;
    const cookies = (initRes.headers['set-cookie'] || [])
        .map(c => c.split(';')[0]).join('; ');

    // Extract _token from meta tag
    const tokenMatch = html.match(/<meta[^>]+name=["']_token["'][^>]+content=["']([^"']+)["']/i);
    const csrfToken = tokenMatch ? tokenMatch[1] : null;
    console.log('CSRF _token:', csrfToken ? csrfToken.slice(0, 20) + '...' : 'NOT FOUND');

    // Extract #companyid element content
    const companyIdMatch = html.match(/id=["']companyid["'][^>]*>([\d]+)<\/(?:span|div|p|td)/i);
    const companyId = companyIdMatch ? companyIdMatch[1] : null;
    console.log('#companyid value:', companyId || 'NOT FOUND');

    // Also try to find it another way
    if (!companyId) {
        const anyIdMatch = html.match(/companyid[^>]*>([\d]+)/i);
        console.log('Alt companyid match:', anyIdMatch ? anyIdMatch[1] : 'NOT FOUND');

        // Show surrounding context
        const companyidIdx = html.indexOf('companyid');
        if (companyidIdx > -1) {
            console.log('companyid context:', html.slice(companyidIdx - 20, companyidIdx + 100));
        }
    }

    // Also look for #symbol element
    const symbolMatch = html.match(/id=["']symbol["'][^>]*>([^<]+)</i);
    console.log('#symbol value:', symbolMatch ? symbolMatch[1].trim() : 'NOT FOUND');

    if (!csrfToken) {
        console.log('No CSRF token. Aborting.');
        return null;
    }

    const company = companyId || symbol;

    // POST to company-price-history
    const postUrl = 'https://www.sharesansar.com/company-price-history';

    // DataTables sends standard parameters too
    const params = new URLSearchParams({
        company: company,
        draw: '1',
        'columns[0][data]': 'published_date',
        'columns[0][name]': '',
        'columns[0][searchable]': 'true',
        'columns[0][orderable]': 'false',
        'columns[0][search][value]': '',
        'columns[0][search][regex]': 'false',
        start: '0',
        length: '500',
        'search[value]': '',
        'search[regex]': 'false'
    });

    console.log(`\nPOSTing with company=${company}...`);
    try {
        const res = await axios.post(postUrl, params, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRF-Token': csrfToken,
                'Referer': companyUrl,
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Cookie': cookies,
                'Origin': 'https://www.sharesansar.com'
            },
            timeout: 20000,
            httpsAgent: agent
        });
        const d = res.data;
        console.log('Status:', res.status);
        if (typeof d === 'object') {
            console.log('Keys:', Object.keys(d).join(', '));
            console.log('recordsTotal:', d.recordsTotal);
            console.log('recordsFiltered:', d.recordsFiltered);
            if (d.data && d.data.length > 0) {
                console.log(`\ndata.length: ${d.data.length}`);
                console.log('First record:\n', JSON.stringify(d.data[0], null, 2));
                console.log('Last record:\n', JSON.stringify(d.data[d.data.length - 1], null, 2));
            } else {
                console.log('data is empty!');
            }
        } else {
            console.log('Response:', String(d).slice(0, 500));
        }
        return d;
    } catch(e) {
        console.log('POST failed:', e.message, '[', e.response?.status, ']');
        if (e.response?.data) console.log('Body:', JSON.stringify(e.response.data).slice(0, 300));
    }
}

fetchPriceHistory('NABIL').catch(console.error);
