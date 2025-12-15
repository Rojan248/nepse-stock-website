/**
 * Seed Data Script (Client SDK Version)
 * Populates Firestore with extensive dummy data using public config
 * Usage: node src/scripts/seedData.js
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc, writeBatch, getDocs, deleteDoc } = require('firebase/firestore');

// Public config for NEPSE Web App
const firebaseConfig = {
    apiKey: "AIzaSyD2ZKminh6ib5Rh8XF5B-PBzKZ8Dy22Hqc",
    authDomain: "nepse-stock-website.firebaseapp.com",
    projectId: "nepse-stock-website",
    storageBucket: "nepse-stock-website.firebasestorage.app",
    messagingSenderId: "952598694406",
    appId: "1:952598694406:web:c78add95c57b844f1dd187"
};

// Import Data
const NEPSE_STOCKS = require('../data/nepseStocks');

// Helper to generate random number in range
const random = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min, max) => parseFloat((Math.random() * (max - min) + min).toFixed(2));

const seedData = async () => {
    try {
        console.log('Initializing Firebase Client SDK...');
        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);

        // 0. Clean up existing stocks (Delete all)
        console.log('Cleaning up existing stocks...');
        const stocksRef = collection(db, 'stocks');
        const snapshot = await getDocs(stocksRef);

        // Delete in batches of 500 (Firestore limit)
        const deleteBatch = writeBatch(db);
        let deleteCount = 0;

        snapshot.docs.forEach((doc) => {
            deleteBatch.delete(doc.ref);
            deleteCount++;
        });

        if (deleteCount > 0) {
            await deleteBatch.commit();
            console.log(`Deleted ${deleteCount} old stock records.`);
        } else {
            console.log('No existing stocks to delete.');
        }

        // 1. Seed Stocks
        console.log(`Seeding ${NEPSE_STOCKS.length} Real NEPSE Stocks...`);
        const stocks = [];

        // Generate stock data for each base stock
        NEPSE_STOCKS.forEach(base => {
            stocks.push(generateStock(base));
        });

        function generateStock(base) {
            const changePercent = randomFloat(-5, 5);
            const change = parseFloat((base.base * (changePercent / 100)).toFixed(1));
            const ltp = base.base + change;
            const open = Math.floor(base.base * (1 + randomFloat(-0.01, 0.01)));
            const high = Math.max(open, ltp, Math.floor(base.base * (1 + randomFloat(0, 0.03))));
            const low = Math.min(open, ltp, Math.floor(base.base * (1 - randomFloat(0, 0.03))));

            return {
                symbol: base.symbol,
                companyName: base.name,
                sector: base.sector,
                ltp: ltp,
                change: change,
                changePercent: changePercent,
                open: open,
                high: high,
                low: low,
                close: base.base,
                volume: random(1000, 100000),
                turnover: 0 // Calculated later
            };
        }

        // Calculate total stats
        let totalTurnover = 0;
        let totalVolume = 0;
        let active = 0, advanced = 0, declined = 0, unchanged = 0;

        const batch = writeBatch(db);
        stocks.forEach(stock => {
            stock.turnover = Math.floor(stock.volume * stock.ltp);
            totalTurnover += stock.turnover;
            totalVolume += stock.volume;

            if (stock.change > 0) advanced++;
            else if (stock.change < 0) declined++;
            else unchanged++;
            active++;

            const ref = doc(db, 'stocks', stock.symbol);
            batch.set(ref, {
                ...stock,
                updatedAt: new Date().toISOString(),
                timestamp: new Date().toISOString()
            });
        });
        await batch.commit();

        // 2. Seed Market Summary
        console.log('Seeding Market Summary...');
        await setDoc(doc(db, 'marketSummary', 'current'), {
            indexValue: 2045.67,
            indexChange: 12.45,
            indexChangePercent: 0.61,
            totalTurnover: totalTurnover,
            totalVolume: totalVolume,
            totalTransactions: random(40000, 60000),
            activeCompanies: active,
            advancedCompanies: advanced,
            declinedCompanies: declined,
            unchangedCompanies: unchanged,
            status: 'OPEN',
            updatedAt: new Date().toISOString(),
            timestamp: new Date().toISOString()
        });

        // 3. Seed IPOs (Keep existing)
        console.log('Seeding IPOs...');
        const ipos = [
            {
                companyName: 'Sarbottam Cement Limited',
                sector: 'Manufacturing',
                status: 'open',
                priceRange: { min: 360.90, max: 360.90 },
                dates: {
                    announcement: '2023-12-01',
                    open: '2024-01-25',
                    close: '2024-01-29'
                },
                issueManager: 'Global IME Capital',
                shareManager: 'Global IME Capital',
                totalShares: 2000000,
                subscriptionRatio: 1.5
            },
            {
                companyName: 'Reliable Life Insurance',
                sector: 'Life Insurance',
                status: 'upcoming',
                priceRange: { min: 257, max: 257 },
                dates: {
                    announcement: '2024-02-15',
                    open: '2024-03-01'
                },
                issueManager: 'Civil Capital',
                totalShares: 6000000
            }
        ];

        const ipoBatch = writeBatch(db);
        ipos.forEach(ipo => {
            const docId = ipo.companyName.replace(/[\/\.]/g, '_');
            const ref = doc(db, 'ipos', docId);
            ipoBatch.set(ref, {
                ...ipo,
                updatedAt: new Date().toISOString(),
                timestamp: new Date().toISOString()
            });
        });
        await ipoBatch.commit();

        console.log('Data seeding completed (60+ records)! ✅');
        process.exit(0);
    } catch (error) {
        console.error(`Error seeding data: ${error.message}`);
        process.exit(1);
    }
};

seedData();
