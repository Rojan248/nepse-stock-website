const watchdogService = require('../src/services/watchdog/WatchdogService');

async function run() {
    console.log('Running Watchdog Verification...');
    try {
        const report = await watchdogService.verify();
        console.log('Verification Report:');
        console.log(JSON.stringify(report, null, 2));
    } catch (e) {
        console.error('Watchdog failed:', e);
    }
    // Force exit as Prisma might keep connection open
    process.exit(0);
}

run();
