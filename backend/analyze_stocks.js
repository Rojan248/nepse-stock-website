const axios = require('axios');

async function checkStocks() {
    try {
        const response = await axios.get('http://localhost:5000/api/stocks?limit=2000');
        const stocks = response.data.data || []; // Adjust based on actual API response structure

        console.log(`Total stocks fetched: ${stocks.length}`);

        if (stocks.length > 0) {
            console.log('Sample Stocks Sectors:');
            stocks.slice(0, 5).forEach(s => console.log(`${s.symbol}: ${s.sector}`));
        }

        const nepseIndexSector = stocks.filter(s => s.sector === 'NEPSE Index');
        console.log(`Stocks with "NEPSE Index" sector: ${nepseIndexSector.length}`);

        const zeroLtp = stocks.filter(s => !s.ltp || s.ltp === 0);
        const zeroVolume = stocks.filter(s => !s.volume || s.volume === 0);
        const missingName = stocks.filter(s => !s.companyName || s.companyName === s.symbol);
        const missingSector = stocks.filter(s => !s.sector);

        console.log(`Stocks with 0 LTP: ${zeroLtp.length}`);
        if (zeroLtp.length > 0) {
            console.log('Sample 0 LTP:', zeroLtp.slice(0, 3).map(s => s.symbol));
        }

        console.log(`Stocks with 0 Volume: ${zeroVolume.length}`);
        if (zeroVolume.length > 0) {
            console.log('Sample 0 Volume:', zeroVolume.slice(0, 3).map(s => s.symbol));
        }

        console.log(`Stocks with missing/same name: ${missingName.length}`);
        if (missingName.length > 0) {
            console.log('Sample missing name:', missingName.slice(0, 3).map(s => s.symbol));
        }
    } catch (error) {
        console.error('Error fetching/analyzing:', error.message);
    }
}

checkStocks();
