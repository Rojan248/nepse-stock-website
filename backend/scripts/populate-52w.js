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

async function fetchSecurityDetails(securityId) {
    const url = `https://www.nepalstock.com.np/api/nots/security/${securityId}`;
    let lastError;

    // Try up to 3 times, refreshing token on 401
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const res = await axios.get(url, {
                headers: _authHeaders, timeout: 15000, httpsAgent: agent
            });
            const d = res.data;
            const mcs = d.securityMcsData || {};
            const sec = d.securityData || {};
            return {
                openPrice: mcs.openPrice || null,
                highPrice: mcs.highPrice || null,
                lowPrice: mcs.lowPrice || null,
                closePrice: mcs.closePrice || mcs.lastTradedPrice || null,
                volume: mcs.totalTradeQuantity || null,
                totalTrades: mcs.totalTrades || null,
                turnover: mcs.turnover || null,
                previousClose: mcs.previousClose || null,
                businessDate: mcs.businessDate || null,
                fiftyTwoWeekHigh: mcs.fiftyTwoWeekHigh || null,
                fiftyTwoWeekLow: mcs.fiftyTwoWeekLow || null,
                companyName: sec.companyName || null,
                sector: sec.sectorName || null
            };
        } catch (e) {
            lastError = e;
            if (e.response?.status === 401) {
                warn(`Token expired, refreshing... (attempt ${attempt + 1})`);
                await sleep(2000);
                await refreshToken();
            } else {
                throw e; // Non-401 error, don't retry
            }
        }
    }
    throw lastError;
}

async function main() {
    log('=== Populate 52-Week High/Low from NEPSE ===');
    log(`Force: ${FORCE}${SINGLE_SYMBOL ? ` | Symbol: ${SINGLE_SYMBOL}` : ''}`);

    // Authenticate
    const authHeaders = await initNepseAuth();

    // Get all stocks from our DB
    const dbStocks = await prisma.stock.findMany({
        select: { symbol: true, high52w: true, low52w: true, nepseSecurityId: true },
        ...(SINGLE_SYMBOL ? { where: { symbol: SINGLE_SYMBOL } } : {})
    });
    log(`Found ${dbStocks.length} stocks in DB`);

    // Get NEPSE security ID map (bulk fetch)
    const securityMap = await fetchAllSecurityIds(authHeaders);

    const stats = { processed: 0, updated: 0, skipped: 0, failed: 0, noNepseId: 0 };
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < dbStocks.length; i++) {
        const { symbol, high52w, nepseSecurityId } = dbStocks[i];
        stats.processed++;

        // Skip if already has data and not forcing
        if (!FORCE && high52w !== null) {
            log(`[${i + 1}/${dbStocks.length}] ${symbol}: already has 52W data, skipping`);
            stats.skipped++;
            continue;
        }

        // Find security ID
        const nepseEntry = securityMap[symbol];
        if (!nepseEntry) {
            warn(`[${i + 1}/${dbStocks.length}] ${symbol}: not found in NEPSE security list`);
            stats.noNepseId++;
            continue;
        }

        const secId = nepseEntry.securityId;
        log(`[${i + 1}/${dbStocks.length}] ${symbol} (ID: ${secId}): fetching 52W data...`);

        try {
            const details = await fetchSecurityDetails(secId);

            if (!details.fiftyTwoWeekHigh && !details.fiftyTwoWeekLow) {
                warn(`  ${symbol}: NEPSE returned no 52W data`);
                stats.failed++;
                continue;
            }

            // Update Stock with 52W data and NEPSE ID
            await prisma.stock.update({
                where: { symbol },
                data: {
                    high52w: details.fiftyTwoWeekHigh,
                    low52w: details.fiftyTwoWeekLow,
                    nepseSecurityId: secId
                }
            });

            // Also upsert today's MarketHistory with full OHLCV if available
            if (details.closePrice && details.businessDate) {
                const businessDate = new Date(details.businessDate);
                businessDate.setHours(6, 15, 0, 0); // 06:15 UTC = 12:00 NST to avoid timezone issues

                // Check if we already have a markethistory row for today
                const existingHistory = await prisma.marketHistory.findFirst({
                    where: {
                        symbol,
                        date: {
                            gte: new Date(businessDate.getTime() - 12 * 3600000),
                            lte: new Date(businessDate.getTime() + 12 * 3600000)
                        }
                    }
                });

                const change = details.closePrice && details.previousClose
                    ? details.closePrice - details.previousClose
                    : null;
                const percentageChange = change && details.previousClose
                    ? (change / details.previousClose) * 100
                    : null;

                const historyData = {
                    symbol,
                    date: businessDate,
                    openPrice: details.openPrice,
                    closePrice: details.closePrice,
                    highPrice: details.highPrice,
                    lowPrice: details.lowPrice,
                    volume: details.volume,
                    turnover: details.turnover,
                    change,
                    percentageChange
                };

                if (existingHistory) {
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
                } else {
                    await prisma.marketHistory.create({ data: historyData });
                }
            }

            log(`  ${symbol}: 52W H=${details.fiftyTwoWeekHigh} L=${details.fiftyTwoWeekLow} | Today O=${details.openPrice} H=${details.highPrice} L=${details.lowPrice} C=${details.closePrice}`);
            stats.updated++;

        } catch (e) {
            warn(`  ${symbol}: Failed - ${e.message.slice(0, 80)}`);
            stats.failed++;
        }

        // Rate limit
        if (i < dbStocks.length - 1) {
            await sleep(DELAY);
        }
    }

    log('\n=== Complete ===');
    log(`Processed:  ${stats.processed}`);
    log(`Updated:    ${stats.updated}`);
    log(`Skipped:    ${stats.skipped} (already had 52W data)`);
    log(`No NEPSE:   ${stats.noNepseId} (symbol not found in NEPSE list)`);
    log(`Failed:     ${stats.failed}`);

    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error(e.message);
    await prisma.$disconnect();
    process.exit(1);
});
