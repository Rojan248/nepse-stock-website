const { PrismaClient } = require('../node_modules/@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const summary = await prisma.marketSummary.findFirst({ orderBy: { timestamp: 'desc' } });
    console.log(summary);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
})();
