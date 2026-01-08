const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const stockOperations = require('../src/services/database/stockOperations');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runEOD() {
    console.log('--- Triggering Manual EOD Snapshot ---');
    try {
        const result = await stockOperations.snapshotDailyMarket();
        console.log('Snapshot Result:', result);

        // Verify one record
        const history = await prisma.marketHistory.findFirst({
            orderBy: { id: 'desc' },
            include: { stock: true }
        });

        if (history) {
            console.log('\nSample History Record:');
            console.log(`Symbol: ${history.symbol}`);
            console.log(`Date: ${history.date}`);
            console.log(`Close: ${history.closePrice}`);
            console.log(`Change: ${history.change}`);
            console.log(`% Change: ${history.percentageChange}%`);
        }

    } catch (error) {
        console.error('EOD Failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

runEOD();
