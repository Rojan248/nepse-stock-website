/**
 * Manual AI Overview Updater
 * Generates AI-like overviews for all stocks and market summary
 * directly from database data, bypassing the Gemini API.
 * 
 * Usage: node scripts/manualAIUpdate.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { generateMarketNarrative, generateStockNarrative, calculateSectors } = require('./narrativeHelpers');

// ── Main ──────────────────────────────────────────────────────────────────────

async function generateAndSaveMarketOverview(stocks) {
  const marketSummary = await prisma.marketSummary.findFirst({ orderBy: { timestamp: 'desc' } });
  if (!marketSummary) {
    console.error('No market summary found in database!');
    process.exit(1);
  }

  const sectors = calculateSectors(stocks);

  const marketNarrative = generateMarketNarrative(marketSummary, sectors);
  marketNarrative.generatedAt = new Date().toISOString();

  await prisma.aIOverview.upsert({
    where: { symbol_type: { symbol: 'MARKET', type: 'market' } },
    update: {
      narrative: JSON.stringify(marketNarrative),
      context: JSON.stringify({ marketSummary, sectors: sectors.slice(0, 8) }),
      modelVersion: 'manual-generation',
      tokenCount: 0,
      triggeredBy: 'manual',
      updatedAt: new Date()
    },
    create: {
      symbol: 'MARKET',
      type: 'market',
      narrative: JSON.stringify(marketNarrative),
      context: JSON.stringify({ marketSummary, sectors: sectors.slice(0, 8) }),
      modelVersion: 'manual-generation',
      tokenCount: 0,
      triggeredBy: 'manual'
    }
  });

  console.log('   ✓ Market overview saved');
  return marketNarrative;
}

async function saveStockToDb(stock) {
  const narrative = generateStockNarrative(stock);
  narrative.generatedAt = new Date().toISOString();

  await prisma.aIOverview.upsert({
    where: { symbol_type: { symbol: stock.symbol.toUpperCase(), type: 'stock' } },
    update: {
      narrative: JSON.stringify(narrative),
      context: JSON.stringify({
        symbol: stock.symbol, ltp: stock.lastTradedPrice, change: stock.change,
        percentageChange: stock.percentageChange || stock.changePercent
      }),
      modelVersion: 'manual-generation',
      tokenCount: 0,
      triggeredBy: 'manual',
      updatedAt: new Date()
    },
    create: {
      symbol: stock.symbol.toUpperCase(),
      type: 'stock',
      narrative: JSON.stringify(narrative),
      context: JSON.stringify({
        symbol: stock.symbol, ltp: stock.lastTradedPrice, change: stock.change,
        percentageChange: stock.percentageChange || stock.changePercent
      }),
      modelVersion: 'manual-generation',
      tokenCount: 0,
      triggeredBy: 'manual'
    }
  });
}

async function generateAndSaveStockOverviews(stocks) {
  let generated = 0;
  let failed = 0;

  for (const stock of stocks) {
    try {
      await saveStockToDb(stock);
      generated++;
      if (generated % 50 === 0) console.log(`   Progress: ${generated}/${stocks.length} stocks done`);
    } catch (err) {
      failed++;
      console.error(`   ✗ ${stock.symbol}: ${err.message}`);
    }
  }
  return { generated, failed };
}

async function main() {
  console.log('=== Manual AI Overview Update ===\n');

  const stocks = await prisma.stock.findMany({
    where: { lastTradedPrice: { gt: 0 } }
  });

  console.log('1. Generating Market Overview...');
  await generateAndSaveMarketOverview(stocks);

  console.log(`2. Generating stock overviews for ${stocks.length} stocks...`);
  const { generated, failed } = await generateAndSaveStockOverviews(stocks);

  console.log(`\n=== Done ===`);
  console.log(`Market overview: ✓`);
  console.log(`Stock overviews: ${generated} generated, ${failed} failed`);
  console.log(`Total: ${generated + 1} overviews updated`);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Fatal error:', err);
  prisma.$disconnect();
  process.exit(1);
});
