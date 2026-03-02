require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { computeBreadthFromDb } = require('./src/services/dataEnricher');

async function checkBreadth() {
    try {
        console.log('--- CHECKING DB BREADTH ---');

        // Check total stocks
        const total = await prisma.stock.count();
        console.log(`Total stocks: ${total}`);

        // Raw query for > 0, < 0, == 0
        const gt0 = await prisma.stock.count({ where: { percentageChange: { gt: 0 } } });
        const lt0 = await prisma.stock.count({ where: { percentageChange: { lt: 0 } } });
        const eq0 = await prisma.stock.count({ where: { OR: [{ percentageChange: 0 }, { percentageChange: null }] } });

        console.log(`Raw >0: ${gt0}`);
        console.log(`Raw <0: ${lt0}`);
        console.log(`Raw ==0/null: ${eq0}`);

        // Check Enriched
        const enriched = await computeBreadthFromDb(prisma);
        console.log('Enriched Breadth from dataEnricher.js:', enriched);

        // Look at a few stocks
        console.log('\nSample Stock Data:');
        const samples = await prisma.stock.findMany({ take: 5, select: { symbol: true, lastTradedPrice: true, previousClose: true, percentageChange: true, change: true } });
        console.table(samples);
    } finally {
        await prisma.$disconnect();
    }
}

checkBreadth();
