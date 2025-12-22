
const fs = require('fs');
const path = require('path');

function extractInfo() {
    const stocksJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'stocks.json'), 'utf8'));
    const compareResults = JSON.parse(fs.readFileSync(path.join(__dirname, 'compare_results.json'), 'utf8'));
    const extraSymbols = new Set(compareResults.extraInSaved);

    const extraInfo = stocksJson
        .filter(s => extraSymbols.has(s.symbol.toUpperCase()))
        .map(s => ({
            symbol: s.symbol,
            name: s.companyName,
            sector: s.sector,
            base: s.previousClose || 0
        }));

    fs.writeFileSync(path.join(__dirname, 'extra_stock_info.json'), JSON.stringify(extraInfo, null, 2));
    console.log('Extra stock info written to extra_stock_info.json');
}

extractInfo();
