const watchdog = require('./src/services/watchdog/WatchdogService');

async function test() {
    console.log("Running Watchdog verification...");
    try {
        const report = await watchdog.verify();
        console.log(JSON.stringify(report, null, 2));
    } catch (e) {
        console.error("Watchdog test failed:", e);
        throw e;
    }
}

test().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
