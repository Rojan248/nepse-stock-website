const { mapStockOutput } = require('../../src/services/utils/dataNormalizer');

const mockStock = {
    symbol: 'TEST',
    companyName: 'Test Company Limited',
    sector: 'Banking',
    lastTradedPrice: 105,
    prices: { open: 100, high: 110, low: 95, close: 105, ltp: 105 },
    volume: 10000,
    turnover: 1050000,
    totalTrades: 50,
    change: 5,
    changePercent: 5.0,
    percentageChange: 5.0,
    previousClose: 100,
    openPrice: 100,
    highPrice: 110,
    lowPrice: 95,
    updatedAt: new Date()
};

const COUNT = 5000;
const stocks = Array.from({ length: COUNT }, (_, i) => ({
    ...mockStock,
    symbol: `TEST${i}`,
    id: i
}));

// Measure Time (Full)
const startFull = process.hrtime();
const mappedFull = stocks.map(s => mapStockOutput(s, false));
const endFull = process.hrtime(startFull);
const timeFullMs = (endFull[0] * 1000 + endFull[1] / 1e6).toFixed(2);

const payloadFull = JSON.stringify(mappedFull);
const sizeFullBytes = Buffer.byteLength(payloadFull, 'utf8');
const sizeFullMB = (sizeFullBytes / (1024 * 1024)).toFixed(2);

// Measure Time (Compact)
const startCompact = process.hrtime();
const mappedCompact = stocks.map(s => mapStockOutput(s, true));
const endCompact = process.hrtime(startCompact);
const timeCompactMs = (endCompact[0] * 1000 + endCompact[1] / 1e6).toFixed(2);

const payloadCompact = JSON.stringify(mappedCompact);
const sizeCompactBytes = Buffer.byteLength(payloadCompact, 'utf8');
const sizeCompactMB = (sizeCompactBytes / (1024 * 1024)).toFixed(2);

console.log(`Stocks: ${COUNT}`);
console.log(`[FULL] Time: ${timeFullMs} ms`);
console.log(`[FULL] Payload Size: ${sizeFullBytes} bytes (${sizeFullMB} MB)`);
console.log(`[COMPACT] Time: ${timeCompactMs} ms`);
console.log(`[COMPACT] Payload Size: ${sizeCompactBytes} bytes (${sizeCompactMB} MB)`);
console.log(`Reduction: ${((1 - sizeCompactBytes / sizeFullBytes) * 100).toFixed(2)}%`);
