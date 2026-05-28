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
 *   node scripts/backfill-history.js              # skip symbols with current history
 *   node scripts/backfill-history.js --force      # re-fetch all symbols
 *   node scripts/backfill-history.js --symbol NABIL  # single symbol
 *   node scripts/backfill-history.js --min-days 235  # target depth
 *   node scripts/backfill-history.js --stale-days 5  # refresh symbols older than N days
 */

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const { sleep, log, warn, error } = require('./scriptUtils');
const {
    fetchOfficialCompanyList,
    buildOrdinaryShareMap
} = require('../src/services/nepseCompanyDirectory');
const { normalizeSymbol } = require('../src/services/dataEnricher');

const prisma = new PrismaClient();

const ARGS = process.argv.slice(2);
const FORCE = ARGS.includes('--force');
const SINGLE_SYMBOL = ARGS.includes('--symbol') ? ARGS[ARGS.indexOf('--symbol') + 1] : null;
const MIN_DAYS_IDX = ARGS.indexOf('--min-days');
const TARGET_DAYS = MIN_DAYS_IDX !== -1 ? parseInt(ARGS[MIN_DAYS_IDX + 1]) : 235;
const STALE_DAYS_IDX = ARGS.indexOf('--stale-days');
const STALE_DAYS = STALE_DAYS_IDX !== -1 ? parseInt(ARGS[STALE_DAYS_IDX + 1]) : 5;

// Rate limiting
const DELAY_BETWEEN_STOCKS = 1200; // ms between stocks
const DELAY_ON_ERROR = 5000;       // ms on rate-limit or error
const MAX_RETRIES = 2;
const SHARE_SANSAR_PAGE_SIZE = 50;

function parseNumber(value) {
    if (value == null || value === '') return null;
    const parsed = Number(String(value).replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
}

function parseBusinessDate(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(value || '')) {
        return new Date(`${value}T00:00:00.000Z`);
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function dayRange(date) {
    const start = parseBusinessDate(date);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start, end };
}

function validateOhlcv(row) {
    const date = parseBusinessDate(row.date);
    const open = parseNumber(row.open);
    const high = parseNumber(row.high);
    const low = parseNumber(row.low);
    const close = parseNumber(row.close);
    const volume = parseNumber(row.volume);
    const turnover = parseNumber(row.turnover);

    if (!date) return { ok: false, reason: 'invalid date' };
    if (!close || close <= 0) return { ok: false, reason: 'invalid close' };
    if (volume != null && volume < 0) return { ok: false, reason: 'negative volume' };
    if (turnover != null && turnover < 0) return { ok: false, reason: 'negative turnover' };

    const ceiling = Math.max(...[open, close, low].filter(v => v != null));
    const floor = Math.min(...[open, close, high].filter(v => v != null));
    if (high != null && high < ceiling) return { ok: false, reason: 'high below traded price' };
    if (low != null && low > floor) return { ok: false, reason: 'low above traded price' };

    return { ok: true, row: { date, open, high, low, close, volume, turnover } };
}

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

function extractShareSansarContext(html, headers, pageUrl, symbol) {
    const token = html.match(/<meta name="_token" content="([^"]+)"/)?.[1];
    const directCompany = html.match(/<div id="companyid"[^>]*>([^<]+)<\/div>/)?.[1]?.trim();
    const cookie = (headers['set-cookie'] || []).map(value => value.split(';')[0]).join('; ');

    if (token && directCompany) {
        return { token, company: directCompany, cookie, pageUrl };
    }

    let company = null;
    const companyPattern = /"id":(\d+),"symbol":"([^"]+)","companyname":/g;
    let match;
    while ((match = companyPattern.exec(html)) !== null) {
        if (match[2].replace(/\\\//g, '/') === symbol) {
            company = match[1];
            break;
        }
    }

    if (!token || !company) return null;
    return { token, company, cookie, pageUrl };
}

