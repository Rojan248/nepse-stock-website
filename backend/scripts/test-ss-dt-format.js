/**
 * ShareSansar - proper DataTables server-side POST format
 */
const axios = require('axios');
const https = require('https');

const agent = new https.Agent();

async function fetchPriceHistory(symbol) {
    const companyUrl = `https://www.sharesansar.com/company/${symbol.toLowerCase()}`;

    const initRes = await axios.get(companyUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html' },
        timeout: 20000, httpsAgent: agent
    });
    const html = initRes.data;
    const cookies = (initRes.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');

    const tokenMatch = html.match(/<meta[^>]+name=["']_token["'][^>]+content=["']([^"']+)["']/i);
    const csrfToken = tokenMatch ? tokenMatch[1] : null;
    const companyIdMatch = html.match(/id=["']companyid["'][^>]*>([\d]+)<\/(?:span|div|p|td|strong)/i);
    const companyId = companyIdMatch ? companyIdMatch[1] : null;

    console.log(`symbol=${symbol} companyId=${companyId} csrfToken=${csrfToken ? csrfToken.slice(0,15)+'...' : 'NONE'}`);

    if (!csrfToken || !companyId) return null;

    // Columns matching the DataTable config
    const cols = ['DT_Row_Index', 'published_date', 'open', 'high', 'low', 'close', 'per_change', 'traded_quantity', 'traded_amount'];

    const params = new URLSearchParams();
    params.append('company', companyId);
    params.append('draw', '1');

    cols.forEach((col, i) => {
        params.append(`columns[${i}][data]`, col);
        params.append(`columns[${i}][name]`, '');
        params.append(`columns[${i}][searchable]`, i > 0 ? 'true' : 'false');
        params.append(`columns[${i}][orderable]`, 'false');
        params.append(`columns[${i}][search][value]`, '');
        params.append(`columns[${i}][search][regex]`, 'false');
    });

    params.append('start', '0');
    params.append('length', '500');
    params.append('search[value]', '');
    params.append('search[regex]', 'false');

    const res = await axios.post('https://www.sharesansar.com/company-price-history', params, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRF-Token': csrfToken,
            'Referer': companyUrl,
            'Accept': 'application/json, */*; q=0.01',
            'Cookie': cookies,
            'Origin': 'https://www.sharesansar.com'
        },
        timeout: 20000,
        httpsAgent: agent
    });

    const d = res.data;
    console.log(`Status: ${res.status}, recordsTotal: ${d.recordsTotal}, recordsFiltered: ${d.recordsFiltered}`);
    if (d.data && d.data.length > 0) {
        console.log(`data.length: ${d.data.length}`);
        console.log('First:', JSON.stringify(d.data[0]));
        console.log('Last:', JSON.stringify(d.data[d.data.length - 1]));
    } else {
        console.log('Still empty. Trying with from/to date...');

        // Maybe needs from/to date filter
        params.set('from', '2024-01-01');
        params.set('to', '2026-03-04');
        const res2 = await axios.post('https://www.sharesansar.com/company-price-history', params, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRF-Token': csrfToken,
                'Referer': companyUrl,
                'Accept': 'application/json, */*; q=0.01',
                'Cookie': cookies,
                'Origin': 'https://www.sharesansar.com'
            },
            timeout: 20000, httpsAgent: agent
        });
        const d2 = res2.data;
        console.log(`With dates - Status: ${res2.status}, total: ${d2.recordsTotal}`);
        if (d2.data && d2.data.length > 0) {
            console.log('First:', JSON.stringify(d2.data[0]));
            return d2;
        }
    }
    return d;
}

fetchPriceHistory('NABIL').catch(console.error);
