const axios = require('axios');

async function test() {
    const url = 'https://merolagani.com/handlers/TechnicalChartHandler.ashx?type=stock_history&symbol=NABIL';
    try {
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://merolagani.com/'
            },
            timeout: 15000
        });
        const data = res.data;
        const type = typeof data;
        const isArr = Array.isArray(data);
        const keys = (type === 'object' && !isArr) ? Object.keys(data).slice(0, 8) : 'N/A (array)';
        console.log('Status:', res.status);
        console.log('Type:', type, '| isArray:', isArr);
        console.log('Keys:', JSON.stringify(keys));
        if (isArr && data.length > 0) {
            console.log('First entry:', JSON.stringify(data[0]));
            console.log('Last entry:', JSON.stringify(data[data.length - 1]));
            console.log('Total entries:', data.length);
        } else if (type === 'object') {
            for (const k of Object.keys(data).slice(0, 5)) {
                const v = data[k];
                const sample = Array.isArray(v) ? `Array(${v.length}) first=${JSON.stringify(v[0])}` : JSON.stringify(v);
                console.log(`  ${k}: ${sample}`);
            }
        } else {
            console.log('Raw (first 500):', String(data).slice(0, 500));
        }
    } catch (e) {
        console.log('Error:', e.message, '| HTTP status:', e.response?.status);
        if (e.response?.data) console.log('Response body:', String(e.response.data).slice(0, 300));
    }
}

test();
