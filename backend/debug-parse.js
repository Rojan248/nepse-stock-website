const { parsePrice } = require('./src/services/dataEnricher');

const CHANGE_FIELDS = ['percentageChange', 'percentChange', 'perChange', 'changePercent', 'change_percentage'];
const LTP_FIELDS = ['lastTradedPrice', 'ltp', 'closePrice'];
const PREV_FIELDS = ['previousClose', 'previousClosingPrice', 'prevClose', 'previous_close'];

function resolveFirstFinite(obj, fields) {
    for (const f of fields) {
        if (obj[f] != null) {
            const value = String(obj[f]).trim().replace(/,/g, '');
            const v = parseFloat(value);
            if (Number.isFinite(v)) return v;
        }
    }
    return undefined;
}

function computeFromPrices(sec) {
    const ltp = resolveFirstFinite(sec, LTP_FIELDS);
    const prev = resolveFirstFinite(sec, PREV_FIELDS);
    return (Number.isFinite(ltp) && Number.isFinite(prev) && prev !== 0) ? ((ltp - prev) / prev) * 100 : undefined;
}

function resolveSecurityChange(sec) {
    return resolveFirstFinite(sec, CHANGE_FIELDS) ?? computeFromPrices(sec);
}

// simulate a security from the NEPSE API
const sec = {
    symbol: 'NABIL',
    closePrice: '1,200',
    previousClosingPrice: '1,100',
    percentageChange: '9.09'
};

const sec2 = {
    symbol: 'ADBL',
    ltp: 295.4,
    previousClose: 295.4,
    perChange: 0
};

console.log('sec1 change:', resolveSecurityChange(sec));
console.log('sec2 change:', resolveSecurityChange(sec2));

