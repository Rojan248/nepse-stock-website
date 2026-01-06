const { prisma } = require('./prismaClient');
const logger = require('../utils/logger');

let isInitialized = false;

// Connect Prisma client
const connectDB = async () => {
    try {
        if (!isInitialized) {
            await prisma.$connect();
            isInitialized = true;
            logger.info('Database connected (Prisma)');
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
