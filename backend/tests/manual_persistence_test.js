const stockOperations = require('../src/services/database/stockOperations');
const localStorage = require('../src/services/database/localStorage');
const logger = require('../src/services/utils/logger');

// Mock logger to prevent clutter
logger.info = console.log;
logger.error = console.error;
logger.debug = () => { }; // Silence debug logs for cleanliness

const INITIAL_STOCKS = [
    {
        symbol: 'ADBL',
        companyName: 'Agricultural Development Bank',
        ltp: 250,
        change: 5,
        changePercent: 2.0,
        sector: 'Commercial Bank'
    },
    {
        symbol: 'NICA',
        companyName: 'NIC Asia Bank',
        ltp: 400,
        change: -2,
        changePercent: -0.5,
        sector: 'Commercial Bank'
    }
];

const BAD_UPDATES = [
    {
        symbol: 'ADBL',
        companyName: 'Agricultural Development Bank',
        ltp: 0,
        sector: 'Commercial Bank',
        volume: 100
    },
    {
        symbol: 'NICA',
        companyName: 'NIC Asia Bank',
        sector: 'Commercial Bank'
    }
];

/** Seed initial valid stock data and verify it was stored */
async function seedInitialData() {
    console.log('\n📝 Set up: Saving initial valid stock data...');
    await stockOperations.saveStocks(INITIAL_STOCKS);

    const savedAdbl = await stockOperations.getStockBySymbol('ADBL');
    console.log(`   Initial ADBL LTP: ${savedAdbl.ltp} (Expected: 250)`);
    if (savedAdbl.ltp !== 250) {
        throw new Error('Setup failed to save initial data');
    }
}

/** Attempt to overwrite with invalid data (LTP=0 or missing) */
async function applyBadUpdates() {
    console.log('\n📝 Test: Attempting to overwrite with invalid data (LTP=0)...');
    await stockOperations.saveStocks(BAD_UPDATES);
}

/** Check that original LTP values were preserved after bad updates */
function assertResult(label, stock, expectedLtp) {
    console.log(`   Final ${label} LTP: ${stock.ltp}`);
    if (stock.ltp === expectedLtp) {
        console.log(`✅ ${label} PASSED: Preserved old LTP ${expectedLtp}`);
        return true;
    }
    console.error(`❌ ${label} FAILED: Logic allowed overwrite to ${stock.ltp}`);
    return false;
}

async function verifyResults() {
    console.log('\n🔍 Verifying results...');
    const finalAdbl = await stockOperations.getStockBySymbol('ADBL');
    const finalNica = await stockOperations.getStockBySymbol('NICA');

    const adblOk = assertResult('ADBL', finalAdbl, 250);
    const nicaOk = assertResult('NICA', finalNica, 400);
    return adblOk && nicaOk;
}

async function runTest() {
    console.log('🧪 Starting Manual Persistence Test');

    await localStorage.initializeLocalStorage();
    await stockOperations.clearAllStocks();

    await seedInitialData();
    await applyBadUpdates();

    const passed = await verifyResults();

    if (passed) {
        console.log('\n✅ TEST SUITE PASSED: Data Persisted Successfully');
    } else {
        console.error('\n❌ TEST SUITE FAILED');
        process.exit(1);
    }
}

runTest().catch(console.error);
