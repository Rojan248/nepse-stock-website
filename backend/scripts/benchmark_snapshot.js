const { prisma } = require('../src/services/database/prismaClient');
const { snapshotDailyMarket } = require('../src/services/database/stockOperations');

const NUM_STOCKS = 1000;
const TEST_SYMBOL_PREFIX = 'PERF_TEST_';

async function setup() {
    console.log('Setting up benchmark data...');
    // Clean up any previous test run
    await cleanup();

    const stocks = [];
    for (let i = 0; i < NUM_STOCKS; i++) {
        const prev = 100 + Math.random() * 1000;
        const ltp = prev + (Math.random() * 200 - 100); // Random change within +/- 100
        const change = parseFloat((ltp - prev).toFixed(2));
        const pChange = parseFloat(((change / prev) * 100).toFixed(2));

        stocks.push({
            symbol: `${TEST_SYMBOL_PREFIX}${i}`,
            companyName: `Performance Test Company ${i}`,
            lastTradedPrice: parseFloat(ltp.toFixed(2)),
            previousClose: parseFloat(prev.toFixed(2)),
            highPrice: Math.max(ltp, prev) + Math.random() * 10,
            lowPrice: Math.min(ltp, prev) - Math.random() * 10,
            volume: Math.floor(Math.random() * 10000),
            turnover: Math.random() * 1000000,
            change: change,
            percentageChange: pChange
        });
    }

    await prisma.stock.createMany({
        data: stocks
    });
    console.log(`Created ${NUM_STOCKS} dummy stocks.`);
}

async function cleanup() {
    console.log('Cleaning up benchmark data...');
    // Delete test stocks. Cascade delete should handle history if configured,
    // but schema says `onDelete: Cascade` for MarketHistory -> Stock relation, so deleting stock is enough.
    // However, let's be explicit.
    await prisma.marketHistory.deleteMany({
        where: {
            symbol: { startsWith: TEST_SYMBOL_PREFIX }
        }
    });
    await prisma.stock.deleteMany({
        where: {
            symbol: { startsWith: TEST_SYMBOL_PREFIX }
        }
    });
}

async function verify() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const count = await prisma.marketHistory.count({
        where: {
            symbol: { startsWith: TEST_SYMBOL_PREFIX },
            date: today
        }
    });

    if (count !== NUM_STOCKS) {
        console.error(`Verification FAILED: Expected ${NUM_STOCKS} history records, found ${count}`);
    } else {
        console.log(`Verification PASSED: Found ${count} history records.`);
    }
}

async function runBenchmark() {
    try {
        await setup();

        console.log('Starting snapshotDailyMarket benchmark (INSERT scenario)...');
        const startCreate = performance.now();
        await snapshotDailyMarket();
        const endCreate = performance.now();
        console.log(`snapshotDailyMarket (INSERT) took ${(endCreate - startCreate).toFixed(2)} ms`);

        await verify();

        console.log('Starting snapshotDailyMarket benchmark (UPDATE scenario)...');
        // Modify stocks to force updates? No need, even if data is same, it performs update query.
        // But let's modify some prices to be realistic.
        // We can't easily modify 1000 stocks one by one efficiently here without defeating the purpose.
        // But `snapshotDailyMarket` reads from `Stock` table.
        // If we don't change `Stock` table, `snapshotDailyMarket` will update `MarketHistory` with same values.
        // This is still an UPDATE operation on DB.

        const startUpdate = performance.now();
        await snapshotDailyMarket();
        const endUpdate = performance.now();
        console.log(`snapshotDailyMarket (UPDATE) took ${(endUpdate - startUpdate).toFixed(2)} ms`);

        await verify();

    } catch (error) {
        console.error('Benchmark failed:', error);
    } finally {
        await cleanup();
        await prisma.$disconnect();
    }
}

runBenchmark();
