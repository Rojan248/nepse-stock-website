/**
 * Historical Data Backfill Script
 *
 * Fetches 1 year of daily OHLCV data for all NEPSE stocks and stores in MarketHistory.
 * Uses MeroLagani as primary source, ShareSansar chart API as fallback.
 *
 * Data thresholds:
 *   - 5 days: liquidity signals
 *   - 14 days: RSI14
 *   - 20 days: MA20, monthly change
 *   - 50 days: MA50
 *   - 235 days: 52-week high/low
 *
 * Usage:
 *   node scripts/backfill-history.js              # skip symbols with >=50 rows
 *   node scripts/backfill-history.js --force      # re-fetch all symbols
 *   node scripts/backfill-history.js --symbol NABIL  # single symbol
 *   node scripts/backfill-history.js --min-days 235  # target depth
 */

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const ARGS = process.argv.slice(2);
const FORCE = ARGS.includes('--force');
const SINGLE_SYMBOL = ARGS.includes('--symbol') ? ARGS[ARGS.indexOf('--symbol') + 1] : null;
const MIN_DAYS_IDX = ARGS.indexOf('--min-days');
const TARGET_DAYS = MIN_DAYS_IDX !== -1 ? parseInt(ARGS[MIN_DAYS_IDX + 1]) : 235;

// Rate limiting
const DELAY_BETWEEN_STOCKS = 1200; // ms between stocks
const DELAY_ON_ERROR = 5000;       // ms on rate-limit or error
const MAX_RETRIES = 2;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);
const warn = (msg) => console.warn(`[${new Date().toISOString()}] WARN: ${msg}`);
const error = (msg) => console.error(`[${new Date().toISOString()}] ERROR: ${msg}`);

/**
 * Fetch historical OHLCV data from MeroLagani
 * Returns array of { date, open, high, low, close, volume }
 */
async function fetchFromMeroLagani(symbol) {
    const url = `https://merolagani.com/handlers/TechnicalChartHandler.ashx?type=stock_history&symbol=${symbol}`;

    const res = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://merolagani.com/',
            'Accept': '*/*'
        },
        timeout: 20000
    });

    const data = res.data;

    // MeroLagani returns HighCharts-compatible format:
    // { volumeData: [[ts, vol], ...], priceData: [[ts, open, high, low, close], ...] }
    // OR flat array: [[ts, open, high, low, close, vol], ...]

    let rows = [];

    if (data && data.priceData && Array.isArray(data.priceData)) {
        // Format: { priceData: [[ts, o, h, l, c], ...], volumeData: [[ts, vol], ...] }
        const volMap = {};
        if (data.volumeData) {
            data.volumeData.forEach(([ts, vol]) => { volMap[ts] = vol; });
        }
        rows = data.priceData.map(([ts, open, high, low, close]) => ({
            date: new Date(ts),
            open: parseFloat(open) || null,
            high: parseFloat(high) || null,
            low: parseFloat(low) || null,
            close: parseFloat(close) || null,
            volume: parseFloat(volMap[ts]) || null
        }));
    } else if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0])) {
        // Format: [[ts, open, high, low, close, volume], ...]
        rows = data.map(entry => ({
            date: new Date(entry[0]),
            open: parseFloat(entry[1]) || null,
            high: parseFloat(entry[2]) || null,
            low: parseFloat(entry[3]) || null,
            close: parseFloat(entry[4]) || null,
            volume: entry[5] !== undefined ? parseFloat(entry[5]) : null
        }));
    } else if (data && typeof data === 'object') {
        // Try to handle other possible formats
        const keys = Object.keys(data);
        log(`MeroLagani ${symbol}: unknown format, keys: ${keys.slice(0, 5).join(', ')}`);
        return null;
    }

    // Filter out bad rows
    rows = rows.filter(r => r.close && r.close > 0 && r.date instanceof Date && !isNaN(r.date));

    return rows.length > 0 ? rows : null;
}

/**
 * Fetch from ShareSansar stock page - scrapes the price history table
 */
