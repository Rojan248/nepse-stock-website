const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { fetchLatestData } = require('./services/dataFetcher');

async function check() {
    const data = await fetchLatestData();
    const fetchedAIL = data.stocks.find(s => s.symbol === 'AIL');
    const fetchedAVU = data.stocks.find(s => s.symbol === 'AVU');

    const dbAIL = await prisma.stock.findUnique({ where: { symbol: 'AIL' } });
    const dbAVU = await prisma.stock.findUnique({ where: { symbol: 'AVU' } });

    fs.writeFileSync('output.log', JSON.stringify({
        fetched: { AIL: fetchedAIL, AVU: fetchedAVU },
        database: { AIL: dbAIL, AVU: dbAVU }
    }, null, 2));

    await prisma.$disconnect();
}
check();
