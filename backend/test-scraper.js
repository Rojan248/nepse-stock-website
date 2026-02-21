const axios = require('axios');
const cheerio = require('cheerio');

async function test() {
    try {
        const r = await axios.get('https://www.sharesansar.com/live-trading', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $ = cheerio.load(r.data);

        const ths = $('thead tr th').map((i, el) => $(el).text().trim()).get();
        console.log("Headers:", ths);

        const row = $('tbody tr').first();
        const tds = row.find('td').map((i, el) => $(el).text().trim()).get();
        console.log("First Row:", tds);
    } catch (e) {
        console.error(e.message);
    }
}
test();