async function fetchFromShareSansarPage(symbol) {
    // ShareSansar company page - has historical data in a tab
    const url = `https://www.sharesansar.com/company/${symbol.toLowerCase()}`;

    const res = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html'
        },
        timeout: 20000
    });

    const html = res.data;

    // ShareSansar has a price history section. Parse table rows.
    // Look for patterns like: <td>2024-01-15</td><td>500.00</td>...
    const rows = [];

    // Match date and price data from typical ShareSansar table structure
    // Format varies but typically: date, open, high, low, close, volume
    const rowRegex = /<tr[^>]*>\s*<td[^>]*>([\d]{4}-[\d]{2}-[\d]{2})<\/td>\s*<td[^>]*>([\d,.]+)<\/td>\s*<td[^>]*>([\d,.]+)<\/td>\s*<td[^>]*>([\d,.]+)<\/td>\s*<td[^>]*>([\d,.]+)<\/td>\s*<td[^>]*>([\d,.]+)<\/td>/g;

    let match;
    while ((match = rowRegex.exec(html)) !== null) {
        const [, date, open, high, low, close, volume] = match;
        const parseNum = (s) => parseFloat(s.replace(/,/g, '')) || null;
        rows.push({
            date: new Date(date),
            open: parseNum(open),
            high: parseNum(high),
            low: parseNum(low),
            close: parseNum(close),
            volume: parseNum(volume)
        });
    }

    return rows.length > 0 ? rows : null;
}

/**
 * Fetch from NEPSE Alpha (sometimes public without auth)
 */
async function fetchFromNepseAlpha(symbol) {
    // NepseAlpha might expose chart data
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setFullYear(startDate.getFullYear() - 1);

    const fmt = (d) => d.toISOString().split('T')[0];

    const url = `https://nepsealpha.com/nepse-data/${symbol}/history?from=${fmt(startDate)}&to=${fmt(endDate)}`;

    const res = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'application/json'
        },
        timeout: 15000
    });

    const data = res.data;
    if (!data || !Array.isArray(data)) return null;

    const rows = data.map(item => ({
        date: new Date(item.businessDate || item.date || item.d),
        open: parseFloat(item.openPrice || item.open || item.o) || null,
        high: parseFloat(item.highPrice || item.high || item.h) || null,
        low: parseFloat(item.lowPrice || item.low || item.l) || null,
        close: parseFloat(item.closePrice || item.close || item.c || item.ltp) || null,
        volume: parseFloat(item.totalTradeQuantity || item.volume || item.v) || null
    })).filter(r => r.close && r.close > 0);

    return rows.length > 0 ? rows : null;
}

/**
 * Fetch historical data for a symbol, trying multiple sources
 */
async function fetchHistoricalData(symbol) {
    const sources = [
        { name: 'MeroLagani', fn: () => fetchFromMeroLagani(symbol) },
        { name: 'NepseAlpha', fn: () => fetchFromNepseAlpha(symbol) },
        { name: 'ShareSansar', fn: () => fetchFromShareSansarPage(symbol) }
    ];

    for (const src of sources) {
        try {
            const data = await src.fn();
            if (data && data.length > 0) {
                log(`  ${symbol}: Got ${data.length} rows from ${src.name}`);
                return { data, source: src.name };
            }
        } catch (e) {
            if (e.response?.status === 429) {
                warn(`  ${symbol}: Rate limited on ${src.name}, waiting...`);
                await sleep(DELAY_ON_ERROR);
            } else if (e.response?.status === 404 || e.response?.status === 403) {
                // Symbol not found on this source, try next
            } else {
                warn(`  ${symbol}: ${src.name} failed: ${e.message}`);
            }
        }
    }

    return null;
}

/**
 * Better store function: batch upsert using createMany with skipDuplicates
 */
