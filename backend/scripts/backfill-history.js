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
    const parsed = parseOhlcvRow(row);
    const invalidReason = getOhlcvInvalidReason(parsed);

    if (invalidReason) {
        return { ok: false, reason: invalidReason };
    }

    return { ok: true, row: parsed };
}

function parseOhlcvRow(row) {
    return {
        date: parseBusinessDate(row.date),
        open: parseNumber(row.open),
        high: parseNumber(row.high),
        low: parseNumber(row.low),
        close: parseNumber(row.close),
        volume: parseNumber(row.volume),
        turnover: parseNumber(row.turnover)
    };
}

function getOhlcvInvalidReason(row) {
    if (!row.date) return 'invalid date';
    if (!row.close || row.close <= 0) return 'invalid close';
    if (row.volume != null && row.volume < 0) return 'negative volume';
    if (row.turnover != null && row.turnover < 0) return 'negative turnover';
    return getPriceRangeInvalidReason(row);
}

function getPriceRangeInvalidReason({ open, high, low, close }) {
    const ceiling = Math.max(...[open, close, low].filter(v => v != null));
    const floor = Math.min(...[open, close, high].filter(v => v != null));
    if (high != null && high < ceiling) return 'high below traded price';
    if (low != null && low > floor) return 'low above traded price';
    return null;
}

const hasMeroLaganiSeriesFormat = (data) => (
    data?.priceData && Array.isArray(data.priceData)
);

const hasMeroLaganiFlatFormat = (data) => (
    Array.isArray(data) && data.length > 0 && Array.isArray(data[0])
);

function toVolumeMap(volumeData = []) {
    return Object.fromEntries(volumeData.map(([ts, volume]) => [ts, volume]));
}

function toMeroLaganiSeriesRow(volumeMap) {
    return ([ts, open, high, low, close]) => ({
        date: new Date(ts),
        open: parseFloat(open) || null,
        high: parseFloat(high) || null,
        low: parseFloat(low) || null,
        close: parseFloat(close) || null,
        volume: parseFloat(volumeMap[ts]) || null
    });
}

const toMeroLaganiFlatRow = (entry) => ({
    date: new Date(entry[0]),
    open: parseFloat(entry[1]) || null,
    high: parseFloat(entry[2]) || null,
    low: parseFloat(entry[3]) || null,
    close: parseFloat(entry[4]) || null,
    volume: entry[5] !== undefined ? parseFloat(entry[5]) : null
});

const isValidSourceRow = (row) => (
    row.close && row.close > 0 && row.date instanceof Date && !Number.isNaN(row.date.getTime())
);

function mapMeroLaganiRows(data, symbol) {
    if (hasMeroLaganiSeriesFormat(data)) {
        return data.priceData.map(toMeroLaganiSeriesRow(toVolumeMap(data.volumeData)));
    }

    if (hasMeroLaganiFlatFormat(data)) {
        return data.map(toMeroLaganiFlatRow);
    }

    if (data && typeof data === 'object') {
        const keys = Object.keys(data);
        log(`MeroLagani ${symbol}: unknown format, keys: ${keys.slice(0, 5).join(', ')}`);
    }

    return [];
}

