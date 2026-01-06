const axios = require('axios');

async function probeNepseAlpha() {
    console.log('Probing NepseAlpha...');
    try {
        const { data } = await axios.get('https://nepsealpha.com/trading-menu');
        // It returns HTML, but maybe it has data embedded in script tags or simple structure
        // Or maybe there is an API endpoint: https://nepsealpha.com/api/smx/920/dashboard_index
        
        // Let's try a known API endpoint if possible.
        // Common one: https://nepsealpha.com/api/smx/920/dashboard_index (might be dynamic)
        
        console.log('Length:', data.length);
        
        // Look for "NEPSE Index"
        const match = data.match(/NEPSE Index.*?([\d,]+\.?\d*)/i);
        if (match) console.log('Index found:', match[1]);
        
    } catch (e) {
        console.error('NepseAlpha failed:', e.message);
    }
}

probeNepseAlpha();
