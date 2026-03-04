require('dotenv').config();
const { prisma } = require('../src/services/database/connection');

function safeParseJSON(str) {
    try { return JSON.parse(str || '{}'); } catch (e) { console.warn('JSON parse error:', e.message); return {}; }
}

(async () => {
    const symbols = ['NABIL', 'HBL', 'PHCL'];  // sample stocks
    for (const sym of symbols) {
        const stock = await prisma.stock.findUnique({
            where: { symbol: sym },
            select: { high52w: true, low52w: true, ma180Ext: true, ma120Ext: true, yearlyYield: true, avgVol30dExt: true }
        });
        const sm = await prisma.stockMetrics.findFirst({ where: { symbol: sym }, orderBy: { date: 'desc' } });
        if (!sm) { console.log(sym, ': no metrics'); continue; }
        const pm  = safeParseJSON(sm.priceMetrics);
        const tm  = safeParseJSON(sm.trendMetrics);
        const liq = safeParseJSON(sm.liquidityMetrics);
        console.log(`\n--- ${sym} ---`);
        console.log('Stock ext fields:', stock);
        console.log('52W:', pm.high52w, '/', pm.low52w, '| source:', pm.source52w);
        console.log('yearlyChange:', pm.yearlyChange);
        console.log('MA180:', tm.ma180, '| source:', tm.source_ma180);
        console.log('MA120:', tm.ma120, '| source:', tm.source_ma120);
        console.log('MA50:', tm.ma50, '| MA20:', tm.ma20);
        console.log('trend:', tm.trend, '| priceVsMa180:', tm.priceVsMa180?.toFixed(2));
        console.log('avgVolume20d:', liq.avgVolume20d, '| sourceVolume:', liq.sourceVolume);
    }

    const missing52w = await prisma.stock.count({ where: { OR: [{ high52w: null }, { low52w: null }] } });
    const missingMa180 = await prisma.stock.count({ where: { ma180Ext: null } });
    console.log('\nStocks missing high52w:', missing52w);
    console.log('Stocks missing ma180Ext:', missingMa180);

    await prisma.$disconnect();
})().catch(e => console.log('ERR:', e.message));