/**
 * Fetch historical OHLCV data from MeroLagani.
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

    const rows = mapMeroLaganiRows(res.data, symbol).filter(isValidSourceRow);
    return rows.length > 0 ? rows : null;
}

const getShareSansarCookie = (headers) => (
    (headers['set-cookie'] || []).map(value => value.split(';')[0]).join('; ')
);

function getDirectShareSansarContext(html) {
    const token = html.match(/<meta name="_token" content="([^"]+)"/)?.[1];
    const directCompany = html.match(/<div id="companyid"[^>]*>([^<]+)<\/div>/)?.[1]?.trim();

    return token && directCompany ? { token, company: directCompany } : null;
}

function findShareSansarCompanyId(html, symbol) {
    const companyPattern = /"id":(\d+),"symbol":"([^"]+)","companyname":/g;
    let match;
    while ((match = companyPattern.exec(html)) !== null) {
        if (match[2].replace(/\\\//g, '/') === symbol) {
            return match[1];
        }
    }
    return null;
}

function getEmbeddedShareSansarContext(html, symbol) {
    const token = html.match(/<meta name="_token" content="([^"]+)"/)?.[1];
    const company = findShareSansarCompanyId(html, symbol);

    if (!token || !company) return null;
    return { token, company };
}

function extractShareSansarContext(html, headers, pageUrl, symbol) {
    const context = getDirectShareSansarContext(html) || getEmbeddedShareSansarContext(html, symbol);
    if (!context) return null;

    return {
        ...context,
        cookie: getShareSansarCookie(headers),
        pageUrl
    };
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

function readFirstDefined(item, keys) {
    for (const key of keys) {
        if (item[key] !== undefined && item[key] !== null) return item[key];
    }
    return undefined;
}

const readAlphaNumber = (item, keys) => (
    parseFloat(readFirstDefined(item, keys)) || null
);

function toNepseAlphaRow(item) {
    return {
        date: new Date(readFirstDefined(item, ['businessDate', 'date', 'd'])),
        open: readAlphaNumber(item, ['openPrice', 'open', 'o']),
        high: readAlphaNumber(item, ['highPrice', 'high', 'h']),
        low: readAlphaNumber(item, ['lowPrice', 'low', 'l']),
        close: readAlphaNumber(item, ['closePrice', 'close', 'c', 'ltp']),
        volume: readAlphaNumber(item, ['totalTradeQuantity', 'volume', 'v'])
    };
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

    const rows = data.map(toNepseAlphaRow).filter(isValidSourceRow);

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
            const result = await fetchFromHistoricalSource(symbol, src);
            if (result) return result;
        } catch (e) {
            await handleHistoricalSourceError(symbol, src.name, e);
        }
    }

    return null;
}

async function fetchFromHistoricalSource(symbol, source) {
    const data = await source.fn();
    if (!data || data.length === 0) return null;

    log(`  ${symbol}: Got ${data.length} rows from ${source.name}`);
    return { data, source: source.name };
}

async function handleHistoricalSourceError(symbol, sourceName, errorValue) {
    if (errorValue.response?.status === 429) {
        warn(`  ${symbol}: Rate limited on ${sourceName}, waiting...`);
        await sleep(DELAY_ON_ERROR);
        return;
    }

    if ([404, 403].includes(errorValue.response?.status)) {
        return;
    }

    warn(`  ${symbol}: ${sourceName} failed: ${errorValue.message}`);
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

function normalizeValidRows(rows) {
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

    return {
        invalid,
        sorted: Array.from(normalizedByDay.values()).sort((a, b) => a.date - b.date)
    };
}

function getHistoryChange(row, previous) {
    if (!previous?.close || !row.close) {
        return { change: null, percentageChange: null };
    }

    const change = row.close - previous.close;
    return {
        change,
        percentageChange: (change / previous.close) * 100
    };
}

function toMarketHistoryRow(symbol, row, previous) {
    return {
        symbol,
        date: row.date,
        openPrice: row.open,
        closePrice: row.close,
        highPrice: row.high || null,
        lowPrice: row.low || null,
        volume: row.volume || null,
        turnover: row.turnover || null,
        ...getHistoryChange(row, previous)
    };
}

function enrichHistoryRows(symbol, sortedRows) {
    return sortedRows.map((row, index) => (
        toMarketHistoryRow(symbol, row, sortedRows[index - 1])
    ));
}

async function findExistingHistoryRow(row) {
    const { start, end } = dayRange(row.date);
    return prisma.marketHistory.findFirst({
        where: {
            symbol: row.symbol,
            date: { gte: start, lt: end }
        },
        select: { id: true }
    });
}

async function upsertHistoryRow(row) {
    const existing = await findExistingHistoryRow(row);

    if (!existing) {
        await prisma.marketHistory.create({ data: row });
        return 'created';
    }

    await prisma.marketHistory.update({ where: { id: existing.id }, data: row });
    return 'updated';
}

function incrementStoreStats(stats, result) {
    stats[result]++;
}

async function storeEnrichedRows(enrichedRows) {
    const stats = { created: 0, updated: 0, skipped: 0 };

    for (const row of enrichedRows) {
        try {
            incrementStoreStats(stats, await upsertHistoryRow(row));
        } catch (e) {
            stats.skipped++;
        }
    }

    return stats;
}

async function storeHistoryBatch(symbol, rows) {
    const { invalid, sorted } = normalizeValidRows(rows);
    const enriched = enrichHistoryRows(symbol, sorted);
    const stats = await storeEnrichedRows(enriched);
    const currentUpdated = await updateStockFromLatestHistory(symbol, enriched);

    return { ...stats, invalid, currentUpdated };
}

function logBackfillConfig() {
    log(`=== Historical Data Backfill ===`);
    log(`Target: ${TARGET_DAYS} trading days (approx 1 year = 235)`);
    log(`Force: ${FORCE}`);
    if (SINGLE_SYMBOL) log(`Focusing on: ${SINGLE_SYMBOL}`);
}

async function loadOrdinaryShareMap() {
    log('Fetching official ordinary-share directory...');
    const ordinaryShareMap = buildOrdinaryShareMap(await fetchOfficialCompanyList());
    if (ordinaryShareMap.size === 0) {
        throw new Error('Could not load ordinary-share list from NEPSE company directory');
    }
    return ordinaryShareMap;
}

async function loadDbStocks() {
    return prisma.stock.findMany({
        select: { symbol: true },
        ...(SINGLE_SYMBOL ? { where: { symbol: normalizeSymbol(SINGLE_SYMBOL) } } : {})
    });
}

function exitBackfill(message) {
    error(message);
    process.exit(1);
}

function validateSelectedStocks(dbStocks, stocks) {
    if (dbStocks.length === 0) {
        exitBackfill('No stocks found in database. Run the server first to populate stocks.');
    }
    if (stocks.length === 0 && SINGLE_SYMBOL) {
        exitBackfill(`${SINGLE_SYMBOL} is not an active ordinary share in NEPSE's company directory.`);
    }
}

function logExcludedSecurities(dbStocks, stocks) {
    const excluded = dbStocks.length - stocks.length;
    if (excluded > 0) {
        log(`Excluded ${excluded} non-ordinary securities from this backfill.`);
    }
}

async function loadTargetStocks() {
    const ordinaryShareMap = await loadOrdinaryShareMap();
    const dbStocks = await loadDbStocks();
    const stocks = dbStocks.filter(stock => ordinaryShareMap.has(normalizeSymbol(stock.symbol)));

    validateSelectedStocks(dbStocks, stocks);
    logExcludedSecurities(dbStocks, stocks);
    log(`Found ${stocks.length} stocks to process`);
    return stocks;
}

const createBackfillStats = () => ({
    processed: 0,
    fetched: 0,
    skipped: 0,
    failed: 0,
    totalStored: 0
});

async function getHistoryState(symbol) {
    const [count, latest] = await Promise.all([
        prisma.marketHistory.count({ where: { symbol } }),
        prisma.marketHistory.findFirst({
            where: { symbol },
            orderBy: { date: 'desc' },
            select: { date: true }
        })
    ]);
    return { count, latest };
}

function getStaleCutoff() {
    const staleCutoff = new Date();
    staleCutoff.setUTCDate(staleCutoff.getUTCDate() - STALE_DAYS);
    return staleCutoff;
}

const hasTargetHistoryDepth = (count) => count >= TARGET_DAYS;

const hasFreshLatestHistory = (latest) => Boolean(
    latest?.date && latest.date >= getStaleCutoff()
);

const getLatestHistoryDay = (latest) => (
    latest?.date?.toISOString().slice(0, 10) || 'unknown'
);

const createHistoryPlan = (skip, message) => ({ skip, message });

function getHistoryPlan({ count, latest }) {
    const latestDay = getLatestHistoryDay(latest);

    if (hasTargetHistoryDepth(count) && hasFreshLatestHistory(latest)) {
        return createHistoryPlan(true, `already has ${count} rows through ${latestDay}, skipping`);
    }

    if (hasTargetHistoryDepth(count)) {
        return createHistoryPlan(false, `has ${count} rows but latest is ${latestDay}, refreshing...`);
    }

    if (count > 0) {
        return createHistoryPlan(false, `has ${count}/${TARGET_DAYS} rows, fetching more...`);
    }

    return createHistoryPlan(false, 'no history, fetching...');
}

function logStockPlan(index, total, symbol, message) {
    log(`[${index + 1}/${total}] ${symbol}: ${message}`);
}

async function shouldSkipHistoryFetch(symbol, index, context) {
    if (FORCE) {
        logStockPlan(index, context.total, symbol, 'force mode, fetching...');
        return false;
    }

    const plan = getHistoryPlan(await getHistoryState(symbol));
    logStockPlan(index, context.total, symbol, plan.message);
    return plan.skip;
}

async function fetchWithRetries(symbol) {
    let result = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 0) {
            warn(`  ${symbol}: retry ${attempt}/${MAX_RETRIES}`);
            await sleep(DELAY_ON_ERROR);
        }

        result = await fetchHistoricalData(symbol);
        if (result) return result;
    }

    return result;
}

async function recordFetchedHistory(symbol, result, stats) {
    const stored = await storeHistoryBatch(symbol, result.data);
    stats.fetched++;
    stats.totalStored += stored.created;
    log(`  ${symbol}: created ${stored.created}, updated ${stored.updated}, skipped ${stored.skipped}, invalid ${stored.invalid}, current=${stored.currentUpdated ? 'updated' : 'unchanged'}`);
}

function recordFailedHistory(symbol, stats, failed) {
    error(`  ${symbol}: all sources failed`);
    stats.failed++;
    failed.push(symbol);
}

async function processBackfillStock(stock, index, context) {
    const { symbol } = stock;
    context.stats.processed++;

    if (await shouldSkipHistoryFetch(symbol, index, context)) {
        context.stats.skipped++;
        return;
    }

    const result = await fetchWithRetries(symbol);
    if (result) {
        await recordFetchedHistory(symbol, result, context.stats);
        return;
    }

    recordFailedHistory(symbol, context.stats, context.failed);
}

async function waitBetweenStocks(index, total) {
    if (index < total - 1) {
        await sleep(DELAY_BETWEEN_STOCKS);
    }
}

function logBackfillSummary(stats, failed) {
    log('\n=== Backfill Complete ===');
    log(`Processed: ${stats.processed}`);
    log(`Fetched:   ${stats.fetched}`);
    log(`Skipped:   ${stats.skipped} (already had sufficient data)`);
    log(`Failed:    ${stats.failed}`);
    log(`Rows stored: ${stats.totalStored}`);
    if (failed.length > 0) {
        log(`\nFailed symbols: ${failed.join(', ')}`);
    }
}

async function main() {
    logBackfillConfig();
    const stocks = await loadTargetStocks();
    const context = {
        stats: createBackfillStats(),
        failed: [],
        total: stocks.length
    };

    for (let i = 0; i < stocks.length; i++) {
        await processBackfillStock(stocks[i], i, context);
        await waitBetweenStocks(i, stocks.length);
    }

    logBackfillSummary(context.stats, context.failed);

    await prisma.$disconnect();
}

main().catch(async (e) => {
    error(e.message);
    await prisma.$disconnect();
    process.exit(1);
});
