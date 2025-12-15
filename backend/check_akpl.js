const axios = require('axios');

async function checkAKPL() {
    try {
        const response = await axios.get('http://localhost:5000/api/stocks?limit=2000');
        const stocks = response.data.data;
        const akpl = stocks.find(s => s.symbol === 'AKPL');

        if (akpl) {
            console.log(`AKPL Details:`);
            console.log(`LTP: ${akpl.ltp}`);
            console.log(`PrevClose: ${akpl.previousClose}`);
            console.log(`Open: ${akpl.open}`);
            console.log(`High: ${akpl.high}`);
            console.log(`Low: ${akpl.low}`);
            console.log(`Vol: ${akpl.volume}`);
            console.log(`Change: ${akpl.change}`);
        } else {
            console.log('AKPL not found');
        }
        // Disabled ACLBSL check
        const aclbsl = stocks.find(s => s.symbol === 'ACLBSL');
        if (aclbsl) {
            console.log(`ACLBSL Details:`);
            console.log(`LTP: ${aclbsl.ltp}`);
            console.log(`High: ${aclbsl.high}`);
            console.log(`Low: ${aclbsl.low}`);
        }

    } catch (error) {
        console.error('Error:', error.message);
    }
}

checkAKPL();
