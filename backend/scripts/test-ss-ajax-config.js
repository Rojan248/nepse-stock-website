const axios = require('axios');
const https = require('https');

// TLS verification bypass — only for local debugging through trusted proxies.
// Set DISABLE_TLS_VERIFY=true in your environment when required;
// never commit or use this in production environments.
const agent = new https.Agent({ rejectUnauthorized: process.env.DISABLE_TLS_VERIFY !== 'true' });

async function main() {
    const res = await axios.get('https://www.sharesansar.com/company/nabil', {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' },
        timeout: 20000,
        httpsAgent: agent
    });
    const html = res.data;

    // Find the full price history DataTable config
    // Look for the ajax config block
    const idx = html.indexOf('company-price-history');
    if (idx > -1) {
        // Get surrounding context (2000 chars before and after)
        const start = Math.max(0, idx - 1500);
        const end = Math.min(html.length, idx + 3000);
        console.log('=== company-price-history context ===');
        console.log(html.slice(start, end));
    }

    // Also look for the CSRF token in the HTML (meta or hidden input)
    const metaToken = html.match(/<meta[^>]+(?:name=["'](?:_token|csrf-token)["']|csrf)[^>]*>/gi) || [];
    console.log('\n=== CSRF meta tags ===');
    metaToken.forEach(m => console.log(m));

    // Look in head for any token
    const headSection = html.match(/<head[\s\S]*?<\/head>/i);
    if (headSection) {
        const tokenInHead = headSection[0].match(/token[^<]{0,200}/gi) || [];
        tokenInHead.slice(0, 5).forEach(t => console.log('Head token:', t.slice(0, 150)));
    }
}

main().catch(console.error);
