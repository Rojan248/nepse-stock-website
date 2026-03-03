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
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error(`Failed to read ${filePath}: ${err.message}`);
  }
  return fallback;
};

const parseDate = (value) => (value ? new Date(value) : null);

/**
 * Generic upsert-based migration for array collections.
 * Eliminates structural duplication between migrateStocks / migrateIpos.
 *
 * @param {object}   opts
 * @param {string}   opts.file        - JSON file path
 * @param {string}   opts.label       - Human-readable name for logs
 * @param {object}   opts.model       - Prisma model (e.g. prisma.stock)
 * @param {Function} opts.resolveKey  - (item) => symbol string | falsy to skip
 * @param {Function} opts.buildData   - (item, symbol) => field object
 */
const migrateCollection = async ({ file, label, model, resolveKey, buildData }) => {
  const items = loadJson(file, []);
  if (!Array.isArray(items) || items.length === 0) {
    console.log(`No ${label} found to migrate.`);
    return;
  }

  console.log(`Migrating ${items.length} ${label}...`);
  const failures = [];
  for (const item of items) {
    const symbol = resolveKey(item);
    if (!symbol) continue;
    try {
      const data = buildData(item, symbol);
      await model.upsert({
        where: { symbol },
        update: data,
        create: { symbol, ...data },
      });
    } catch (err) {
      console.error(`Failed to migrate ${label} item (symbol=${symbol}): ${err.message}`);
      failures.push({ symbol, error: err.message });
    }
  }
  if (failures.length > 0) {
    console.warn(`${failures.length} ${label} item(s) failed to migrate:`, failures.map(f => f.symbol).join(', '));
  }
  console.log(`${label} migrated (${items.length - failures.length}/${items.length} succeeded).`);
};

const buildStockData = (stock) => ({
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
});

const migrateStocks = () => migrateCollection({
  file: FILES.stocks,
  label: 'stocks',
  model: prisma.stock,
  resolveKey: (s) => s.symbol,
  buildData: buildStockData,
});

const buildIpoData = (ipo, symbol) => ({
  companyName: ipo.companyName || ipo.name || symbol,
  sector: ipo.sector || null,
  issueDate: parseDate(ipo.issueDate),
  closingDate: parseDate(ipo.closingDate),
  price: ipo.price ?? null,
  units: ipo.units ?? null,
  status: ipo.status ?? null,
  issueManager: ipo.issueManager ?? null,
});

const migrateIpos = () => migrateCollection({
  file: FILES.ipos,
  label: 'IPOs',
  model: prisma.ipo,
  resolveKey: (ipo) => ipo.symbol || ipo.ticker,
  buildData: buildIpoData,
});

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
