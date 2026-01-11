const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        // Define stale threshold (e.g., 15 minutes ago)
        const threshold = new Date(Date.now() - 15 * 60 * 1000);
        console.log(`Cleaning up stocks not updated since: ${threshold.toISOString()}`);

        const result = await prisma.stock.deleteMany({
            where: {
                updatedAt: {
                    lt: threshold
                }
            }
        });

        console.log(`Deleted ${result.count} stale stocks.`);

        // Explicitly check for AIG/UAIL
        const aig = await prisma.stock.findUnique({ where: { symbol: 'AIG' } });
        const uail = await prisma.stock.findUnique({ where: { symbol: 'UAIL' } });

        console.log('AIG still exists?', !!aig);
        console.log('UAIL exists?', !!uail);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
