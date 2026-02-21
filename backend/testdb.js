const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const summaries = await prisma.marketSummary.findMany({
        orderBy: { timestamp: 'desc' },
        take: 5
    });
    console.log("MARKET SUMMARIES:");
    console.log(JSON.stringify(summaries, null, 2));

    const stocks = await prisma.stock.findMany({
        take: 5,
        select: { symbol: true, lastTradedPrice: true, previousClose: true, change: true, percentageChange: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' }
    });
    console.log("RECENT STOCKS:");
    console.log(JSON.stringify(stocks, null, 2));
}

main().finally(() => prisma.$disconnect());
