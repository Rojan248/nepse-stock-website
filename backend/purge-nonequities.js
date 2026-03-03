require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { isKnownSymbol } = require('./src/services/dataEnricher');
const readline = require('readline');

async function askConfirmation(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise(resolve => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.toLowerCase());
        });
    });
}

async function processDeletion(candidates, isDryRun) {
    if (isDryRun) {
        console.log('\n[DRY RUN] Skipping deletions. Run without --dry-run to delete.');
        return;
    }

    const answer = await askConfirmation('\nProceed with deletion? (y/N): ');
    if (answer !== 'y' && answer !== 'yes') {
        console.log('Aborted.');
        return;
    }

    let deletedCount = 0;
    for (const stock of candidates) {
        console.log(`[DELETING] ${stock.symbol}...`);
        await prisma.stock.delete({ where: { id: stock.id } });
        deletedCount++;
    }

    console.log(`\nCleanup Complete! Deleted ${deletedCount} non-equity stocks.`);
}

async function cleanDB() {
    const isDryRun = process.argv.includes('--dry-run');
    console.log(`--- STARTING DB CLEANUP ${isDryRun ? '(DRY RUN)' : ''} ---`);

    try {
        const allStocks = await prisma.stock.findMany();
        const candidates = [];

        console.log(`Analyzing ${allStocks.length} stocks currently in the database...`);

        for (const stock of allStocks) {
            // Apply our strict filters
            const isEquity = isKnownSymbol(stock.symbol);

            if (!isEquity) {
                candidates.push(stock);
            }
        }

        console.log(`\nFound ${candidates.length} non-equity stocks out of ${allStocks.length}.`);
        if (candidates.length === 0) {
            console.log('Nothing to clean up.');
            return;
        }

        console.log('\nCandidates for deletion:');
        candidates.forEach(stock => {
            console.log(` - ${stock.symbol} (${stock.sector}) - ${stock.companyName}`);
        });

        await processDeletion(candidates, isDryRun);
        const remaining = await prisma.stock.count();
        console.log(`Remaining stocks: ${remaining}`);
    } catch (e) {
        console.error('Cleanup error:', e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

cleanDB();
