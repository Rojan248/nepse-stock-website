/**
 * populate-52w.js
 *
 * Fetches authoritative 52-week high/low data from NEPSE's /security/{id} endpoint
 * and stores it in the Stock table. Also enriches today's MarketHistory with full OHLCV.
 *
 * Why: The NEPSE API provides pre-computed fiftyTwoWeekHigh/Low for each security.
 * We store these in Stock.high52w / Stock.low52w so priceMetrics.js can use them
 * as authoritative fallback when we have < 235 days of MarketHistory.
 *
 * Usage:
 *   node scripts/populate-52w.js              # skip stocks already having 52W data
 *   node scripts/populate-52w.js --force      # re-fetch all stocks
 *   node scripts/populate-52w.js --symbol NABIL
 */

const axios = require('axios');
const https = require('https');
const { PrismaClient } = require('@prisma/client');
const { sleep, log, warn } = require('./scriptUtils');

const prisma = new PrismaClient();

const ARGS = process.argv.slice(2);
const FORCE = ARGS.includes('--force');
const SINGLE_SYMBOL = ARGS.includes('--symbol') ? ARGS[ARGS.indexOf('--symbol') + 1] : null;
const DELAY = 400; // ms between /security/{id} calls

const agent = new https.Agent();

// Auth state — refreshed on 401
let _nepseClient = null;
let _createHeaders = null;
let _authHeaders = null;

async function initNepseAuth() {
    log('Authenticating with NEPSE...');
    const nepseModule = await import('nepse-api-helper');
    _nepseClient = nepseModule.nepseClient;
    _createHeaders = nepseModule.createHeaders;
    await _nepseClient.initialize({ useWasm: true });
    _authHeaders = await refreshToken();
    log('NEPSE authentication successful');
    return _authHeaders;
}

async function refreshToken() {
    log('Refreshing NEPSE token...');
    const token = await _nepseClient.getToken();
    _authHeaders = {
        ..._createHeaders(token),
        'Referer': 'https://www.nepalstock.com.np/'
    };
    return _authHeaders;
}

async function fetchAllSecurityIds(authHeaders) {
    log('Fetching all securities from NEPSE securityDailyTradeStat...');
    const res = await axios.get(
        'https://www.nepalstock.com.np/api/nots/securityDailyTradeStat/58',
        { headers: authHeaders, timeout: 20000, httpsAgent: agent }
    );
    const data = res.data;
    if (!Array.isArray(data)) throw new Error(`Expected array, got ${typeof data}`);
    log(`Got ${data.length} securities from NEPSE`);

    // Build symbol → securityId map
    const map = {};
    data.forEach(s => {
        if (s.symbol && s.securityId) {
            map[s.symbol] = {
                securityId: String(s.securityId),
                closePrice: s.closePrice || s.lastTradedPrice,
                previousClose: s.previousClose,
                percentageChange: s.percentageChange,
                volume: s.totalTradeQuantity
            };
        }
    });
    log(`Built securityId map for ${Object.keys(map).length} symbols`);
    return map;
}

const readMarketValue = (market, ...keys) => {
    for (const key of keys) {
        if (market[key]) return market[key];
    }
    return null;
};

function mapSecurityDetails(payload) {
    const mcs = payload.securityMcsData || {};
    const sec = payload.securityData || {};
    return {
        openPrice: readMarketValue(mcs, 'openPrice'),
        highPrice: readMarketValue(mcs, 'highPrice'),
        lowPrice: readMarketValue(mcs, 'lowPrice'),
        closePrice: readMarketValue(mcs, 'closePrice', 'lastTradedPrice'),
        volume: readMarketValue(mcs, 'totalTradeQuantity'),
        totalTrades: readMarketValue(mcs, 'totalTrades'),
        turnover: readMarketValue(mcs, 'turnover'),
        previousClose: readMarketValue(mcs, 'previousClose'),
        businessDate: readMarketValue(mcs, 'businessDate'),
        fiftyTwoWeekHigh: readMarketValue(mcs, 'fiftyTwoWeekHigh'),
        fiftyTwoWeekLow: readMarketValue(mcs, 'fiftyTwoWeekLow'),
        companyName: readMarketValue(sec, 'companyName'),
        sector: readMarketValue(sec, 'sectorName')
    };
}

const isAuthExpired = (error) => error.response?.status === 401;

async function requestSecurityDetails(url) {
    const res = await axios.get(url, {
        headers: _authHeaders,
        timeout: 15000,
        httpsAgent: agent
    });
    return mapSecurityDetails(res.data);
}

async function refreshExpiredAuth(attempt) {
    warn(`Token expired, refreshing... (attempt ${attempt + 1})`);
    await sleep(2000);
    await refreshToken();
}

async function fetchSecurityDetails(securityId) {
    const url = `https://www.nepalstock.com.np/api/nots/security/${securityId}`;
    let lastError;

    // Try up to 3 times, refreshing token on 401
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            return await requestSecurityDetails(url);
        } catch (e) {
            lastError = e;
            if (!isAuthExpired(e)) {
                throw e; // Non-401 error, don't retry
            }
            await refreshExpiredAuth(attempt);
        }
    }
    throw lastError;
}

const createStats = () => ({
    processed: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    noNepseId: 0
});

async function loadTargetStocks() {
    const stocks = await prisma.stock.findMany({
        select: { symbol: true, high52w: true, low52w: true, nepseSecurityId: true },
        ...(SINGLE_SYMBOL ? { where: { symbol: SINGLE_SYMBOL } } : {})
    });
    log(`Found ${stocks.length} stocks in DB`);
    return stocks;
}

