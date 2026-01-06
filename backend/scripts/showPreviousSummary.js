const { PrismaClient } = require('../node_modules/@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const rows = await prisma.marketSummary.findMany({ orderBy: { timestamp: 'desc' }, take: 2 });
    console.log(rows);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
})();
