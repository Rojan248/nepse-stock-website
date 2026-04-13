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
const aiService = require('../src/services/ai/AiService');
const { calculateSectors } = require('../src/services/ai/narrativeHelpers');

async function main() {
  console.log('=== Manual AI Overview Update (via AiService) ===\n');

  const stocks = await prisma.stock.findMany({
    where: { lastTradedPrice: { gt: 0 } }
  });

  if (stocks.length === 0) {
    console.error('No stocks found in database!');
    process.exit(1);
  }

  // 1. Generate Market Overview
  console.log('1. Generating Market Overview...');
  const marketSummary = await prisma.marketSummary.findFirst({ orderBy: { timestamp: 'desc' } });
  if (marketSummary) {
    const sectors = calculateSectors(stocks);
    await aiService.generateNarrative('MARKET', 'market', { 
        marketSummary, 
        sectors: sectors.slice(0, 8),
        triggeredBy: 'manual' 
    });
    console.log('   ✓ Market overview complete');
  }

  // 2. Generate Stock Overviews
  console.log(`2. Generating stock overviews for ${stocks.length} stocks...`);
  let generated = 0;
  let failed = 0;
  let limitReached = false;

  for (const stock of stocks) {
    try {
      const result = await aiService.generateNarrative(stock.symbol.toUpperCase(), 'stock', { 
          stock,
          triggeredBy: 'manual' 
      });
      
      if (result) {
        generated++;
      } else {
        // If result is null, it likely hit a rate/budget limit
        limitReached = true;
        break;
      }
      
      if (generated % 50 === 0) console.log(`   Progress: ${generated}/${stocks.length} stocks done`);
    } catch (err) {
      failed++;
      console.error(`   ✗ ${stock.symbol}: ${err.message}`);
    }
  }

  console.log(`\n=== Done ===`);
  if (limitReached) {
    console.warn('⚠️ WARNING: Process stopped because AI limits or budget were reached.');
  }
  console.log(`Market overview: ✓`);
  console.log(`Stock overviews: ${generated} generated, ${failed} failed`);
  
  const usage = await aiService.getDailyUsage();
  if (usage) {
      console.log(`\nToday's AI Stats:`);
      console.log(`- Calls: ${usage.callCount}`);
      console.log(`- Tokens: ${usage.tokenCount}`);
      console.log(`- Est. Cost: $${usage.costUSD.toFixed(4)}`);
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Fatal error:', err);
  prisma.$disconnect();
  process.exit(1);
});
