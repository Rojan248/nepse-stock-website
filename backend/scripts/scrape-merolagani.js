/**
 * scrape-merolagani.js
 * Scrapes MeroLagani company detail pages (no auth required) to populate:
 *   Stock.ma180Ext   — 180-day moving average
 *   Stock.ma120Ext   — 120-day moving average
 *   Stock.yearlyYield — 1-year price return %
 *   Stock.avgVol30dExt — 30-day average trading volume
 *
 * Usage:
 *   node scripts/scrape-merolagani.js              # skip stocks already scraped
 *   node scripts/scrape-merolagani.js --force      # refresh all
 *   node scripts/scrape-merolagani.js --sym NABIL  # single stock
 */

require('dotenv').config();
const axios   = require('axios');
const { prisma } = require('../src/services/database/connection');
const logger = require('../src/services/utils/logger');

const BASE_URL    = 'https://merolagani.com/CompanyDetail.aspx?symbol=';
const CONCURRENCY = 5;
const DELAY_MS    = 300; // polite rate-limit: 300ms between batches
const TIMEOUT_MS  = 20_000;

const args  = process.argv.slice(2);
const FORCE = args.includes('--force');
const symIdx = args.indexOf('--sym');
const SINGLE = (symIdx !== -1 && symIdx + 1 < args.length && args[symIdx + 1])
    ? args[symIdx + 1].toUpperCase()
    : null;

const KEY_MAPPERS = {
    '180 Day': 'ma180Ext',
    '120 Day': 'ma120Ext',
    '1 Year Yield': 'yearlyYield',
    '30-Day Avg Volume': 'avgVol30dExt'
};

const stripHtml = (value) => value.replace(/<[^>]*>/g, '').trim();

const normalizeIndicatorValue = (value) => stripHtml(value).replace(/,/g, '');

const findMappedIndicatorKey = (key) => (
    Object.keys(KEY_MAPPERS).find(mapperKey => key.includes(mapperKey))
);

function parseIndicatorPair(match) {
    const key = stripHtml(match[1]);
    const value = normalizeIndicatorValue(match[2]);
    return { key, value };
}

function applyIndicatorPair(data, pair) {
    const mapperKey = findMappedIndicatorKey(pair.key);
    if (!mapperKey) return;

    const numericValue = parseFloat(pair.value);
    if (!Number.isNaN(numericValue)) {
        data[KEY_MAPPERS[mapperKey]] = numericValue;
    }
}

function extractIndicators(html, data) {
    const pairRegex = /<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/gi;
    let match;

    while ((match = pairRegex.exec(html)) !== null) {
        const pair = parseIndicatorPair(match);
        if (pair.key && pair.value) applyIndicatorPair(data, pair);
    }
}

// ── HTML scraper (Regex-based to avoid cheerio dependency) ────────────────────
async function scrapeStock(symbol) {
    const url = BASE_URL + symbol;
    const res = await axios.get(url, {
        timeout: TIMEOUT_MS,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'en-US,en;q=0.9',
        }
    });

    const data = { symbol };
    extractIndicators(res.data, data);
    return data;
}

// ── Concurrency helper ────────────────────────────────────────────────────────
async function processInBatches(items, batchSize, fn) {
    const results = [];
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(batch.map(fn));
        results.push(...batchResults);
        if (i + batchSize < items.length) {
            await new Promise(r => setTimeout(r, DELAY_MS));
        }
    }
    return results;
}

async function fetchTargetStocks() {
    if (SINGLE) {
        const stocks = await prisma.stock.findMany({
            where: { symbol: SINGLE },
            select: { symbol: true, ma180Ext: true }
        });
        if (stocks.length === 0) {
            logger.warn(`Symbol ${SINGLE} not found in database.`);
            return null;
        }
        return stocks;
    }
    return await prisma.stock.findMany({
        select: { symbol: true, ma180Ext: true },
        orderBy: { symbol: 'asc' }
    });
}

function hasNoData(data) {
    const keys = ['ma180Ext', 'ma120Ext', 'yearlyYield', 'avgVol30dExt'];
    return keys.every(key => data[key] == null);
}

function buildUpdateQuery(data) {
    const update = {};
    if (data.ma180Ext != null)    update.ma180Ext    = data.ma180Ext;
    if (data.ma120Ext != null)    update.ma120Ext    = data.ma120Ext;
    if (data.yearlyYield != null) update.yearlyYield = data.yearlyYield;
    if (data.avgVol30dExt != null) update.avgVol30dExt = data.avgVol30dExt;
    return update;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
    logger.info('Starting MeroLagani scraper...');

    const stocks = await fetchTargetStocks();
    if (!stocks) return;

    const toProcess = FORCE
        ? stocks
        : stocks.filter(s => s.ma180Ext == null);

    logger.info(`Stocks to process: ${toProcess.length} (total: ${stocks.length}, skip: ${stocks.length - toProcess.length})`);

    const counters = { updated: 0, skipped: 0, failed: 0, noData: 0 };

    await processInBatches(toProcess, CONCURRENCY, async (stock) => {
        try {
            const data = await scrapeStock(stock.symbol);

            if (hasNoData(data)) {
                logger.warn(`${stock.symbol}: no indicators found on MeroLagani page`);
                counters.noData++;
                return;
            }

            await prisma.stock.update({
                where: { symbol: stock.symbol },
                data: buildUpdateQuery(data)
            });

            logger.info(`  ${stock.symbol}: ma180=${data.ma180Ext} ma120=${data.ma120Ext} yield=${data.yearlyYield}% vol30d=${data.avgVol30dExt}`);
            counters.updated++;
        } catch (err) {
            logger.warn(`${stock.symbol}: ${err.message}`);
            counters.failed++;
        }
    });

    logger.info('=== Done ===');
    logger.info(`Updated:  ${counters.updated}`);
    logger.info(`No data:  ${counters.noData}`);
    logger.info(`Failed:   ${counters.failed}`);
    logger.info(`Skipped:  ${stocks.length - toProcess.length} (already had data)`);

    await prisma.$disconnect();
}

main().catch(e => {
    logger.error('Fatal: ' + e.message);
    process.exit(1);
});
