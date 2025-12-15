const fs = require('fs');
const marketTime = require('./src/services/utils/marketTime');
const logger = require('./src/services/utils/logger');

const logParams = (msg) => {
    fs.appendFileSync('check_time_output.txt', msg + '\n');
    console.log(msg);
};

// Mock logger
logger.info = logParams;
logger.warn = logParams;
logger.debug = logParams;
logger.error = logParams;

const check = async () => {
    try {
        if (fs.existsSync('check_time.log')) fs.unlinkSync('check_time.log');
        logParams('--- Checking Time ---');
        logParams('Initializing sync...');
        await marketTime.initTimeSync();

        const components = marketTime.getNepseNowSync();
        logParams(`Components: Hour=${components.getHours()}, Minute=${components.getMinutes()}, Day=${components.getDay()}`);

        const state = marketTime.getMarketState();
        logParams(`Market State: ${state}`);
        logParams(`Is Active: ${marketTime.isMarketActive()}`);
    } catch (err) {
        logParams('Error: ' + err.message);
    }
};

check();
