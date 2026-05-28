#!/usr/bin/env node
/**
 * Stability gates for local/prod readiness.
 *
 * Checks database integrity, market data shape, live API health/readiness,
 * auth/user isolation flows, and a disposable backup/restore probe.
 */

const fs = require('fs/promises');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const BACKEND_ROOT = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(BACKEND_ROOT, '.env') });

const { prisma } = require('../src/services/database/connection');
const { isKnownSymbol } = require('../src/services/dataEnricher');

const API_BASE = process.env.STABILITY_API_BASE || 'http://localhost:5000/api';
const FRONTEND_BASE = process.env.STABILITY_FRONTEND_BASE || 'http://localhost:3000';
const TEST_PREFIX = `codex-stability-${Date.now()}`;
const PASSWORD = 'CodexStable123!';

const results = [];
const cleanupEmails = [];

function pass(name, detail = '') {
    results.push({ status: 'PASS', name, detail });
    console.log(`PASS ${name}${detail ? ` - ${detail}` : ''}`);
}

function fail(name, detail) {
    results.push({ status: 'FAIL', name, detail });
    throw new Error(`${name}: ${detail}`);
}

function warn(name, detail) {
    results.push({ status: 'WARN', name, detail });
    console.warn(`WARN ${name} - ${detail}`);
}

function assert(condition, name, detail) {
    if (!condition) fail(name, detail);
}

function toNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}

function splitSqlStatements(sql) {
    const uncommented = sql.replace(/^\s*--.*$/gm, '');
    return uncommented
        .split(/;\s*(?:\r?\n|$)/)
        .map(statement => statement.trim())
        .filter(Boolean);
}

async function assertSqliteObject(client, type, name, checkName) {
    const rows = await client.$queryRawUnsafe(
        'SELECT name FROM sqlite_master WHERE type = ? AND name = ? LIMIT 1',
        type,
        name
    );
    assert(rows.length === 1, checkName, `${type} ${name} is missing`);
}

async function assertColumn(client, table, column, checkName) {
    const columns = await client.$queryRawUnsafe(`PRAGMA table_info("${table}")`);
    assert(columns.some(item => item.name === column), checkName, `${table}.${column} is missing`);
}

