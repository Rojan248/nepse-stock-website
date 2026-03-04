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
const cheerio = require('cheerio');
const { prisma } = require('../src/services/database/connection');

const BASE_URL    = 'https://merolagani.com/CompanyDetail.aspx?symbol=';
const CONCURRENCY = 5;
const DELAY_MS    = 300; // polite rate-limit: 300ms between batches
const TIMEOUT_MS  = 20_000;

const args  = process.argv.slice(2);
const FORCE = args.includes('--force');
const SINGLE = args.includes('--sym') ? args[args.indexOf('--sym') + 1]?.toUpperCase() : null;

const log  = (...a) => console.log(`[${new Date().toISOString()}]`, ...a);
const warn = (...a) => console.warn(`[${new Date().toISOString()}] WARN`, ...a);

// ── HTML scraper ──────────────────────────────────────────────────────────────
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

    const $ = cheerio.load(res.data);
    const data = { symbol };

    $('th').each((_, el) => {
        const key = $(el).text().trim();
        const val = $(el).next('td').text().trim().replace(/,/g, '');
        if (!key || !val) return;

        if (key.includes('180 Day')) {
            const n = parseFloat(val);
            if (!isNaN(n)) data.ma180Ext = n;
        } else if (key.includes('120 Day')) {
            const n = parseFloat(val);
            if (!isNaN(n)) data.ma120Ext = n;
        } else if (key.includes('1 Year Yield')) {
            const n = parseFloat(val);
            if (!isNaN(n)) data.yearlyYield = n;
        } else if (key.includes('30-Day Avg Volume')) {
            const n = parseFloat(val);
            if (!isNaN(n)) data.avgVol30dExt = n;
        }
    });

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

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
    log('Starting MeroLagani scraper...');

    let stocks;
    if (SINGLE) {
        stocks = await prisma.stock.findMany({
            where: { symbol: SINGLE },
            select: { symbol: true, ma180Ext: true }
        });
        if (stocks.length === 0) {
            log(`Symbol ${SINGLE} not found in database.`);
            return;
        }
    } else {
        stocks = await prisma.stock.findMany({
            select: { symbol: true, ma180Ext: true },
            orderBy: { symbol: 'asc' }
        });
    }

    const toProcess = FORCE
        ? stocks
        : stocks.filter(s => s.ma180Ext == null);

    log(`Stocks to process: ${toProcess.length} (total: ${stocks.length}, skip: ${stocks.length - toProcess.length})`);

    const counters = { updated: 0, skipped: 0, failed: 0, noData: 0 };

    const results = await processInBatches(toProcess, CONCURRENCY, async (stock) => {
        try {
            const data = await scrapeStock(stock.symbol);

            if (!data.ma180Ext && !data.ma120Ext && !data.yearlyYield && !data.avgVol30dExt) {
                warn(`${stock.symbol}: no indicators found on MeroLagani page`);
                counters.noData++;
                return;
            }

            const update = {};
            if (data.ma180Ext != null)    update.ma180Ext    = data.ma180Ext;
            if (data.ma120Ext != null)    update.ma120Ext    = data.ma120Ext;
            if (data.yearlyYield != null) update.yearlyYield = data.yearlyYield;
            if (data.avgVol30dExt != null) update.avgVol30dExt = data.avgVol30dExt;

            await prisma.stock.update({
                where: { symbol: stock.symbol },
                data: update
            });

            log(`  ${stock.symbol}: ma180=${data.ma180Ext} ma120=${data.ma120Ext} yield=${data.yearlyYield}% vol30d=${data.avgVol30dExt}`);
            counters.updated++;
        } catch (err) {
            warn(`${stock.symbol}: ${err.message}`);
            counters.failed++;
        }
    });

    log('\n=== Done ===');
    log(`Updated:  ${counters.updated}`);
    log(`No data:  ${counters.noData}`);
    log(`Failed:   ${counters.failed}`);
    log(`Skipped:  ${stocks.length - toProcess.length} (already had data)`);

    await prisma.$disconnect();
}

main().catch(e => {
    console.error('Fatal:', e);
    process.exit(1);
});
