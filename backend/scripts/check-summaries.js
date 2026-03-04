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
    let n;
    try {
      n = JSON.parse(r.narrative);
    } catch (parseErr) {
      console.warn(`WARNING: Failed to parse narrative for ${r.symbol} (updated ${r.updatedAt}):`, parseErr.message);
      return;
    }
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