async function fetchJson(pathname, options = {}) {
    const response = await fetch(`${API_BASE}${pathname}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });

    let body = null;
    try {
        body = await response.json();
    } catch {
        body = { success: false, error: { message: 'Non-JSON response' } };
    }

    return { response, body };
}

async function expectJson(pathname, options = {}, expectedStatus = 200) {
    const { response, body } = await fetchJson(pathname, options);
    assert(response.status === expectedStatus, `${pathname} status`, `expected ${expectedStatus}, got ${response.status}: ${JSON.stringify(body)}`);
    return body;
}

async function apiRequest(pathname, token, method = 'GET', data = undefined, expectedStatus = 200) {
    const options = {
        method,
        headers: token ? { Authorization: `Bearer ${token}` } : {}
    };
    if (data !== undefined) options.body = JSON.stringify(data);
    return expectJson(pathname, options, expectedStatus);
}

async function checkDatabaseIntegrity() {
    const quickCheck = await prisma.$queryRawUnsafe('PRAGMA quick_check;');
    const quickValue = quickCheck?.[0]?.quick_check || Object.values(quickCheck?.[0] || {})[0];
    assert(quickValue === 'ok', 'SQLite quick_check', JSON.stringify(quickCheck));
    pass('SQLite quick_check');

    for (const table of ['Stock', 'MarketHistory', 'MarketSummary', 'User', 'Watchlist', 'Portfolio', 'Alert', 'StockMetrics', 'Lock']) {
        await assertSqliteObject(prisma, 'table', table, `live schema table ${table}`);
    }
    for (const index of ['MarketHistory_symbol_date_key', 'StockMetrics_symbol_date_key', 'WatchlistItem_watchlistId_symbol_key']) {
        await assertSqliteObject(prisma, 'index', index, `live schema index ${index}`);
    }
    await assertColumn(prisma, 'Alert', 'triggeredAt', 'live schema Alert.triggeredAt');
    pass('live schema shape');

    const [stockCount, historyCount, metricCount, marketSummary] = await Promise.all([
        prisma.stock.count(),
        prisma.marketHistory.count(),
        prisma.stockMetrics.count(),
        prisma.marketSummary.findFirst({ orderBy: { timestamp: 'desc' } })
    ]);

    assert(stockCount >= 250, 'stock count', `expected >= 250, got ${stockCount}`);
    pass('stock count', `${stockCount}`);

    assert(historyCount > stockCount, 'history coverage', `history rows ${historyCount} should exceed stock count ${stockCount}`);
    pass('history coverage', `${historyCount} rows`);

    assert(metricCount >= stockCount * 0.75, 'metrics coverage', `metrics rows ${metricCount}, stock count ${stockCount}`);
    pass('metrics coverage', `${metricCount} rows`);

    assert(marketSummary, 'latest market summary', 'missing MarketSummary row');
    const requiredNumeric = ['indexValue', 'indexChangePercent', 'totalTurnover', 'totalVolume', 'totalTransactions'];
    for (const field of requiredNumeric) {
        assert(toNumber(marketSummary[field]) !== null, `market summary ${field}`, `value was ${marketSummary[field]}`);
    }

    const advanced = marketSummary.advancedCompanies || 0;
    const declined = marketSummary.declinedCompanies || 0;
    const unchanged = marketSummary.unchangedCompanies || 0;
    assert(advanced + declined + unchanged > 0, 'market breadth', 'advanced + declined + unchanged is zero');
    assert(advanced + declined + unchanged <= stockCount + 10, 'market breadth bounds', `breadth sum ${advanced + declined + unchanged}, stock count ${stockCount}`);
    pass('market summary numeric fields', `index ${marketSummary.indexValue}`);

    const duplicateHistory = await prisma.$queryRawUnsafe(`
        SELECT symbol, date, COUNT(*) AS count
        FROM MarketHistory
        GROUP BY symbol, date
        HAVING COUNT(*) > 1
        LIMIT 5;
    `);
    assert(duplicateHistory.length === 0, 'duplicate market history', JSON.stringify(duplicateHistory));
    pass('duplicate market history');

    const duplicateMetrics = await prisma.$queryRawUnsafe(`
        SELECT symbol, date, COUNT(*) AS count
        FROM StockMetrics
        GROUP BY symbol, date
        HAVING COUNT(*) > 1
        LIMIT 5;
    `);
    assert(duplicateMetrics.length === 0, 'duplicate stock metrics', JSON.stringify(duplicateMetrics));
    pass('duplicate stock metrics');

    const stocks = await prisma.stock.findMany({
        select: {
            symbol: true,
            lastTradedPrice: true,
            previousClose: true,
            highPrice: true,
            lowPrice: true,
            percentageChange: true
        }
    });
    const unknownSymbols = stocks.map(s => s.symbol).filter(symbol => !isKnownSymbol(symbol));
    assert(unknownSymbols.length === 0, 'ordinary-share symbol set', `unknown/non-ordinary symbols: ${unknownSymbols.slice(0, 20).join(', ')}`);
    pass('ordinary-share symbol set');

    const badPrices = stocks.filter(s => ['lastTradedPrice', 'previousClose', 'highPrice', 'lowPrice'].some(field => {
        const value = toNumber(s[field]);
        return value !== null && value < 0;
    }));
    assert(badPrices.length === 0, 'negative price fields', badPrices.slice(0, 10).map(s => s.symbol).join(', '));

    const impossibleMoves = stocks.filter(s => {
        const pct = Math.abs(toNumber(s.percentageChange) || 0);
        return pct > 25;
    });
    assert(impossibleMoves.length === 0, 'impossible daily moves', impossibleMoves.slice(0, 10).map(s => `${s.symbol}:${s.percentageChange}`).join(', '));
    pass('price sanity');
}

function sqlitePathFromDatabaseUrl() {
    const url = (process.env.DATABASE_URL || '').replace(/^"|"$/g, '');
    if (!url.startsWith('file:')) return null;
    const rawPath = url.slice('file:'.length);
    return path.isAbsolute(rawPath) ? rawPath : path.resolve(BACKEND_ROOT, rawPath);
}

async function checkBackupRestoreProbe() {
    const dbPath = sqlitePathFromDatabaseUrl();
    assert(dbPath, 'database backup probe', `unsupported DATABASE_URL ${process.env.DATABASE_URL}`);

    const backupPath = path.join(BACKEND_ROOT, 'logs', `stability-backup-${Date.now()}.db`);
    await fs.copyFile(dbPath, backupPath);

    const backupClient = new PrismaClient({
        datasources: { db: { url: `file:${backupPath.replace(/\\/g, '/')}` } }
    });

    try {
        const count = await backupClient.stock.count();
        assert(count >= 250, 'backup restore probe', `backup stock count ${count}`);
        pass('backup restore probe', `${count} stocks readable from copied DB`);
    } finally {
        await backupClient.$disconnect();
        await fs.rm(backupPath, { force: true });
    }
}

async function checkApiHealth() {
    const live = await expectJson('/health/live');
    assert(live.status === 'alive', 'health/live', JSON.stringify(live));
    pass('health/live');

    const health = await expectJson('/health');
    assert(health.status === 'healthy', 'health', JSON.stringify({ status: health.status, problems: health.problems, warnings: health.warnings }));
    assert(health.data?.freshness?.isFresh === true, 'health freshness', JSON.stringify(health.data?.freshness));
    assert((health.fetcher?.rateLimitEvents || 0) === 0, 'rate-limit telemetry', `${health.fetcher?.rateLimitEvents || 0} events`);
    pass('health', `source ${health.data?.source}, ${health.data?.stockCount} stocks`);

    const ready = await expectJson('/health/ready');
    assert(ready.status === 'ready', 'health/ready', JSON.stringify(ready));
    pass('health/ready');

    const scheduler = await expectJson('/scheduler-status');
    assert(scheduler.data?.isRunning === true, 'scheduler running', JSON.stringify(scheduler));
    pass('scheduler running', `next interval ${scheduler.data?.lastScheduledIntervalMs || 'unknown'}ms`);

    const summary = await expectJson('/market-summary');
    for (const field of ['indexValue', 'totalTurnover', 'totalVolume', 'totalTransactions']) {
        assert(toNumber(summary.data?.[field]) !== null, `api market-summary ${field}`, JSON.stringify(summary.data));
    }
    pass('api market summary', `index ${summary.data.indexValue}`);

    const stocks = await expectJson('/stocks?limit=10');
    assert(Array.isArray(stocks.data?.stocks || stocks.data), 'api stocks list', JSON.stringify(stocks).slice(0, 200));
    pass('api stocks list');

    const stock = await expectJson('/stocks/NABIL');
    assert(stock.data?.symbol === 'NABIL', 'api stock detail', JSON.stringify(stock.data));
    pass('api stock detail');

    for (const route of ['/stocks/top-gainers', '/stocks/top-losers', '/stocks/top-traded', '/ipos']) {
        const body = await expectJson(route);
        assert(body.success === true, `api ${route}`, JSON.stringify(body).slice(0, 200));
        pass(`api ${route}`);
    }
}

async function registerUser(label) {
    const email = `${TEST_PREFIX}-${label}@example.com`;
    cleanupEmails.push(email);
    const body = await apiRequest('/auth/register', null, 'POST', {
        email,
        password: PASSWORD,
        displayName: `Stability ${label}`
    }, 201);
    assert(body.data?.accessToken, `register ${label}`, JSON.stringify(body));
    return { email, token: body.data.accessToken, user: body.data.user };
}

async function checkAuthAndUserIsolation() {
    const userA = await registerUser('a');
    const userB = await registerUser('b');

    const me = await apiRequest('/auth/me', userA.token);
    assert(me.data?.email === userA.email, 'auth/me', JSON.stringify(me));
    pass('auth register/me');

    const watchlists = await apiRequest('/watchlists', userA.token);
    assert(Array.isArray(watchlists.data) && watchlists.data.length >= 1, 'default watchlist', JSON.stringify(watchlists));
    const watchlistId = watchlists.data[0].id;
    await apiRequest(`/watchlists/${watchlistId}/items`, userA.token, 'POST', { symbol: 'NABIL' }, 201);
    await apiRequest(`/watchlists/${watchlistId}/items/NABIL`, userA.token, 'DELETE');
    pass('watchlist add/remove');

    const portfolio = await apiRequest('/portfolios', userA.token, 'POST', { name: 'Stability Portfolio' }, 201);
    const portfolioId = portfolio.data.id;
    const trade = await apiRequest(`/portfolios/${portfolioId}/trades`, userA.token, 'POST', {
        symbol: 'NABIL',
        type: 'buy',
        quantity: 5,
        price: 537,
        date: '2026-05-27'
    }, 201);
    await apiRequest(`/portfolios/${portfolioId}/summary`, userA.token);
    await apiRequest(`/portfolios/${portfolioId}/summary`, userB.token, 'GET', undefined, 404);
    await apiRequest(`/portfolios/${portfolioId}/trades/${trade.data.id}`, userA.token, 'DELETE');
    await apiRequest(`/portfolios/${portfolioId}`, userA.token, 'DELETE');
    pass('portfolio CRUD and isolation');

    const alert = await apiRequest('/alerts', userA.token, 'POST', {
        symbol: 'NABIL',
        condition: 'above',
        threshold: 600
    }, 201);
    await apiRequest(`/alerts/${alert.data.id}`, userA.token, 'PUT', { enabled: false });
    await apiRequest(`/alerts/${alert.data.id}`, userB.token, 'DELETE', undefined, 404);
    await apiRequest(`/alerts/${alert.data.id}`, userA.token, 'DELETE');
    pass('alerts CRUD and isolation');
}

async function checkTempMigration() {
    const tempDb = path.join(BACKEND_ROOT, 'logs', `stability-migrate-${Date.now()}.db`);
    const migrationRoot = path.join(BACKEND_ROOT, 'prisma', 'migrations');
    const migrationClient = new PrismaClient({
        datasources: { db: { url: `file:${tempDb.replace(/\\/g, '/')}` } }
    });

    try {
        const migrationDirs = (await fs.readdir(migrationRoot, { withFileTypes: true }))
            .filter(entry => entry.isDirectory())
            .map(entry => entry.name)
            .sort();

        for (const migrationDir of migrationDirs) {
            const migrationSql = await fs.readFile(path.join(migrationRoot, migrationDir, 'migration.sql'), 'utf8');
            for (const statement of splitSqlStatements(migrationSql)) {
                await migrationClient.$executeRawUnsafe(statement);
            }
        }

        for (const table of ['Stock', 'MarketHistory', 'MarketSummary', 'User', 'Watchlist', 'Portfolio', 'Alert', 'StockMetrics', 'Lock']) {
            await assertSqliteObject(migrationClient, 'table', table, `fresh migration table ${table}`);
        }
        for (const index of ['MarketHistory_symbol_date_key', 'StockMetrics_symbol_date_key', 'WatchlistItem_watchlistId_symbol_key']) {
            await assertSqliteObject(migrationClient, 'index', index, `fresh migration index ${index}`);
        }
        await assertColumn(migrationClient, 'Alert', 'triggeredAt', 'fresh migration Alert.triggeredAt');
        pass('fresh migration replay', `${migrationDirs.length} migrations`);
    } finally {
        await migrationClient.$disconnect();
        await fs.rm(tempDb, { force: true }).catch(() => {});
    }
}

async function checkFrontendReachable() {
    const response = await fetch(FRONTEND_BASE);
    assert(response.ok, 'frontend reachable', `status ${response.status}`);
    const html = await response.text();
    assert(/NEPSE Stock Market|root/.test(html), 'frontend html', 'missing expected app shell');
    pass('frontend reachable');
}

async function cleanup() {
    if (cleanupEmails.length === 0) return;
    await prisma.user.deleteMany({ where: { email: { in: cleanupEmails } } });
}

async function main() {
    try {
        await checkDatabaseIntegrity();
        await checkBackupRestoreProbe();
        await checkTempMigration();
        await checkApiHealth();
        await checkAuthAndUserIsolation();
        await checkFrontendReachable();

        const failed = results.filter(r => r.status === 'FAIL').length;
        const warned = results.filter(r => r.status === 'WARN').length;
        console.log(`\nStability checks passed (${results.length - failed - warned} passed, ${warned} warnings).`);
    } finally {
        await cleanup().catch(error => warn('cleanup', error.message));
        await prisma.$disconnect();
    }
}

main().catch(error => {
    console.error(`\nSTABILITY CHECK FAILED: ${error.message}`);
    process.exitCode = 1;
});
