/**
 * Extract DataTables AJAX config for price history from ShareSansar company page
 */
const axios = require('axios');
const https = require('https');

const agent = new https.Agent({ rejectUnauthorized: false });

async function main() {
    const res = await axios.get('https://www.sharesansar.com/company/nabil', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html'
        },
        timeout: 20000,
        httpsAgent: agent
    });
    const html = res.data;

    // Find price-history related JS
    const priceHistorySection = html.match(/price.?histor[yiY][^<]{0,5000}/gi) || [];
    console.log(`Found ${priceHistorySection.length} price-history sections`);
    priceHistorySection.forEach((s, i) => {
        console.log(`\n--- Section ${i+1} (${s.length} chars) ---`);
        console.log(s.slice(0, 500));
    });

    // Look for company_id or numeric IDs in script context
    const scriptBlocks = html.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];
    console.log(`\n\nTotal script blocks: ${scriptBlocks.length}`);

    // Find blocks that mention company or price-history
    const relevantBlocks = scriptBlocks.filter(b =>
        b.includes('price-history') ||
        b.includes('priceHistory') ||
        b.includes('company_id') ||
        b.includes('company-price') ||
        b.includes('stock_id')
    );

    console.log(`Relevant script blocks: ${relevantBlocks.length}`);
    relevantBlocks.forEach((b, i) => {
        console.log(`\n### Script block ${i+1} ###`);
        // Strip <script> tags
        const inner = b.replace(/<script[^>]*>|<\/script>/g, '');
        console.log(inner.slice(0, 2000));
    });

    // Also look for hidden input fields that might have company_id
    const hiddenInputs = html.match(/<input[^>]+(?:company_id|stock_id|company-id)[^>]*>/gi) || [];
    console.log('\n\nHidden company ID inputs:');
    hiddenInputs.forEach(h => console.log('  ', h));

    // Look for data attributes on tables
    const dataAttrs = html.match(/data-(?:company|stock|id)[^=]*=["'][^"']*["']/gi) || [];
    console.log('\nData attributes:');
    dataAttrs.forEach(d => console.log('  ', d));

    // Look for any numeric IDs in the URL patterns
    const numericIds = html.match(/company[_-]?id["'\s]*[:=]+["'\s]*(\d+)/gi) || [];
    console.log('\nCompany ID matches:');
    numericIds.forEach(m => console.log('  ', m));
}

main().catch(console.error);
