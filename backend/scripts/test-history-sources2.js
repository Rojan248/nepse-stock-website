/**
 * Test: Extract JSON data from MeroLagani company page (often has embedded chart data)
 * Also look for the AJAX endpoint URL in the source
 */
const axios = require('axios');
const https = require('https');

const agent = new https.Agent();

async function fetchAndAnalyze(name, url, headers = {}) {
    try {
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                ...headers
            },
            timeout: 20000,
            httpsAgent: agent
        });
        const html = res.data;
        console.log(`\n=== ${name} (${html.length} bytes) ===`);

        // Look for chart/history related endpoints in source
        const urlMatches = html.match(/['"](https?:\/\/[^'"]+(?:chart|history|price|stock)[^'"]*)['"]/gi) || [];
        if (urlMatches.length > 0) {
            console.log('Found URLs with chart/history/price:');
            urlMatches.slice(0, 10).forEach(u => console.log('  ', u.replace(/['"]/g, '').slice(0, 150)));
        }

        // Look for AJAX endpoints (common patterns)
        const ajaxMatches = html.match(/(?:url|action|endpoint|api)['":\s]+['"]([^'"]+)['"]/gi) || [];
        if (ajaxMatches.length > 0) {
            console.log('\nAJAX URL patterns:');
            ajaxMatches.slice(0, 15).forEach(m => console.log('  ', m.slice(0, 150)));
        }

        // Look for JSON data embedded in var declarations
        const jsonVars = html.match(/var\s+\w+\s*=\s*(\{[\s\S]{10,500}?\}|\[[\s\S]{10,500}?\]);/g) || [];
        if (jsonVars.length > 0) {
            console.log(`\nEmbedded JS vars (${jsonVars.length} found):`);
            jsonVars.slice(0, 5).forEach(v => console.log('  ', v.slice(0, 200)));
        }

        // Look for sharesansar-specific: stockdatas or similar patterns
        const ssEndpoints = html.match(/\/(?:stockdatas|price-history|company-data|getStock[^'"]*)[^'"<]*/gi) || [];
        if (ssEndpoints.length > 0) {
            console.log('\nShareSansar endpoint patterns:');
            ssEndpoints.slice(0, 10).forEach(e => console.log('  ', e.slice(0, 200)));
        }

        return html;
    } catch (e) {
        console.log(`\n=== ${name} FAILED: ${e.message} ===`);
        return null;
    }
}

// Also test PriceHistory-specific endpoints for ShareSansar
async function testShareSansarAjax() {
    const baseHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': 'https://www.sharesansar.com/company/nabil'
    };

    // Try known DataTables AJAX endpoints for ShareSansar
    const endpoints = [
        'https://www.sharesansar.com/company/stockdatas?symbol=NABIL&from=2024-01-01&to=2026-01-01&draw=1',
        'https://www.sharesansar.com/company/stockdatas?company=nabil&from=2024-01-01&to=2026-01-01',
        'https://www.sharesansar.com/company/stockdatas?company=NABIL&type=D',
        'https://www.sharesansar.com/company/getStockPrice?symbol=NABIL',
        'https://www.sharesansar.com/company/priceHistory?symbol=NABIL',
        'https://www.sharesansar.com/stockdata?symbol=NABIL'
    ];

    console.log('\n=== Testing ShareSansar AJAX endpoints ===');
    for (const ep of endpoints) {
        try {
            const res = await axios.get(ep, { headers: baseHeaders, timeout: 10000, httpsAgent: agent });
            const d = res.data;
            const type = typeof d;
            console.log(`  [${res.status}] ${ep.slice(40)}`);
            console.log(`    -> type: ${type}, len: ${typeof d === 'string' ? d.length : JSON.stringify(d).length}`);
            if (type === 'object') console.log(`    -> ${JSON.stringify(d).slice(0, 200)}`);
            else console.log(`    -> ${String(d).slice(0, 200)}`);
        } catch (e) {
            console.log(`  [${e.response?.status || 'ERR'}] ${ep.slice(40)} : ${e.message.slice(0, 60)}`);
        }
    }
}

async function main() {
    await fetchAndAnalyze('ShareSansar-company-NABIL', 'https://www.sharesansar.com/company/nabil', { Accept: 'text/html' });
    await testShareSansarAjax();
}

main().catch(console.error);