async function storeHistoryBatch(symbol, rows) {
    // Sort rows oldest-first, compute change
    const sorted = [...rows].sort((a, b) => a.date - b.date);

    // Compute change/percentageChange from sequential close prices
    const enriched = sorted.map((row, i) => {
        let change = null;
        let percentageChange = null;
        if (i > 0 && sorted[i - 1].close && row.close) {
            change = row.close - sorted[i - 1].close;
            percentageChange = (change / sorted[i - 1].close) * 100;
        }
        return {
            symbol,
            date: row.date,
            closePrice: row.close,
            highPrice: row.high || null,
            lowPrice: row.low || null,
            volume: row.volume || null,
            turnover: null,
            change,
            percentageChange
        };
    });

    // Use createMany with skipDuplicates (requires unique constraint on symbol+date)
    // Since we may not have that constraint, use individual upserts with try-catch
    let stored = 0;
    let skipped = 0;

    // Try createMany first (will fail if no unique constraint, but worth trying)
    try {
        const result = await prisma.marketHistory.createMany({
            data: enriched,
            skipDuplicates: true
        });
        stored = result.count;
        skipped = enriched.length - stored;
        return { stored, skipped };
    } catch (e) {
        // Fall back to individual creates
    }

    // Individual creates
    for (const row of enriched) {
        try {
            const dayStart = new Date(row.date);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(dayStart);
            dayEnd.setDate(dayEnd.getDate() + 1);
            const existing = await prisma.marketHistory.findFirst({
                where: {
                    symbol: row.symbol,
                    date: { gte: dayStart, lt: dayEnd }
                },
                select: { id: true }
            });

            if (!existing) {
                await prisma.marketHistory.create({ data: row });
                stored++;
            } else {
                skipped++;
            }
        } catch (e) {
            skipped++;
        }
    }

    return { stored, skipped };
}

async function main() {
    log(`=== Historical Data Backfill ===`);
    log(`Target: ${TARGET_DAYS} trading days (approx 1 year = 235)`);
    log(`Force: ${FORCE}`);
    if (SINGLE_SYMBOL) log(`Focusing on: ${SINGLE_SYMBOL}`);

    // Get all stock symbols from DB
    const stocks = await prisma.stock.findMany({
        select: { symbol: true },
        ...(SINGLE_SYMBOL ? { where: { symbol: SINGLE_SYMBOL } } : {})
    });

    if (stocks.length === 0) {
        error('No stocks found in database. Run the server first to populate stocks.');
        process.exit(1);
    }

    log(`Found ${stocks.length} stocks to process`);

    const stats = { processed: 0, fetched: 0, skipped: 0, failed: 0, totalStored: 0 };
    const failed = [];

    for (let i = 0; i < stocks.length; i++) {
        const { symbol } = stocks[i];
        stats.processed++;

        // Check existing history depth
        if (!FORCE) {
            const count = await prisma.marketHistory.count({ where: { symbol } });
            if (count >= TARGET_DAYS) {
                log(`[${i + 1}/${stocks.length}] ${symbol}: already has ${count} rows, skipping`);
                stats.skipped++;
                continue;
            }
            if (count > 0) {
                log(`[${i + 1}/${stocks.length}] ${symbol}: has ${count}/${TARGET_DAYS} rows, fetching more...`);
            } else {
                log(`[${i + 1}/${stocks.length}] ${symbol}: no history, fetching...`);
            }
        } else {
            log(`[${i + 1}/${stocks.length}] ${symbol}: force mode, fetching...`);
        }

        let result = null;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            if (attempt > 0) {
                warn(`  ${symbol}: retry ${attempt}/${MAX_RETRIES}`);
                await sleep(DELAY_ON_ERROR);
            }
            result = await fetchHistoricalData(symbol);
            if (result) break;
        }

        if (!result) {
            error(`  ${symbol}: all sources failed`);
            stats.failed++;
            failed.push(symbol);
        } else {
            const { stored, skipped } = await storeHistoryBatch(symbol, result.data);
            stats.fetched++;
            stats.totalStored += stored;
            log(`  ${symbol}: stored ${stored} new rows, ${skipped} already existed`);
        }

        // Rate limit between stocks
        if (i < stocks.length - 1) {
            await sleep(DELAY_BETWEEN_STOCKS);
        }
    }

    log('\n=== Backfill Complete ===');
    log(`Processed: ${stats.processed}`);
    log(`Fetched:   ${stats.fetched}`);
    log(`Skipped:   ${stats.skipped} (already had sufficient data)`);
    log(`Failed:    ${stats.failed}`);
    log(`Rows stored: ${stats.totalStored}`);
    if (failed.length > 0) {
        log(`\nFailed symbols: ${failed.join(', ')}`);
    }

    await prisma.$disconnect();
}

main().catch(async (e) => {
    error(e.message);
    await prisma.$disconnect();
    process.exit(1);
});
