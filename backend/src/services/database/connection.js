/**
 * Database Connection - Firebase Firestore
 * Deprecated: This file previously handled MongoDB connection.
 * Now uses Firebase Firestore (see firebase.js)
 */

const { initializeFirebase, getDb, isConnected } = require('./firebase');
const logger = require('../utils/logger');

/**
 * Connect to database (initializes Firebase)
 */
const connectDB = async () => {
    try {
        initializeFirebase();
        logger.info('Database connected (Firebase Firestore)');
        return true;
    } catch (error) {
        logger.error(`Database connection failed: ${error.message}`);
        throw error;
    }
};

/**
 * Disconnect from database (no-op for Firestore)
 */
const disconnectDB = async () => {
    logger.info('Database disconnected');
    return true;
};

module.exports = {
    connectDB,
    disconnectDB,
    getDb,
    isConnected
};
