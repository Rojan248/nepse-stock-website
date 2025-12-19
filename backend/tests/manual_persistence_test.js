const stockOperations = require('../src/services/database/stockOperations');
const localStorage = require('../src/services/database/localStorage');
const logger = require('../src/services/utils/logger');

// Mock logger to prevent clutter
logger.info = console.log;
logger.error = console.error;
logger.debug = () => { }; // Silence debug logs for cleanliness

async function runTest() {
    console.log('🧪 Starting Manual Persistence Test');

    // Initialize local storage
    await localStorage.initializeLocalStorage();

    // Clear existing data for clean test
    await stockOperations.clearAllStocks();

    // 1. Setup: Create "Old Database" with valid data
    console.log('\n📝 Set up: Saving initial valid stock data...');
    const initialStocks = [
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

    await stockOperations.saveStocks(initialStocks);

    // Verify initial state
    const savedAdbl = await stockOperations.getStockBySymbol('ADBL');
    console.log(`   Initial ADBL LTP: ${savedAdbl.ltp} (Expected: 250)`);
    if (savedAdbl.ltp !== 250) {
        console.error('❌ FAILED: Setup failed to save initial data');
        return;
    }

    // 2. Test: Attempt to save invalid update (LTP = 0/missing)
    console.log('\n📝 Test: Attempting to overwrite with invalid data (LTP=0)...');

    const badUpdates = [
        {
            symbol: 'ADBL',
            companyName: 'Agricultural Development Bank',
            ltp: 0,
            // Simulate missing change fields in bad scrape
            sector: 'Commercial Bank',
            volume: 100 // New volume might be present even if price is 0
        },
        {
            symbol: 'NICA',
            // Missing ltp entirely
            companyName: 'NIC Asia Bank',
            sector: 'Commercial Bank'
        }
    ];

    await stockOperations.saveStocks(badUpdates);

    // 3. Verification
    console.log('\n🔍 Verifying results...');

    const finalAdbl = await stockOperations.getStockBySymbol('ADBL');
    const finalNica = await stockOperations.getStockBySymbol('NICA');

    console.log(`   Final ADBL LTP: ${finalAdbl.ltp}`);
    console.log(`   Final NICA LTP: ${finalNica.ltp}`);

    let passed = true;

    if (finalAdbl.ltp === 250) {
        console.log('✅ ADBL PASSED: Preserved old LTP 250 instead of 0');
    } else {
        console.error(`❌ ADBL FAILED: Logic allowed overwrite to ${finalAdbl.ltp}`);
        passed = false;
    }

    if (finalNica.ltp === 400) {
        console.log('✅ NICA PASSED: Preserved old LTP 400 instead of undefined');
    } else {
        console.error(`❌ NICA FAILED: Logic allowed overwrite to ${finalNica.ltp}`);
        passed = false;
    }

    // 4. Verify Weekend Logic (Mocking check)
    // We can't easily integrate test the entire scheduler here without mocking date, 
    // but we can verify the function modification was done by string check if needed.
    // However, the database logic is the most critical part to test here.

    if (passed) {
        console.log('\n✅ TEST SUITE PASSED: Data Persisted Successfully');
    } else {
        console.error('\n❌ TEST SUITE FAILED');
        process.exit(1);
    }
}

runTest().catch(console.error);
