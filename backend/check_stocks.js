const { initializeFirebase, getDb } = require('./src/services/database/firebase');

// Mock simple logger
const logger = { info: console.log, error: console.error, warn: console.warn, debug: console.log };

const run = async () => {
    try {
        initializeFirebase();
        const db = getDb();

        // Check Market Summary
        const marketSummary = await db.collection('marketSummary').doc('current').get();
        if (marketSummary.exists) {
            console.log('--- MARKET SUMMARY ---');
            console.log('State:', marketSummary.data().state);
            console.log('IsOpen:', marketSummary.data().isOpen);
            console.log('----------------------');
        } else {
            console.log('Market Summary: Doc does not exist');
        }

        // Check AIG
        const symbols = ['AIG'];
        for (const symbol of symbols) {
            const doc = await db.collection('stocks').doc(symbol).get();
            if (doc.exists) {
                const data = doc.data();
                console.log(`${symbol}: LTP=${data.closePrice}, PrevClose=${data.previousClose}, Diff=${data.difference}`);
            }
        }
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

run();
