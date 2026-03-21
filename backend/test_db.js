const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const summary = await prisma.marketSummary.findFirst({ orderBy: { id: 'desc' } });
    console.log("MARKET SUMMARY in DB:");
    console.log(summary);
}
main().finally(() => prisma.$disconnect());