const shouldSkipStock = (stock) => !FORCE && stock.high52w !== null;

const hasFiftyTwoWeekData = (details) => (
    details.fiftyTwoWeekHigh || details.fiftyTwoWeekLow
);

function logRunConfiguration() {
    log('=== Populate 52-Week High/Low from NEPSE ===');
    log(`Force: ${FORCE}${SINGLE_SYMBOL ? ` | Symbol: ${SINGLE_SYMBOL}` : ''}`);
}

function logFinalStats(stats) {
    log('\n=== Complete ===');
    log(`Processed:  ${stats.processed}`);
    log(`Updated:    ${stats.updated}`);
    log(`Skipped:    ${stats.skipped} (already had 52W data)`);
    log(`No NEPSE:   ${stats.noNepseId} (symbol not found in NEPSE list)`);
    log(`Failed:     ${stats.failed}`);
}

async function updateStockFiftyTwoWeekData(symbol, securityId, details) {
    await prisma.stock.update({
        where: { symbol },
        data: {
            high52w: details.fiftyTwoWeekHigh,
            low52w: details.fiftyTwoWeekLow,
            nepseSecurityId: securityId
        }
    });
}

function toMarketHistoryDate(details) {
    const businessDate = new Date(details.businessDate);
    businessDate.setHours(6, 15, 0, 0);
    return businessDate;
}

async function findExistingMarketHistory(symbol, businessDate) {
    return prisma.marketHistory.findFirst({
        where: {
            symbol,
            date: {
                gte: new Date(businessDate.getTime() - 12 * 3600000),
                lte: new Date(businessDate.getTime() + 12 * 3600000)
            }
        }
    });
}

function getHistoryMovement(details) {
    if (!details.closePrice || !details.previousClose) {
        return { change: null, percentageChange: null };
    }

    const change = details.closePrice - details.previousClose;
    return {
        change,
        percentageChange: (change / details.previousClose) * 100
    };
}

function buildMarketHistoryData(symbol, businessDate, details) {
    return {
        symbol,
        date: businessDate,
        openPrice: details.openPrice,
        closePrice: details.closePrice,
        highPrice: details.highPrice,
        lowPrice: details.lowPrice,
        volume: details.volume,
        turnover: details.turnover,
        ...getHistoryMovement(details)
    };
}

async function updateExistingMarketHistory(existingHistory, details) {
    await prisma.marketHistory.update({
        where: { id: existingHistory.id },
        data: {
            openPrice: details.openPrice || existingHistory.openPrice,
            highPrice: details.highPrice || existingHistory.highPrice,
            lowPrice: details.lowPrice || existingHistory.lowPrice,
            volume: details.volume || existingHistory.volume,
            turnover: details.turnover || existingHistory.turnover
        }
    });
}

async function upsertTodayMarketHistory(symbol, details) {
    if (!details.closePrice || !details.businessDate) return;

    const businessDate = toMarketHistoryDate(details);
    const existingHistory = await findExistingMarketHistory(symbol, businessDate);

    if (existingHistory) {
        await updateExistingMarketHistory(existingHistory, details);
        return;
    }

    await prisma.marketHistory.create({
        data: buildMarketHistoryData(symbol, businessDate, details)
    });
}

function logStockUpdated(symbol, details) {
    log(`  ${symbol}: 52W H=${details.fiftyTwoWeekHigh} L=${details.fiftyTwoWeekLow} | Today O=${details.openPrice} H=${details.highPrice} L=${details.lowPrice} C=${details.closePrice}`);
}

async function processSecurityDetails(symbol, securityId) {
    const details = await fetchSecurityDetails(securityId);

    if (!hasFiftyTwoWeekData(details)) {
        warn(`  ${symbol}: NEPSE returned no 52W data`);
        return false;
    }

    await updateStockFiftyTwoWeekData(symbol, securityId, details);
    await upsertTodayMarketHistory(symbol, details);
    logStockUpdated(symbol, details);
    return true;
}

const createRunContext = (dbStocks, securityMap, stats) => ({
    securityMap,
    stats,
    total: dbStocks.length
});

async function processStock(stock, index, context) {
    const { symbol } = stock;
    const { securityMap, stats, total } = context;
    stats.processed++;

    if (shouldSkipStock(stock)) {
        log(`[${index + 1}/${total}] ${symbol}: already has 52W data, skipping`);
        stats.skipped++;
        return;
    }

    const nepseEntry = securityMap[symbol];
    if (!nepseEntry) {
        warn(`[${index + 1}/${total}] ${symbol}: not found in NEPSE security list`);
        stats.noNepseId++;
        return;
    }

    log(`[${index + 1}/${total}] ${symbol} (ID: ${nepseEntry.securityId}): fetching 52W data...`);
    try {
        const updated = await processSecurityDetails(symbol, nepseEntry.securityId);
        stats[updated ? 'updated' : 'failed']++;
    } catch (e) {
        warn(`  ${symbol}: Failed - ${e.message.slice(0, 80)}`);
        stats.failed++;
    }
}

async function main() {
    logRunConfiguration();
    const authHeaders = await initNepseAuth();
    const dbStocks = await loadTargetStocks();
    const securityMap = await fetchAllSecurityIds(authHeaders);
    const stats = createStats();
    const context = createRunContext(dbStocks, securityMap, stats);

    for (let i = 0; i < dbStocks.length; i++) {
        await processStock(dbStocks[i], i, context);
        if (i < dbStocks.length - 1) {
            await sleep(DELAY);
        }
    }

    logFinalStats(stats);
    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error(e.message);
    await prisma.$disconnect();
    process.exit(1);
});
