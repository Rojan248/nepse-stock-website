const { PrismaClient } = require('../node_modules/@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    // Get latest market summary timestamp (last stored snapshot)
    const latestSummary = await prisma.marketSummary.findFirst({ orderBy: { timestamp: 'desc' } });
    const ts = latestSummary?.timestamp ? latestSummary.timestamp.toISOString() : null;

    const [adv, dec, unc, topAdv, topDec, sampleUnc] = await Promise.all([
      prisma.stock.findMany({ where: { percentageChange: { gt: 0 } }, select: { symbol: true, percentageChange: true }, orderBy: { percentageChange: 'desc' } }),
      prisma.stock.findMany({ where: { percentageChange: { lt: 0 } }, select: { symbol: true, percentageChange: true }, orderBy: { percentageChange: 'asc' } }),
      prisma.stock.findMany({ where: { OR: [{ percentageChange: 0 }, { percentageChange: null }] }, select: { symbol: true } }),
      prisma.stock.findMany({ where: { percentageChange: { gt: 0 } }, select: { symbol: true, percentageChange: true }, orderBy: { percentageChange: 'desc' }, take: 10 }),
      prisma.stock.findMany({ where: { percentageChange: { lt: 0 } }, select: { symbol: true, percentageChange: true }, orderBy: { percentageChange: 'asc' }, take: 10 }),
      prisma.stock.findMany({ where: { OR: [{ percentageChange: 0 }, { percentageChange: null }] }, select: { symbol: true }, take: 10 })
    ]);

    console.log(JSON.stringify({
      snapshotTimestamp: ts,
      counts: {
        advanced: adv.length,
        declined: dec.length,
        unchanged: unc.length,
      },
      topAdvancers: topAdv,
      topDecliners: topDec,
      sampleUnchanged: sampleUnc
    }, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
})();
