require('dotenv').config();
const { prisma } = require('../src/services/database/connection');
async function main() {
  const r = await prisma.aIOverview.findFirst({ where: { type: 'market' }, orderBy: { updatedAt: 'desc' } });
  if (!r) { console.log('No market overview'); process.exit(0); }
  const n = JSON.parse(r.narrative);
  console.log('MODEL:', r.modelVersion);
  console.log('UPDATED:', r.updatedAt.toISOString());
  console.log('SUMMARY:', n.summary);
  console.log('BULLETS:');
  (n.bullets || []).forEach(b => console.log('  -', b));
  console.log('OUTLOOK:', n.outlook);
  await prisma.$disconnect();
}
main().catch(e => { console.error(e.message); process.exit(1); });
