#!/usr/bin/env node
/**
 * Unified backend operations runner.
 *
 * This replaces small one-off diagnostic, benchmark, verifier, and supervisor
 * scripts with a single entrypoint:
 *
 *   node scripts/ops.js verify
 *   node scripts/ops.js summary --take 2
 *   node scripts/ops.js breadth
 *   node scripts/ops.js watchdog
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { printJson } = require('./scriptUtils');

const BACKEND_ROOT = path.resolve(__dirname, '..');

const SKIP_DIRS = new Set(['node_modules', 'logs', 'data', 'coverage', 'dist', 'build']);
let forceExit = false;

function parseArgs(args) {
    const options = {};
    const positional = [];

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (!arg.startsWith('--')) {
            positional.push(arg);
            continue;
        }

        const key = arg.slice(2);
        const next = args[i + 1];
        if (!next || next.startsWith('--')) {
            options[key] = true;
        } else {
            options[key] = next;
            i++;
        }
    }

    return { options, positional, raw: args };
}

function quoteShellArg(arg) {
    if (!/[^\w./:-]/.test(arg)) return arg;
    return `"${arg.replace(/"/g, '\\"')}"`;
}

function run(command, args, cwd = BACKEND_ROOT) {
    const useWindowsShell = process.platform === 'win32' && ['npm', 'npx'].includes(command);
    const result = useWindowsShell
        ? spawnSync([command, ...args.map(quoteShellArg)].join(' '), {
            cwd,
            stdio: 'inherit',
            shell: true
        })
        : spawnSync(command, args, {
            cwd,
            stdio: 'inherit'
        });

    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
    }
}

function runNodeScript(scriptName, args = []) {
    run(process.execPath, [path.join(BACKEND_ROOT, 'scripts', scriptName), ...args]);
}

function collectJsFiles(dir, files = []) {
    if (!fs.existsSync(dir)) return files;

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (SKIP_DIRS.has(entry.name)) continue;

        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            collectJsFiles(fullPath, files);
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            files.push(fullPath);
        }
    }

    return files;
}

function checkJsSyntax() {
    const files = [
        ...collectJsFiles(path.join(BACKEND_ROOT, 'src')),
        ...collectJsFiles(path.join(BACKEND_ROOT, 'scripts'))
    ];

    for (const file of files) {
        run(process.execPath, ['--check', file]);
    }

    console.log(`Checked syntax for ${files.length} backend JS files.`);
}

async function withPrisma(task) {
    const { prisma } = require('../src/services/database/connection');
    try {
        return await task(prisma);
    } finally {
        await prisma.$disconnect();
    }
}

async function commandVerify() {
    checkJsSyntax();
    run('npx', ['prisma', 'validate']);
    run('npm', ['test', '--', '--runInBand']);
}

async function commandSummary({ options }) {
    const take = Number(options.take || 2);
    await withPrisma(async (prisma) => {
        const rows = await prisma.marketSummary.findMany({
            orderBy: { timestamp: 'desc' },
            take: Number.isFinite(take) && take > 0 ? take : 2
        });
        printJson(rows);
    });
}

async function commandBreadth() {
    await withPrisma(async (prisma) => {
        const latestSummary = await prisma.marketSummary.findFirst({ orderBy: { timestamp: 'desc' } });
        const [advanced, declined, unchanged, topAdvancers, topDecliners, sampleUnchanged] = await Promise.all([
            prisma.stock.count({ where: { percentageChange: { gt: 0 } } }),
            prisma.stock.count({ where: { percentageChange: { lt: 0 } } }),
            prisma.stock.count({ where: { OR: [{ percentageChange: 0 }, { percentageChange: null }] } }),
            prisma.stock.findMany({
                where: { percentageChange: { gt: 0 } },
                select: { symbol: true, percentageChange: true },
                orderBy: { percentageChange: 'desc' },
                take: 10
            }),
            prisma.stock.findMany({
                where: { percentageChange: { lt: 0 } },
                select: { symbol: true, percentageChange: true },
                orderBy: { percentageChange: 'asc' },
                take: 10
            }),
            prisma.stock.findMany({
                where: { OR: [{ percentageChange: 0 }, { percentageChange: null }] },
                select: { symbol: true },
                take: 10
            })
        ]);

        printJson({
            snapshotTimestamp: latestSummary?.timestamp || null,
            counts: { advanced, declined, unchanged },
            topAdvancers,
            topDecliners,
            sampleUnchanged
        });
    });
}

async function commandMarketSchema() {
    await withPrisma(async (prisma) => {
        const rows = await prisma.$queryRawUnsafe("PRAGMA table_info('MarketSummary');");
        printJson(rows);
    });
}

async function commandWatchdog() {
    const watchdogService = require('../src/services/watchdog/WatchdogService');
    const report = await watchdogService.verify();
    printJson(report);
    forceExit = true;
}

async function commandEod() {
    const stockOperations = require('../src/services/database/stockOperations');
    await withPrisma(async (prisma) => {
        const result = await stockOperations.snapshotDailyMarket();
        const sample = await prisma.marketHistory.findFirst({
            orderBy: { id: 'desc' },
            include: { stock: true }
        });
        printJson({ result, sample });
    });
}

async function commandMetrics() {
    const metricsOrchestrator = require('../src/services/metrics/metricsOrchestrator');
    await withPrisma(async () => {
        const result = await metricsOrchestrator.computeAll();
        printJson(result);
    });
}

async function commandPayloadBenchmark() {
    const { mapStockOutput } = require('../src/services/utils/dataNormalizer');
    const count = 5000;
    const base = {
        symbol: 'TEST',
        companyName: 'Test Company Limited',
        sector: 'Banking',
        lastTradedPrice: 105,
        prices: { open: 100, high: 110, low: 95, close: 105, ltp: 105 },
        volume: 10000,
        turnover: 1050000,
        totalTrades: 50,
        change: 5,
        changePercent: 5.0,
        percentageChange: 5.0,
        previousClose: 100,
        openPrice: 100,
        highPrice: 110,
        lowPrice: 95,
        updatedAt: new Date()
    };
    const stocks = Array.from({ length: count }, (_, i) => ({ ...base, symbol: `TEST${i}`, id: i }));

    const measure = (compact) => {
        const start = process.hrtime();
        const mapped = stocks.map(s => mapStockOutput(s, compact));
        const elapsed = process.hrtime(start);
        const payload = JSON.stringify(mapped);
        return {
            timeMs: Number((elapsed[0] * 1000 + elapsed[1] / 1e6).toFixed(2)),
            bytes: Buffer.byteLength(payload, 'utf8')
        };
    };

    const full = measure(false);
    const compact = measure(true);
    printJson({
        stocks: count,
        full,
        compact,
        reductionPercent: Number(((1 - compact.bytes / full.bytes) * 100).toFixed(2))
    });
}

async function commandIpoBenchmark({ options }) {
    const iterations = Number(options.iterations || 100);
    const rows = Number(options.rows || 1000);
    const { getIPOCounts } = require('../src/services/database/ipoOperations');

    await withPrisma(async (prisma) => {
        const statuses = ['upcoming', 'open', 'closed', 'completed'];
        const prefix = 'BENCH_IPO_';

        await prisma.ipo.deleteMany({ where: { symbol: { startsWith: prefix } } });
        await prisma.ipo.createMany({
            data: Array.from({ length: rows }, (_, i) => ({
                symbol: `${prefix}${i}`,
                companyName: `Benchmark Company ${i}`,
                status: statuses[i % statuses.length],
                issueDate: new Date(),
                closingDate: new Date(),
                price: 100,
                units: 1000
            }))
        });

        const start = Date.now();
        for (let i = 0; i < iterations; i++) {
            await getIPOCounts();
        }
        const durationMs = Date.now() - start;
        const counts = await getIPOCounts();

        await prisma.ipo.deleteMany({ where: { symbol: { startsWith: prefix } } });

        printJson({
            rows,
            iterations,
            durationMs,
            averageMs: Number((durationMs / iterations).toFixed(2)),
            counts
        });
    });
}

async function commandForwardScript({ raw }, scriptName) {
    runNodeScript(scriptName, raw);
}

function help() {
    console.log(`Usage: node scripts/ops.js <command> [options]

Commands:
  verify              Syntax check backend JS, validate Prisma, run backend Jest
  stable              Run DB/API/auth/frontend stability gates
  summary             Print recent market summaries (--take 2)
  breadth             Print current market breadth counts and top movers
  market-schema       Print MarketSummary table columns
  watchdog            Run watchdog verification
  eod                 Trigger end-of-day market snapshot and print a sample row
  metrics             Recompute StockMetrics for all active stocks
  payload-benchmark   Compare compact vs full stock payload size
  ipo-benchmark       Benchmark getIPOCounts (--rows 1000 --iterations 100)
  backfill-history    Fetch historical OHLCV data for stocks
  market-history      Import daily NEPSE index history into MarketSummary
  ordinary-shares     Keep Stock data limited to active ordinary shares
  populate-52w        Fetch authoritative 52-week high/low data
  scrape-merolagani   Populate extended indicators from MeroLagani pages
  seed-ipos           Replace IPO rows with local sample IPO data
  migrate-json        Import legacy JSON data files into SQLite
`);
}

const COMMANDS = {
    verify: commandVerify,
    stable: (args) => commandForwardScript(args, 'stability-check.js'),
    summary: commandSummary,
    breadth: commandBreadth,
    'market-schema': commandMarketSchema,
    watchdog: commandWatchdog,
    eod: commandEod,
    metrics: commandMetrics,
    'payload-benchmark': commandPayloadBenchmark,
    'ipo-benchmark': commandIpoBenchmark,
    'backfill-history': (args) => commandForwardScript(args, 'backfill-history.js'),
    'market-history': (args) => commandForwardScript(args, 'backfill-market-summary.js'),
    'ordinary-shares': (args) => commandForwardScript(args, 'sync-ordinary-shares.js'),
    'populate-52w': (args) => commandForwardScript(args, 'populate-52w.js'),
    'scrape-merolagani': (args) => commandForwardScript(args, 'scrape-merolagani.js'),
    'seed-ipos': (args) => commandForwardScript(args, 'seed-ipos.js'),
    'migrate-json': (args) => commandForwardScript(args, 'migrate-json-to-sqlite.js'),
    help: async () => help()
};

async function main() {
    const [commandName = 'help', ...rest] = process.argv.slice(2);
    const command = COMMANDS[commandName];

    if (!command) {
        help();
        throw new Error(`Unknown command: ${commandName}`);
    }

    await command(parseArgs(rest));
}

main()
    .catch((error) => {
        console.error(error.message);
        process.exitCode = 1;
    })
    .finally(() => {
        if (forceExit) process.exit(process.exitCode || 0);
    });
