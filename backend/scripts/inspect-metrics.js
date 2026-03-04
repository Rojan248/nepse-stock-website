require('dotenv').config();
const { prisma } = require('../src/services/database/connection');

function safeParseJSON(str) {
    try { return JSON.parse(str || '{}'); } catch (e) { console.warn('JSON parse error:', e.message); return {}; }
}

(async () => {
    const stock = await prisma.stock.findUnique({
        where: { symbol: 'NABIL' },
        select: { high52w: true, low52w: true, nepseSecurityId: true }
    });
    console.log('Stock NABIL high52w/low52w:', stock);

    const sm = await prisma.stockMetrics.findFirst({ where: { symbol: 'NABIL' }, orderBy: { date: 'desc' } });
    if (sm) {
        const pm  = safeParseJSON(sm.priceMetrics);
        const tm  = safeParseJSON(sm.trendMetrics);
        const mom = safeParseJSON(sm.momentumMetrics);
        const liq = safeParseJSON(sm.liquidityMetrics);
        console.log('priceMetrics high52w:', pm.high52w, 'low52w:', pm.low52w, 'source52w:', pm.source52w);
        console.log('trendMetrics ma20:', tm.ma20, 'ma50:', tm.ma50, 'ma180:', tm.ma180);
        console.log('momentumMetrics rsi14:', mom.rsi14, 'roc10d:', mom.roc10d);
        console.log('liquidityMetrics avgVol20d:', liq.avgVolume20d, 'tradingDays:', liq.tradingDays);
        console.log('priceMetrics weeklyChange:', pm.weeklyChange, 'monthlyChange:', pm.monthlyChange);
    }

    const missing = await prisma.stock.findMany({
        where: { OR: [{ high52w: null }, { low52w: null }] },
        select: { symbol: true }
    });
    console.log('\nStocks missing 52W:', missing.map(s => s.symbol).join(', '));

    const histCount = await prisma.marketHistory.count();
    console.log('Total MarketHistory records:', histCount);

    await prisma.$disconnect();
})().catch(e => console.log('ERR:', e.message));
