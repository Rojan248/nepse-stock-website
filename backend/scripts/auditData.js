const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

function createAnomalyStore() {
    return {
        zeroLTP: [],
        highLowMismatch: [],
        zeroOpenWithVolume: [],
        staleData: [],
        extremeChanges: []
    };
}

function checkZeroLtp(stock, anomalies) {
    if (!stock.lastTradedPrice || stock.lastTradedPrice === 0) {
        anomalies.zeroLTP.push(`${stock.symbol} (LTP: ${stock.lastTradedPrice})`);
    }
}

function checkHighLowMismatch(stock, anomalies) {
    const hasValidPrices = stock.highPrice > 0 && stock.lowPrice > 0;
    if (hasValidPrices && stock.highPrice < stock.lowPrice) {
        anomalies.highLowMismatch.push(`${stock.symbol} (High: ${stock.highPrice}, Low: ${stock.lowPrice})`);
    }
}

function checkZeroOpen(stock, anomalies) {
    const isZeroOpen = !stock.openPrice || stock.openPrice === 0;
    if (isZeroOpen && stock.volume > 0) {
        anomalies.zeroOpenWithVolume.push(`${stock.symbol} (Vol: ${stock.volume}, Open: ${stock.openPrice})`);
    }
}

function checkStaleness(stock, anomalies, now) {
    const timeDiff = now - new Date(stock.updatedAt);
    if (timeDiff > TWENTY_FOUR_HOURS) {
        anomalies.staleData.push(`${stock.symbol} (Last Updated: ${stock.updatedAt})`);
    }
}

function checkExtremeChange(stock, anomalies) {
    if (Math.abs(stock.percentageChange) > 15) {
        anomalies.extremeChanges.push(`${stock.symbol} (Change: ${stock.percentageChange}%)`);
    }
}

function analyzeStocks(stocks) {
    const anomalies = createAnomalyStore();
    const now = new Date();

    stocks.forEach(stock => {
        checkZeroLtp(stock, anomalies);
        checkHighLowMismatch(stock, anomalies);
        checkZeroOpen(stock, anomalies);
        checkStaleness(stock, anomalies, now);
        checkExtremeChange(stock, anomalies);
    });

    return anomalies;
}

function printReport(anomalies) {
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
}

async function auditData() {
    console.log('Starting Stock Data Audit...');
    console.log('----------------------------');

    try {
        const stocks = await prisma.stock.findMany();
        console.log(`Total Stocks Checked: ${stocks.length}`);

        const anomalies = analyzeStocks(stocks);
        printReport(anomalies);

    } catch (error) {
        console.error('Audit failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

auditData();

