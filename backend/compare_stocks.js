
const fs = require('fs');
const path = require('path');
const NEPSE_STOCKS = require('./src/data/nepseStocks');

async function compare() {
    try {
        const stocksJsonPath = path.join(__dirname, 'data', 'stocks.json');
        if (!fs.existsSync(stocksJsonPath)) {
            console.log('stocks.json not found');
            return;
        }

        const stocksJson = JSON.parse(fs.readFileSync(stocksJsonPath, 'utf8'));
        const savedSymbols = new Set(stocksJson.map(s => s.symbol.toUpperCase()));
        const staticSymbols = NEPSE_STOCKS.map(s => s.symbol.toUpperCase());

        const missingInSaved = staticSymbols.filter(s => !savedSymbols.has(s));
        const extraInSaved = Array.from(savedSymbols).filter(s => !staticSymbols.includes(s));

        const results = {
            staticCount: staticSymbols.length,
            savedCount: savedSymbols.size,
            missingInSaved,
            extraInSaved
        };

        fs.writeFileSync(path.join(__dirname, 'compare_results.json'), JSON.stringify(results, null, 2));
        console.log('Results written to compare_results.json');

    } catch (err) {
        console.error(err);
    }
}

compare();
