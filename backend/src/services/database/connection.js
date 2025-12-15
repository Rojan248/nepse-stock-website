/**
 * Database Connection - Local Storage
 * Uses local JSON file storage for data persistence
 */

const { initializeLocalStorage, saveAllData } = require('./localStorage');
const logger = require('../utils/logger');

let isInitialized = false;

/**
 * Connect to database (initializes local storage)
 */
const connectDB = async () => {
    try {
        if (!isInitialized) {
            initializeLocalStorage();
            isInitialized = true;
            logger.info('Database connected (Local JSON Storage)');
        }
        return true;
    } catch (error) {
        logger.error(`Database connection failed: ${error.message}`);
        throw error;
    }
};

/**
 * Disconnect from database (save all data)
 */
const disconnectDB = async () => {
    try {
        saveAllData();
        logger.info('Database disconnected (data saved)');
        return true;
    } catch (error) {
        logger.error(`Error during disconnect: ${error.message}`);
        return false;
    }
};

/**
 * Check if database is connected
 */
const isConnected = () => {
    return isInitialized;
};

module.exports = {
    connectDB,
    disconnectDB,
    isConnected
};
