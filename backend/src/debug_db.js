const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const count = await prisma.stock.count();
        console.log(`Total stocks: ${count}`);

        const stocks = await prisma.stock.findMany({
            take: 5,
            orderBy: { symbol: 'asc' }
        });

        console.log('Top 5 stocks:');
        stocks.forEach(s => {
            console.log(`${s.symbol}: LTP=${s.lastTradedPrice}, Vol=${s.volume}, PrevClose=${s.previousClose}`);
        });

        // Check for zeros specifically
        const zeroLtp = await prisma.stock.count({
            where: { lastTradedPrice: 0 }
        });
        console.log(`Stocks with LTP=0: ${zeroLtp}`);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
