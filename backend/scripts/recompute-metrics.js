/**
 * Recompute StockMetrics for all active stocks
 * Run after populate-52w.js to ensure StockMetrics reflects real 52W data
 *
 * Usage: node scripts/recompute-metrics.js
 */

const metricsOrchestrator = require('../src/services/metrics/metricsOrchestrator');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    console.log(`[${new Date().toISOString()}] Starting metrics recomputation...`);
    const result = await metricsOrchestrator.computeAll();
    console.log(`[${new Date().toISOString()}] Done: ${JSON.stringify(result)}`);
    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error(e.message);
    await prisma.$disconnect();
    process.exit(1);
});
