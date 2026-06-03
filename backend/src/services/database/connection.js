const { prisma } = require('./prismaClient');
const logger = require('../utils/logger');

let isInitialized = false;

const enableWalMode = async () => {
    try {
        const result = await prisma.$queryRawUnsafe('PRAGMA journal_mode=WAL;');
        const mode = result?.[0]?.journal_mode || 'unknown';
        if (mode.toLowerCase() !== 'wal') {
            logger.warn(`Requested WAL mode, SQLite returned journal_mode=${mode}`);
        }
        logger.info('Database connected (Prisma) - WAL mode enabled');
    } catch (walError) {
        logger.warn(`Failed to enable WAL mode: ${walError.message}`);
    }
};

// Connect Prisma client
const connectDB = async () => {
    try {
        if (isInitialized) return true;

        await prisma.$connect();
        await enableWalMode();
        isInitialized = true;
        return true;
    } catch (error) {
        logger.error(`Database connection failed: ${error.message}`);
        throw error;
    }
};

// Disconnect Prisma client
const disconnectDB = async () => {
    try {
        await prisma.$disconnect();
        logger.info('Database disconnected');
        return true;
    } catch (error) {
        logger.error(`Error during disconnect: ${error.message}`);
        return false;
    }
};

const isConnected = () => isInitialized;

module.exports = {
    connectDB,
    disconnectDB,
    isConnected,
    prisma
};
