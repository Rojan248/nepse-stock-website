const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function auditData() {
    console.log('Starting Stock Data Audit...');
    console.log('----------------------------');

    try {
        const stocks = await prisma.stock.findMany();
        console.log(`Total Stocks Checked: ${stocks.length}`);

        const anomalies = {
            zeroLTP: [],
            highLowMismatch: [],
            zeroOpenWithVolume: [],
            staleData: [],
            extremeChanges: []
        };

        const now = new Date();
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

        stocks.forEach(stock => {
            // 1. Zero Values
            if (!stock.lastTradedPrice || stock.lastTradedPrice === 0) {
                anomalies.zeroLTP.push(`${stock.symbol} (LTP: ${stock.lastTradedPrice})`);
            }

            // 2. Data Consistency
            if (stock.highPrice > 0 && stock.lowPrice > 0 && stock.highPrice < stock.lowPrice) {
                anomalies.highLowMismatch.push(`${stock.symbol} (High: ${stock.highPrice}, Low: ${stock.lowPrice})`);
            }

            if ((!stock.openPrice || stock.openPrice === 0) && stock.volume > 0) {
                anomalies.zeroOpenWithVolume.push(`${stock.symbol} (Vol: ${stock.volume}, Open: ${stock.openPrice})`);
            }

            // 3. Stale Data (Warning only)
            const timeDiff = now - new Date(stock.updatedAt);
            if (timeDiff > TWENTY_FOUR_HOURS) {
                anomalies.staleData.push(`${stock.symbol} (Last Updated: ${stock.updatedAt})`);
            }

            // 4. Extreme Changes (>15%)
            if (Math.abs(stock.percentageChange) > 15) {
                anomalies.extremeChanges.push(`${stock.symbol} (Change: ${stock.percentageChange}%)`);
            }
        });

        // Report
        console.log('\n--- Audit Report ---');

        if (anomalies.zeroLTP.length > 0) {
            console.log(`\n[CRITICAL] Stocks with Zero/Null LTP (${anomalies.zeroLTP.length}):`);
            anomalies.zeroLTP.forEach(s => console.log(` - ${s}`));
        } else {
            console.log('\n[OK] No stocks with Zero LTP found.');
        }

        if (anomalies.highLowMismatch.length > 0) {
            console.log(`\n[CRITICAL] High < Low Inconsistencies (${anomalies.highLowMismatch.length}):`);
            anomalies.highLowMismatch.forEach(s => console.log(` - ${s}`));
        } else {
            console.log('[OK] High/Low prices are consistent.');
        }

        if (anomalies.zeroOpenWithVolume.length > 0) {
            console.log(`\n[WARNING] Volume > 0 but OpenPrice is 0 (${anomalies.zeroOpenWithVolume.length}):`);
            anomalies.zeroOpenWithVolume.forEach(s => console.log(` - ${s}`));
        }

        if (anomalies.staleData.length > 0) {
            console.log(`\n[WARNING] Stale Data (>24h) (${anomalies.staleData.length}):`);
            console.log(` - ${anomalies.staleData.length} stocks haven't updated in 24h.`);
            // Only show first 5
            anomalies.staleData.slice(0, 5).forEach(s => console.log(` - ${s}`));
            if (anomalies.staleData.length > 5) console.log(' ...and more');
        } else {
            console.log('[OK] All data is fresh (<24h).');
        }

        if (anomalies.extremeChanges.length > 0) {
            console.log(`\n[WARNING] Extreme Price Changes > 15% (${anomalies.extremeChanges.length}):`);
            anomalies.extremeChanges.forEach(s => console.log(` - ${s}`));
        }

        console.log('\n----------------------------');
        console.log('Audit Completed.');

    } catch (error) {
        console.error('Audit failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

auditData();