async function fetchShareSansarCompanyContext(symbol) {
    const primaryPageUrl = `https://www.sharesansar.com/company/${encodeURIComponent(symbol.toLowerCase())}`;
    const fallbackPageUrl = 'https://www.sharesansar.com/company/nabil';

    try {
        const res = await axios.get(primaryPageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html'
            },
            timeout: 20000
        });
        const context = extractShareSansarContext(res.data, res.headers, primaryPageUrl, symbol);
        if (context) return context;
    } catch (err) {
        if (!err.response || ![404, 403].includes(err.response.status)) throw err;
    }

    const res = await axios.get(fallbackPageUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html'
        },
        timeout: 20000
    });

    const fallbackContext = extractShareSansarContext(res.data, res.headers, fallbackPageUrl, symbol);
    if (!fallbackContext) {
        throw new Error(`company context not found for ${symbol}`);
    }

    return fallbackContext;
}

function buildShareSansarHistoryForm(company, start) {
    const form = new URLSearchParams();
    form.set('draw', '1');
    form.set('start', String(start));
    form.set('length', String(SHARE_SANSAR_PAGE_SIZE));
    form.set('company', company);

    [
        'published_date',
        'open',
        'high',
        'low',
        'close',
        'per_change',
        'traded_quantity',
        'traded_amount'
    ].forEach((name, index) => {
        form.set(`columns[${index}][data]`, name);
    });

    form.set('order[0][column]', '0');
    form.set('order[0][dir]', 'desc');
    return form;
}

