/**
 * Test multiple NEPSE historical data sources
 */
const axios = require('axios');
const https = require('https');

const agent = new https.Agent({ rejectUnauthorized: false });

async function tryUrl(name, url, headers = {}) {
    try {
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                ...headers
            },
            timeout: 15000,
            httpsAgent: agent
        });
        const data = res.data;
        const type = typeof data;
        const isArr = Array.isArray(data);
        const len = isArr ? data.length : (type === 'string' ? data.length : Object.keys(data).length);
        console.log(`\n[${name}] Status: ${res.status}, type: ${type}, isArr: ${isArr}, len: ${len}`);
        if (isArr && data.length > 0) {
            console.log('  First:', JSON.stringify(data[0]).slice(0, 200));
        } else if (type === 'object' && !isArr) {
            const keys = Object.keys(data);
            console.log('  Keys:', keys.slice(0, 6).join(', '));
            for (const k of keys.slice(0, 3)) {
                const v = data[k];
                const sample = Array.isArray(v) ? `Array(${v.length})[0]=${JSON.stringify(v[0]).slice(0,100)}` : JSON.stringify(v).slice(0, 100);
                console.log(`  ${k}: ${sample}`);
            }
        } else if (type === 'string') {
            // Try to extract table rows from HTML
            const tableMatch = data.match(/<table[^>]*>[\s\S]*?<\/table>/);
            if (tableMatch) {
                console.log('  Found HTML table, length:', tableMatch[0].length);
                const rows = tableMatch[0].match(/<tr[\s\S]*?<\/tr>/g);
                console.log('  Rows:', rows ? rows.length : 0);
                if (rows && rows.length > 1) {
                    console.log('  Row 1:', rows[1].replace(/<[^>]+>/g, '|').slice(0, 200));
                }
            } else {
                console.log('  Raw (200 chars):', data.slice(0, 200));
            }
        }
        return true;
    } catch (e) {
        console.log(`\n[${name}] FAILED: ${e.message} (HTTP ${e.response?.status || 'N/A'})`);
        return false;
    }
}

async function main() {
    const symbol = 'NABIL';
    const today = new Date();
    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const fmt = d => d.toISOString().split('T')[0];

    console.log('Testing NEPSE historical data sources...\n');

    // 1. MeroLagani variants
    await tryUrl('MeroLagani-v1', `https://merolagani.com/handlers/TechnicalChartHandler.ashx?type=stock_history&symbol=${symbol}`);
    await tryUrl('MeroLagani-v2', `https://merolagani.com/handlers/TechnicalChartHandler.ashx?type=stock_history&interval=D&symbol=${symbol}`);
    await tryUrl('MeroLagani-v3', `https://merolagani.com/handlers/TechnicalChartHandler.ashx?type=company_history&id=${symbol}`);

    // 2. NepseAlpha
    await tryUrl('NepseAlpha-v1', `https://nepsealpha.com/nepse-data/${symbol}/history?from=${fmt(oneYearAgo)}&to=${fmt(today)}`);
    await tryUrl('NepseAlpha-v2', `https://nepsealpha.com/api/1/report/company/history?symbol=${symbol}&startDate=${fmt(oneYearAgo)}&endDate=${fmt(today)}`);

    // 3. ShareSansar company page
    await tryUrl('ShareSansar-company', `https://www.sharesansar.com/company/${symbol.toLowerCase()}`, { 'Accept': 'text/html' });

    // 4. NEPSE official - datewise (authenticated may be needed)
    await tryUrl('NEPSE-datewise', `https://www.nepalstock.com.np/api/nots/datewise-indices?indexId=58&startDate=${fmt(oneYearAgo)}&endDate=${fmt(today)}`);

    // 5. ShareSansar stock history endpoint
    await tryUrl('ShareSansar-history', `https://www.sharesansar.com/company/getCompanyDetails?symbol=${symbol}&type=price-history`);
    await tryUrl('ShareSansar-chart', `https://www.sharesansar.com/company/chart-data?symbol=${symbol}`);

    // 6. Try NepseAPI proxy for historical
    await tryUrl('NepseAPI-history', `https://nepseapi.onrender.com/api/history/${symbol}`);

    // 7. Merolagani company detail (HTML)
    await tryUrl('MeroLagani-company', `https://merolagani.com/CompanyDetail.aspx?comId=${symbol}`, { 'Accept': 'text/html' });

    // 8. Try NEPSE API security endpoint
    await tryUrl('NEPSE-security', `https://www.nepalstock.com.np/api/nots/security/${symbol}`);
}

main().catch(console.error);
