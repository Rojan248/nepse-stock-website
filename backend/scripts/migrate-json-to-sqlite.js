/*
 * Migrate existing JSON data into Prisma (SQLite)
 * Usage: from backend/:
 *   DATABASE_URL="file:./prisma/dev.db" node scripts/migrate-json-to-sqlite.js
 */
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DATA_DIR = path.join(__dirname, '..', 'data');
const FILES = {
  stocks: path.join(DATA_DIR, 'stocks.json'),
  marketSummary: path.join(DATA_DIR, 'marketSummary.json'),
  marketHistory: path.join(DATA_DIR, 'marketHistory.json'),
  ipos: path.join(DATA_DIR, 'ipos.json'),
};

const loadJson = (filePath, fallback) => {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error(`Failed to read ${filePath}: ${err.message}`);
  }
  return fallback;
};

const migrateStocks = async () => {
  const stocks = loadJson(FILES.stocks, []);
  if (!Array.isArray(stocks) || stocks.length === 0) {
    console.log('No stocks found to migrate.');
    return;
  }

  console.log(`Migrating ${stocks.length} stocks...`);
  for (const stock of stocks) {
    if (!stock.symbol) continue;
    await prisma.stock.upsert({
      where: { symbol: stock.symbol },
      update: {
        companyName: stock.companyName || stock.name || stock.symbol,
        sector: stock.sector || null,
        lastTradedPrice: stock.lastTradedPrice ?? stock.ltp ?? null,
        previousClose: stock.previousClose ?? stock.previousClosingPrice ?? null,
        openPrice: stock.openPrice ?? null,
        highPrice: stock.highPrice ?? null,
        lowPrice: stock.lowPrice ?? null,
        volume: stock.volume ?? stock.totalTradedQuantity ?? null,
        totalTrades: stock.totalTrades ?? stock.totalTradedTransactions ?? null,
        turnover: stock.turnover ?? stock.totalTradedValue ?? null,
        change: stock.change ?? stock.pointChange ?? null,
        percentageChange: stock.percentageChange ?? stock.changePercent ?? null,
      },
      create: {
        symbol: stock.symbol,
        companyName: stock.companyName || stock.name || stock.symbol,
        sector: stock.sector || null,
        lastTradedPrice: stock.lastTradedPrice ?? stock.ltp ?? null,
        previousClose: stock.previousClose ?? stock.previousClosingPrice ?? null,
        openPrice: stock.openPrice ?? null,
        highPrice: stock.highPrice ?? null,
        lowPrice: stock.lowPrice ?? null,
        volume: stock.volume ?? stock.totalTradedQuantity ?? null,
        totalTrades: stock.totalTrades ?? stock.totalTradedTransactions ?? null,
        turnover: stock.turnover ?? stock.totalTradedValue ?? null,
        change: stock.change ?? stock.pointChange ?? null,
        percentageChange: stock.percentageChange ?? stock.changePercent ?? null,
      },
    });
  }
  console.log('Stocks migrated.');
};

const migrateMarketHistory = async () => {
  const history = loadJson(FILES.marketHistory, []);
  if (!Array.isArray(history) || history.length === 0) {
    console.log('No market history found to migrate.');
    return;
  }

  console.log(`Migrating ${history.length} market history rows...`);
  for (const entry of history) {
    if (!entry.symbol || !entry.date) continue;
    await prisma.marketHistory.create({
      data: {
        symbol: entry.symbol,
        date: new Date(entry.date),
        closePrice: entry.close || entry.closePrice || null,
        highPrice: entry.highPrice ?? null,
        lowPrice: entry.lowPrice ?? null,
        volume: entry.volume ?? null,
        turnover: entry.turnover ?? null,
        change: entry.change ?? null,
        percentageChange: entry.percentageChange ?? null,
      },
    });
  }
  console.log('Market history migrated.');
};

const migrateMarketSummary = async () => {
  const summary = loadJson(FILES.marketSummary, null);
  if (!summary) {
    console.log('No market summary found to migrate.');
    return;
  }

  await prisma.marketSummary.create({
    data: {
      totalTurnover: summary.totalTurnover ?? null,
      totalVolume: summary.totalVolume ?? null,
      totalTransactions: summary.totalTransactions ?? null,
      activeCompanies: summary.activeCompanies ?? null,
      advancedCompanies: summary.advancedCompanies ?? null,
      declinedCompanies: summary.declinedCompanies ?? null,
      unchangedCompanies: summary.unchangedCompanies ?? null,
      timestamp: summary.timestamp ? new Date(summary.timestamp) : undefined,
    },
  });
  console.log('Market summary migrated.');
};

const migrateIpos = async () => {
  const ipos = loadJson(FILES.ipos, []);
  if (!Array.isArray(ipos) || ipos.length === 0) {
    console.log('No IPOs found to migrate.');
    return;
  }

  console.log(`Migrating ${ipos.length} IPOs...`);
  for (const ipo of ipos) {
    const symbol = ipo.symbol || ipo.ticker;
    if (!symbol) continue;
    await prisma.ipo.upsert({
      where: { symbol },
      update: {
        companyName: ipo.companyName || ipo.name || symbol,
        sector: ipo.sector || null,
        issueDate: ipo.issueDate ? new Date(ipo.issueDate) : null,
        closingDate: ipo.closingDate ? new Date(ipo.closingDate) : null,
        price: ipo.price ?? null,
        units: ipo.units ?? null,
        status: ipo.status ?? null,
        issueManager: ipo.issueManager ?? null,
      },
      create: {
        symbol,
        companyName: ipo.companyName || ipo.name || symbol,
        sector: ipo.sector || null,
        issueDate: ipo.issueDate ? new Date(ipo.issueDate) : null,
        closingDate: ipo.closingDate ? new Date(ipo.closingDate) : null,
        price: ipo.price ?? null,
        units: ipo.units ?? null,
        status: ipo.status ?? null,
        issueManager: ipo.issueManager ?? null,
      },
    });
  }
  console.log('IPOs migrated.');
};

const run = async () => {
  try {
    await migrateStocks();
    await migrateMarketHistory();
    await migrateMarketSummary();
    await migrateIpos();
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await prisma.$disconnect();
  }
};

run();
