const analytics = require('./backend/src/services/analytics');
const logger = require('./backend/src/services/utils/logger');

// Mock logger
logger.debug = console.log;
logger.info = console.log;
logger.warn = console.log;

console.log('--- Testing Analytics Hardening ---');

// 1. Test Valid Inputs
console.log('\nTesting Valid Inputs:');
analytics.recordSearch('NABIL');
analytics.recordSearch('SHIVM');
analytics.recordView('AHPC');
console.log(`Scores Size: ${analytics.scores.size} (Expected: 3)`);

// 2. Test Invalid Inputs (Should be ignored)
console.log('\nTesting Invalid Inputs:');
analytics.recordSearch('Toolongstringtoobestockticker');
analytics.recordSearch('<script>alert(1)</script>');
analytics.recordSearch('DROP TABLE users');
analytics.recordSearch('A'); // Too short
console.log(`Scores Size: ${analytics.scores.size} (Expected: 3 - no change)`);

// 3. Test Size Limit
console.log('\nTesting Size Limit (Mocking limit to 3):');
analytics.MAX_ENTRIES = 3;
analytics.recordSearch('NEW1'); // Should be ignored (Map is full)
console.log(`Scores Size: ${analytics.scores.size} (Expected: 3)`);

// 4. Test Existing Key Update when Full (Should work)
analytics.recordSearch('NABIL');
const nabil = analytics.scores.get('NABIL');
console.log(`NABIL Searches: ${nabil.searches} (Expected: 2)`);
