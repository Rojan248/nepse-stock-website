/**
 * Test multiple approaches for historical data
 */
const axios = require('axios');
const https = require('https');

const agent = new https.Agent();

async function getShareSansarSession(symbol) {
    const companyUrl = `https://www.sharesansar.com/company/${symbol.toLowerCase()}`;
    const initRes = await axios.get(companyUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html' },
        timeout: 20000, httpsAgent: agent
    });
    const html = initRes.data;
    const cookies = (initRes.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
    const tokenMatch = html.match(/<meta[^>]+name=["']_token["'][^>]+content=["']([^"']+)["']/i);
    const csrfToken = tokenMatch ? tokenMatch[1] : null;
    const companyIdMatch = html.match(/id=["']companyid["'][^>]*>([\d]+)</i);
    const companyId = companyIdMatch ? companyIdMatch[1] : null;
    return { cookies, csrfToken, companyId, html };
}

async function postPriceHistory(company, session, symbol) {
    const params = new URLSearchParams({ company, draw: '1', start: '0', length: '500', 'search[value]': '', 'search[regex]': 'false' });
    const res = await axios.post('https://www.sharesansar.com/company-price-history', params, {
        headers: {
            'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-Token': session.csrfToken,
            'Referer': `https://www.sharesansar.com/company/${symbol.toLowerCase()}`,
            'Accept': 'application/json, */*', 'Cookie': session.cookies, 'Origin': 'https://www.sharesansar.com'
        },
        timeout: 20000, httpsAgent: agent
    });
    return res.data;
}

async function main() {
    const symbol = 'NABIL';
    const session = await getShareSansarSession(symbol);
    console.log('companyId:', session.companyId, '| CSRF:', session.csrfToken?.slice(0, 15));

    // Try with different company identifiers
    const variants = [
        session.companyId,  // numeric: '16'
        symbol,             // 'NABIL'
        symbol.toLowerCase(), // 'nabil'
        '1',                // try ID 1 (smallest)
        '100',              // try ID 100
    ];

    for (const v of variants) {
        try {
            const d = await postPriceHistory(v, session, symbol);
            console.log(`company=${v}: status total=${d.recordsTotal}, len=${d.data?.length}`);
            if (d.data?.length > 0) {
                console.log('  FOUND DATA! First:', JSON.stringify(d.data[0]).slice(0, 200));
                break;
            }
        } catch(e) {
            console.log(`company=${v}: ERROR ${e.response?.status} ${e.message.slice(0,40)}`);
        }
    }

    // Also: Try fetching the live-trading page which gives current day data for ALL stocks
    // Then check if there's a "past date" URL for sharesansar live-trading
    console.log('\n--- Testing ShareSansar past-date live-trading ---');
    const pastDates = ['2025-01-30', '2025-01-15', '2024-12-15'];
    for (const d of pastDates) {
        try {
            const res = await axios.get(`https://www.sharesansar.com/live-trading?date=${d}`, {
                headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' },
                timeout: 15000, httpsAgent: agent
            });
            const html = res.data;
            const tableRow = html.match(/<tr[^>]*>(?:<td>[^<]*<\/td>){5,}/);
            console.log(`Date ${d}: status ${res.status}, hasTable=${!!tableRow}`);
            if (tableRow) console.log('  Row sample:', tableRow[0].replace(/<[^>]+>/g, '|').slice(0, 200));
        } catch(e) {
            console.log(`Date ${d}: ${e.response?.status} ${e.message.slice(0,40)}`);
        }
    }

    // Also: Check if ShareSansar has a date-specific market summary endpoint
    console.log('\n--- Testing NEPSE/NepseAlpha company history ---');
    const nepseAlphaVariants = [
        `https://nepsealpha.com/nepse-data/NABIL`,
        `https://nepsealpha.com/api/1/report/company/price-history?symbol=NABIL`,
        `https://nepsealpha.com/trading/1/report?symbol=NABIL&date=2025-01-15`,
    ];
    for (const url of nepseAlphaVariants) {
        try {
            const res = await axios.get(url, {
                headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json, text/html' },
                timeout: 10000, httpsAgent: agent
            });
            console.log(`${url.slice(30)}: ${res.status}, type=${typeof res.data}, len=${String(res.data).length}`);
            if (typeof res.data === 'object') console.log('  Keys:', Object.keys(res.data).slice(0,5).join(', '));
            else console.log('  Sample:', String(res.data).slice(0, 200));
        } catch(e) {
            console.log(`${url.slice(30)}: ${e.response?.status || e.code} ${e.message.slice(0,40)}`);
        }
    }
}

main().catch(console.error);
