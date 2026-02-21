const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
    const summaries = await prisma.marketSummary.findMany({
        orderBy: { timestamp: 'desc' },
        take: 10,
        select: { timestamp: true, advancedCompanies: true, declinedCompanies: true, unchangedCompanies: true, totalTransactions: true }
    });

    const stocks = await prisma.stock.findMany({
        take: 5,
        select: { symbol: true, change: true, percentageChange: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' }
    });

    fs.writeFileSync('db_dump.json', JSON.stringify({ summaries, stocks }, null, 2), 'utf-8');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
