require('dotenv').config();
const { prisma } = require('../src/services/database/connection');
async function main() {
  const rows = await prisma.aIOverview.findMany({
    where: { type: 'stock' },
    orderBy: { updatedAt: 'desc' },
    take: 3,
    select: { symbol: true, narrative: true, modelVersion: true, updatedAt: true }
  });
  rows.forEach(r => {
    const n = JSON.parse(r.narrative);
    console.log('=== ' + r.symbol + ' [' + r.modelVersion + '] ' + r.updatedAt.toISOString().slice(11,19) + ' ===');
    console.log('SUMMARY:', n.summary);
    console.log('BULLETS:');
    (n.bullets||[]).forEach(b => console.log('  -', b));
    console.log('OUTLOOK:', n.outlook);
    console.log();
  });
  await prisma.$disconnect();
}
main().catch(e => { console.error(e.message); process.exit(1); });
