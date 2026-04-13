const { prisma } = require('./prismaClient');
const logger = require('../utils/logger');

let isInitialized = false;

// Connect Prisma client
const connectDB = async () => {
    try {
        if (!isInitialized) {
            await prisma.$connect();
            
            // Enable WAL mode for better concurrency in SQLite
            try {
                await prisma.$executeRawUnsafe('PRAGMA journal_mode=WAL;');
                logger.info('Database connected (Prisma) - WAL mode enabled');
            } catch (walError) {
                logger.warn(`Failed to enable WAL mode: ${walError.message}`);
            }
            
            isInitialized = true;
        }
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
