const { connectDB } = require('../src/services/database/connection');
const scheduler = require('../src/services/scheduler/updateScheduler');
const { getStoreSnapshot } = require('../src/services/database/localStorage');
const fs = require('fs');
const path = require('path');

async function verify() {
    let output = '';
    const log = (msg) => {
        console.log(msg);
        output += msg + '\n';
    };

    try {
        log('Connecting to database...');
        await connectDB();

        log('Forcing update cycle...');
        await scheduler.forceUpdate();

        log('Inspecting data snapshot...');
        const snapshot = getStoreSnapshot();

        const indicesCount = snapshot.marketSummary?.indices?.length || 0;
        log(`Indices count: ${indicesCount}`);

        if (indicesCount > 0) {
            log('Indices found:');
            snapshot.marketSummary.indices.forEach(idx => {
                log(`- ${idx.id}: ${idx.name} (${idx.value})`);
            });
        }

        if (indicesCount === 17) {
            log('VERIFICATION SUCCESS: All 17 indices are present.');
        } else {
            log(`VERIFICATION FAILED: Expected 17 indices, found ${indicesCount}.`);
        }

        fs.writeFileSync(path.join(__dirname, 'verification_result.txt'), output);
        process.exit(0);
    } catch (e) {
        log('Verification failed: ' + e.message);
        fs.writeFileSync(path.join(__dirname, 'verification_result.txt'), output);
        process.exit(1);
    }
}

verify();