async function fetchFromShareSansarApi(symbol) {
    const { token, company, cookie, pageUrl } = await fetchShareSansarCompanyContext(symbol);
    const targetRows = Math.max(TARGET_DAYS + 75, 365);
    const allRows = [];

    for (let start = 0; start < targetRows; start += SHARE_SANSAR_PAGE_SIZE) {
        const response = await axios.post(
            'https://www.sharesansar.com/company-price-history',
            buildShareSansarHistoryForm(company, start).toString(),
            {
                timeout: 20000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json, text/javascript, */*; q=0.01',
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'X-CSRF-Token': token,
                    'X-Requested-With': 'XMLHttpRequest',
                    'Referer': pageUrl,
                    ...(cookie ? { Cookie: cookie } : {})
                }
            }
        );

        const rows = response.data?.data;
        if (!Array.isArray(rows) || rows.length === 0) break;
        allRows.push(...rows);
        if (rows.length < SHARE_SANSAR_PAGE_SIZE) break;
    }

    const mapped = allRows.map(row => ({
        date: row.published_date,
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        volume: row.traded_quantity,
        turnover: row.traded_amount
    }));

    return mapped.length > 0 ? mapped : null;
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
        { name: 'ShareSansar API', fn: () => fetchFromShareSansarApi(symbol) },
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

async function updateStockFromLatestHistory(symbol, enrichedRows) {
    if (enrichedRows.length === 0) return false;

    const latest = enrichedRows[enrichedRows.length - 1];
    const previous = enrichedRows[enrichedRows.length - 2];

    await prisma.stock.update({
        where: { symbol },
        data: {
            lastTradedPrice: latest.closePrice,
            previousClose: previous?.closePrice ?? latest.closePrice,
            openPrice: latest.openPrice,
            highPrice: latest.highPrice,
            lowPrice: latest.lowPrice,
            volume: latest.volume,
            turnover: latest.turnover,
            change: latest.change,
            percentageChange: latest.percentageChange
        }
    });

    return true;
}

async function storeHistoryBatch(symbol, rows) {
    const normalizedByDay = new Map();
    let invalid = 0;

    for (const row of rows) {
        const result = validateOhlcv(row);
        if (!result.ok) {
            invalid++;
            continue;
        }

        normalizedByDay.set(result.row.date.toISOString().slice(0, 10), result.row);
    }

    const sorted = Array.from(normalizedByDay.values()).sort((a, b) => a.date - b.date);

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
            openPrice: row.open,
            closePrice: row.close,
            highPrice: row.high || null,
            lowPrice: row.low || null,
            volume: row.volume || null,
            turnover: row.turnover || null,
            change,
            percentageChange
        };
    });

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of enriched) {
        try {
            const { start, end } = dayRange(row.date);
            const existing = await prisma.marketHistory.findFirst({
                where: {
                    symbol: row.symbol,
                    date: { gte: start, lt: end }
                },
                select: { id: true }
            });

            if (!existing) {
                await prisma.marketHistory.create({ data: row });
                created++;
            } else {
                await prisma.marketHistory.update({ where: { id: existing.id }, data: row });
                updated++;
            }
        } catch (e) {
            skipped++;
        }
    }

    const currentUpdated = await updateStockFromLatestHistory(symbol, enriched);

    return { created, updated, skipped, invalid, currentUpdated };
}

async function main() {
    log(`=== Historical Data Backfill ===`);
    log(`Target: ${TARGET_DAYS} trading days (approx 1 year = 235)`);
    log(`Force: ${FORCE}`);
    if (SINGLE_SYMBOL) log(`Focusing on: ${SINGLE_SYMBOL}`);

    log('Fetching official ordinary-share directory...');
    const ordinaryShareMap = buildOrdinaryShareMap(await fetchOfficialCompanyList());
    if (ordinaryShareMap.size === 0) {
        throw new Error('Could not load ordinary-share list from NEPSE company directory');
    }

    const dbStocks = await prisma.stock.findMany({
        select: { symbol: true },
        ...(SINGLE_SYMBOL ? { where: { symbol: normalizeSymbol(SINGLE_SYMBOL) } } : {})
    });
    const stocks = dbStocks.filter(stock => ordinaryShareMap.has(normalizeSymbol(stock.symbol)));

    if (dbStocks.length === 0) {
        error('No stocks found in database. Run the server first to populate stocks.');
        process.exit(1);
    }
    if (stocks.length === 0 && SINGLE_SYMBOL) {
        error(`${SINGLE_SYMBOL} is not an active ordinary share in NEPSE's company directory.`);
        process.exit(1);
    }

    const excluded = dbStocks.length - stocks.length;
    if (excluded > 0) {
        log(`Excluded ${excluded} non-ordinary securities from this backfill.`);
    }

    log(`Found ${stocks.length} stocks to process`);

    const stats = { processed: 0, fetched: 0, skipped: 0, failed: 0, totalStored: 0 };
    const failed = [];

    for (let i = 0; i < stocks.length; i++) {
        const { symbol } = stocks[i];
        stats.processed++;

        if (!FORCE) {
            const [count, latest] = await Promise.all([
                prisma.marketHistory.count({ where: { symbol } }),
                prisma.marketHistory.findFirst({
                    where: { symbol },
                    orderBy: { date: 'desc' },
                    select: { date: true }
                })
            ]);
            const staleCutoff = new Date();
            staleCutoff.setUTCDate(staleCutoff.getUTCDate() - STALE_DAYS);

            if (count >= TARGET_DAYS) {
                if (latest?.date && latest.date >= staleCutoff) {
                    log(`[${i + 1}/${stocks.length}] ${symbol}: already has ${count} rows through ${latest.date.toISOString().slice(0, 10)}, skipping`);
                    stats.skipped++;
                    continue;
                }
                log(`[${i + 1}/${stocks.length}] ${symbol}: has ${count} rows but latest is ${latest?.date?.toISOString().slice(0, 10) || 'unknown'}, refreshing...`);
            }
            else if (count > 0) {
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
            const { created, updated, skipped, invalid, currentUpdated } = await storeHistoryBatch(symbol, result.data);
            stats.fetched++;
            stats.totalStored += created;
            log(`  ${symbol}: created ${created}, updated ${updated}, skipped ${skipped}, invalid ${invalid}, current=${currentUpdated ? 'updated' : 'unchanged'}`);
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
