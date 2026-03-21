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

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtNPR(val) {
  if (val == null || isNaN(val)) return 'N/A';
  return `NPR ${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function fmtLakh(val) {
  if (val == null || isNaN(val)) return 'N/A';
  const num = Number(val);
  const abs = Math.abs(num);
  if (abs >= 10000000) return `${(num / 10000000).toFixed(2)} crore`;
  if (abs >= 100000) return `${(num / 100000).toFixed(2)} lakh`;
  return num.toLocaleString('en-IN');
}

function pctWord(pct) {
  const abs = Math.abs(pct);
  if (abs >= 5) return 'significantly';
  if (abs >= 2) return 'noticeably';
  if (abs >= 0.5) return 'slightly';
  return 'barely';
}

function trendWord(pct) {
  if (pct > 2) return 'strong rise';
  if (pct > 0.5) return 'moderate gain';
  if (pct > 0) return 'slight gain';
  if (pct === 0) return 'no change';
  if (pct > -0.5) return 'slight dip';
  if (pct > -2) return 'moderate decline';
  return 'sharp drop';
}

// ── Market Overview Generator ─────────────────────────────────────────────────

function generateMarketNarrative(summary, sectors) {
  const idx = summary.indexValue;
  const chg = summary.indexChange;
  const chgPct = summary.indexChangePercent;
  const adv = summary.advancedCompanies;
  const dec = summary.declinedCompanies;
  const unch = summary.unchangedCompanies;
  const totalTraded = adv + dec + unch;
  const turnover = summary.totalTurnover;
  const volume = summary.totalVolume;

  const direction = chg >= 0 ? 'up' : 'down';
  const dirWord = chg >= 0 ? 'positive' : 'negative';

  // Summary  
  let summaryText;
  if (chgPct >= 2) {
    summaryText = `Today was a very strong day for the NEPSE market. The index surged ${direction} by ${Math.abs(chg).toFixed(2)} points (${Math.abs(chgPct).toFixed(2)}%), closing at ${idx.toFixed(2)}. Out of ${totalTraded} stocks that were traded, ${adv} went ${direction === 'up' ? 'up' : 'down'} and only ${dec} moved the other way — a very ${dirWord} session overall.`;
  } else if (chgPct >= 0.5) {
    summaryText = `The NEPSE market had a ${dirWord} day today. The index moved ${direction} by ${Math.abs(chg).toFixed(2)} points (${Math.abs(chgPct).toFixed(2)}%), settling at ${idx.toFixed(2)}. ${adv} stocks advanced while ${dec} declined out of ${totalTraded} traded stocks.`;
  } else if (chgPct >= 0) {
    summaryText = `The market had a relatively quiet day. The NEPSE index edged ${direction} by ${Math.abs(chg).toFixed(2)} points (${Math.abs(chgPct).toFixed(2)}%) to close at ${idx.toFixed(2)}. ${adv} stocks gained while ${dec} dropped.`;
  } else {
    summaryText = `The NEPSE market had a ${dirWord} session today. The index fell by ${Math.abs(chg).toFixed(2)} points (${Math.abs(chgPct).toFixed(2)}%) to close at ${idx.toFixed(2)}. ${dec} stocks declined while ${adv} managed to advance.`;
  }

  // Bullets
  const bullets = [];
  bullets.push(`The total value of shares traded today was about NPR ${fmtLakh(turnover)}, with around ${fmtLakh(volume)} shares changing hands.`);
  
  if (adv > dec * 5) {
    bullets.push(`${adv} out of ${totalTraded} stocks went up today, while only ${dec} lost value — a very strong day across the board.`);
  } else if (adv > dec) {
    bullets.push(`More stocks went up (${adv}) than went down (${dec}) today, showing overall positive market mood.`);
  } else {
    bullets.push(`More stocks went down (${dec}) than went up (${adv}) today, showing overall cautious market mood.`);
  }

  // Top sectors
  const topSectors = sectors.slice(0, 3);
  if (topSectors.length >= 2) {
    const sectorNames = topSectors.map(s => s.name).join(' and ');
    bullets.push(`The ${sectorNames} sectors did especially well, meaning companies in those areas saw the biggest price increases.`);
  }

  // Declining info
  if (dec <= 10) {
    bullets.push(`Only ${dec} stocks dropped in price today, showing that almost every company on the market had a positive day.`);
  } else if (dec > adv) {
    bullets.push(`${dec} stocks lost value today, more than the ${adv} that gained, suggesting some selling pressure in the market.`);
  }

  // Outlook
  let outlook;
  if (chgPct >= 2 && adv > dec * 5) {
    outlook = `The market had a very strong day with nearly every stock gaining value. This kind of broad positive movement usually means investors are feeling confident about the overall economy.`;
  } else if (chgPct >= 0.5) {
    outlook = `The market showed steady positive movement today. The healthy balance of advancing stocks suggests continued investor confidence.`;
  } else if (chgPct >= 0) {
    outlook = `The market was relatively stable today with mild gains. This suggests a wait-and-watch approach from most investors.`;
  } else {
    outlook = `The market saw some selling pressure today. Investors may be taking a cautious approach, but single-day declines are normal and not necessarily a sign of trouble.`;
  }

  return { summary: summaryText, bullets, outlook };
}

// ── Stock Overview Generator ──────────────────────────────────────────────────

function generateStockNarrative(stock) {
  const ltp = stock.lastTradedPrice || stock.ltp;
  const prevClose = stock.previousClose;
  const change = stock.change || (ltp - prevClose);
  const changePct = stock.percentageChange || stock.changePercent || (prevClose ? ((change / prevClose) * 100) : 0);
  const volume = stock.volume || stock.totalTradeQuantity || 0;
  const turnover = stock.turnover || 0;
  const sector = stock.sector || 'N/A';
  const name = stock.companyName || stock.symbol;
  const high = stock.highPrice || stock.high;
  const low = stock.lowPrice || stock.low;
  const w52High = stock.fiftyTwoWeekHigh;
  const w52Low = stock.fiftyTwoWeekLow;

  const direction = changePct >= 0 ? 'up' : 'down';
  const absChgPct = Math.abs(changePct).toFixed(2);

  // Summary
  let summary;
  if (changePct >= 3) {
    summary = `${name} (${stock.symbol}) had a very strong day, with its share price climbing ${absChgPct}% to reach ${fmtNPR(ltp)}. The stock is in the ${sector} sector and saw solid buying interest today.`;
  } else if (changePct >= 0.5) {
    summary = `${name} (${stock.symbol}) ended the day with a ${pctWord(changePct)} rise of ${absChgPct}%, closing at ${fmtNPR(ltp)}. This ${sector} sector stock had a positive trading session.`;
  } else if (changePct > -0.5) {
    summary = `${name} (${stock.symbol}) closed at ${fmtNPR(ltp)}, with a ${changePct >= 0 ? 'marginal gain' : 'slight dip'} of ${absChgPct}%. The stock in the ${sector} sector had a quiet day.`;
  } else if (changePct > -3) {
    summary = `${name} (${stock.symbol}) saw a decline of ${absChgPct}% today, closing at ${fmtNPR(ltp)}. The ${sector} sector stock faced some selling pressure.`;
  } else {
    summary = `${name} (${stock.symbol}) dropped ${absChgPct}% to close at ${fmtNPR(ltp)}. The ${sector} sector stock had a difficult session with notable selling.`;
  }

  // Bullets
  const bullets = [];
  
  bullets.push(`The stock closed at ${fmtNPR(ltp)}, which is ${fmtNPR(Math.abs(change))} ${direction} from yesterday's close of ${fmtNPR(prevClose)}.`);

  if (volume > 0) {
    bullets.push(`Around ${fmtLakh(volume)} shares were traded today${turnover > 0 ? `, worth about NPR ${fmtLakh(turnover)} in total` : ''}.`);
  }

  if (high && low && high !== low) {
    bullets.push(`Today's price ranged between ${fmtNPR(low)} and ${fmtNPR(high)}.`);
  }

  if (w52High && w52Low) {
    const range = w52High - w52Low;
    const position = range > 0 ? ((ltp - w52Low) / range * 100).toFixed(0) : 50;
    if (position > 80) {
      bullets.push(`The stock is trading near its highest price in the past year (${fmtNPR(w52High)}), which shows strong recent performance.`);
    } else if (position < 20) {
      bullets.push(`The stock is trading near its lowest price in the past year (${fmtNPR(w52Low)}), meaning it has been under pressure recently.`);
    } else {
      bullets.push(`Over the past year, the stock has ranged from ${fmtNPR(w52Low)} to ${fmtNPR(w52High)}.`);
    }
  }

  // Outlook
  let outlook;
  if (changePct >= 3) {
    outlook = `The stock showed very strong momentum today. If this buying interest continues, the price could keep climbing, but sharp rises can sometimes be followed by a pause.`;
  } else if (changePct >= 0.5) {
    outlook = `The stock is showing positive movement. Steady gains like this often reflect growing investor interest in the company.`;
  } else if (changePct > -0.5) {
    outlook = `The stock had a mostly flat day, which could mean investors are waiting for new information before making big moves.`;
  } else if (changePct > -3) {
    outlook = `The stock faced some pressure today. This could be a temporary dip, but keeping an eye on the next few days would be wise.`;
  } else {
    outlook = `The stock had a tough day with significant selling. While one bad day doesn't define a trend, it's worth being cautious and watching for recovery signs.`;
  }

  return { summary, bullets, outlook };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Manual AI Overview Update ===\n');

  // 1. Generate Market Overview
  console.log('1. Generating Market Overview...');
  const marketSummary = await prisma.marketSummary.findFirst({ orderBy: { timestamp: 'desc' } });
  
  if (!marketSummary) {
    console.error('No market summary found in database!');
    process.exit(1);
  }

  console.log(`   NEPSE: ${marketSummary.indexValue} (${marketSummary.indexChange >= 0 ? '+' : ''}${marketSummary.indexChange})`);

  // Get sector data from stocks
  const stocks = await prisma.stock.findMany({
    where: { lastTradedPrice: { gt: 0 } }
  });

  // Calculate sector stats
  const sectorMap = {};
  for (const s of stocks) {
    if (!s.sector) continue;
    if (!sectorMap[s.sector]) sectorMap[s.sector] = { name: s.sector, count: 0, advancing: 0, declining: 0, totalChange: 0 };
    sectorMap[s.sector].count++;
    const pct = s.percentageChange || s.changePercent || 0;
    sectorMap[s.sector].totalChange += pct;
    if (pct > 0) sectorMap[s.sector].advancing++;
    else if (pct < 0) sectorMap[s.sector].declining++;
  }

  const sectors = Object.values(sectorMap)
    .map(s => ({ ...s, avgChange: s.totalChange / s.count }))
    .sort((a, b) => b.avgChange - a.avgChange);

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
  console.log(`   Summary: ${marketNarrative.summary.substring(0, 100)}...\n`);

  // 2. Generate Stock Overviews
  console.log(`2. Generating stock overviews for ${stocks.length} stocks...`);
  
  let generated = 0;
  let failed = 0;

  for (const stock of stocks) {
    try {
      const narrative = generateStockNarrative(stock);
      narrative.generatedAt = new Date().toISOString();

      const factSheet = {
        symbol: stock.symbol,
        companyName: stock.companyName,
        sector: stock.sector,
        ltp: stock.lastTradedPrice,
        previousClose: stock.previousClose,
        change: stock.change,
        percentageChange: stock.percentageChange || stock.changePercent,
        volume: stock.volume || stock.totalTradeQuantity,
        turnover: stock.turnover
      };

      await prisma.aIOverview.upsert({
        where: { symbol_type: { symbol: stock.symbol.toUpperCase(), type: 'stock' } },
        update: {
          narrative: JSON.stringify(narrative),
          context: JSON.stringify(factSheet),
          modelVersion: 'manual-generation',
          tokenCount: 0,
          triggeredBy: 'manual',
          updatedAt: new Date()
        },
        create: {
          symbol: stock.symbol.toUpperCase(),
          type: 'stock',
          narrative: JSON.stringify(narrative),
          context: JSON.stringify(factSheet),
          modelVersion: 'manual-generation',
          tokenCount: 0,
          triggeredBy: 'manual'
        }
      });

      generated++;
      if (generated % 50 === 0) {
        console.log(`   Progress: ${generated}/${stocks.length} stocks done`);
      }
    } catch (err) {
      failed++;
      console.error(`   ✗ ${stock.symbol}: ${err.message}`);
    }
  }

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
