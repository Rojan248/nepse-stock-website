/**
 * IPO Database Operations - Prisma Implementation
 */

const { prisma } = require('./connection');
const logger = require('../utils/logger');

const mapIpoOutput = (ipo) => {
    if (!ipo) return null;
    return {
        id: ipo.id,
        symbol: ipo.symbol,
        companyName: ipo.companyName,
        sector: ipo.sector,
        issueDate: ipo.issueDate ? ipo.issueDate.toISOString() : null,
        closingDate: ipo.closingDate ? ipo.closingDate.toISOString() : null,
        price: ipo.price,
        units: ipo.units,
        status: ipo.status,
        issueManager: ipo.issueManager
    };
};

const saveIPOs = async (ipos) => {
    if (!Array.isArray(ipos) || ipos.length === 0) {
        return { success: true, count: 0 };
    }

    try {
        const ops = ipos
            .filter(ipo => ipo && (ipo.symbol || ipo.companyName))
            .map((ipo) => {
                const symbol = (ipo.symbol || ipo.companyName || '').toUpperCase();
                const data = {
                    symbol,
                    companyName: ipo.companyName || ipo.name || symbol,
                    sector: ipo.sector || null,
                    issueDate: ipo.issueDate ? new Date(ipo.issueDate) : null,
                    closingDate: ipo.closingDate ? new Date(ipo.closingDate) : null,
                    price: ipo.price ?? null,
                    units: ipo.units ?? null,
                    status: ipo.status ?? null,
                    issueManager: ipo.issueManager ?? null
                };

                return prisma.ipo.upsert({
                    where: { symbol },
                    update: data,
                    create: data
                });
            });

        await prisma.$transaction(ops);
        return { success: true, count: ops.length };
    } catch (error) {
        logger.error(`Error saving IPOs: ${error.message}`);
        throw error;
    }
};

const getAllIPOs = async ({ skip = 0, limit = 100, status = null } = {}) => {
    try {
        const where = status ? { status } : {};
        const ipos = await prisma.ipo.findMany({ where, skip, take: limit, orderBy: { companyName: 'asc' } });
        return ipos.map(mapIpoOutput);
    } catch (error) {
        logger.error(`Error getting IPOs: ${error.message}`);
        return [];
    }
};

const getIPOsByStatus = async (status) => {
    try {
        const ipos = await prisma.ipo.findMany({ where: { status } });
        return { ipos: ipos.map(mapIpoOutput), count: ipos.length };
    } catch (error) {
        logger.error(`Error getting IPOs by status: ${error.message}`);
        return { ipos: [], count: 0 };
    }
};

const getIPOByCompanyName = async (companyName) => {
    if (!companyName) return null;
    try {
        const ipo = await prisma.ipo.findFirst({
            where: {
                companyName: { equals: companyName, mode: 'insensitive' }
            }
        });
        return mapIpoOutput(ipo);
    } catch (error) {
        logger.error(`Error getting IPO ${companyName}: ${error.message}`);
        return null;
    }
};

const searchIPOs = async (query) => {
    if (!query) return [];
    try {
        const ipos = await prisma.ipo.findMany({
            where: {
                OR: [
                    { companyName: { contains: query, mode: 'insensitive' } },
                    { sector: { contains: query, mode: 'insensitive' } },
                    { issueManager: { contains: query, mode: 'insensitive' } }
                ]
            },
            take: 50
        });
        return ipos.map(mapIpoOutput);
    } catch (error) {
        logger.error(`Error searching IPOs: ${error.message}`);
        return [];
    }
};

const getActiveIPOs = async () => {
    try {
        const ipos = await prisma.ipo.findMany({
            where: { status: { in: ['open', 'upcoming'] } },
            orderBy: { issueDate: 'asc' }
        });
        return ipos.map(mapIpoOutput);
    } catch (error) {
        logger.error(`Error getting active IPOs: ${error.message}`);
        return [];
    }
};

const getIPOCounts = async () => {
    try {
        const statuses = ['upcoming', 'open', 'closed', 'completed'];
        const counts = {};
        for (const status of statuses) {
            counts[status] = await prisma.ipo.count({ where: { status } });
        }
        counts.total = await prisma.ipo.count();
        return counts;
    } catch (error) {
        logger.error(`Error getting IPO counts: ${error.message}`);
        return { upcoming: 0, open: 0, closed: 0, completed: 0, total: 0 };
    }
};

module.exports = {
    saveIPOs,
    getAllIPOs,
    getIPOsByStatus,
    getIPOByCompanyName,
    searchIPOs,
    getActiveIPOs,
    getIPOCounts
};
