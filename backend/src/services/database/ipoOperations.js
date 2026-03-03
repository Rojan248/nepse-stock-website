/**
 * IPO Database Operations - Prisma Implementation
 */

const { prisma } = require('./connection');
const logger = require('../utils/logger');

// ==================== Helpers ====================

/** Convert a date-like value to ISO string, or null */
const toISOOrNull = (date) => date ? date.toISOString() : null;

/** Convert a date-like value to a Date object, or null */
const toDateOrNull = (val) => val ? new Date(val) : null;

/** Check if an IPO record has enough data to be saved */
const isValidIpo = (ipo) => ipo && (ipo.symbol || ipo.companyName);

/** Normalize an IPO record into a Prisma-compatible data object */
const buildIpoData = (ipo) => {
    const symbol = (ipo.symbol || ipo.companyName || '').toUpperCase();
    return {
        symbol,
        companyName: ipo.companyName || ipo.name || symbol,
        sector: ipo.sector || null,
        issueDate: toDateOrNull(ipo.issueDate),
        closingDate: toDateOrNull(ipo.closingDate),
        price: ipo.price ?? null,
        units: ipo.units ?? null,
        status: ipo.status ?? null,
        issueManager: ipo.issueManager ?? null
    };
};

/** Build a Prisma upsert operation from normalized IPO data */
const buildUpsertOp = (data) => prisma.ipo.upsert({
    where: { symbol: data.symbol },
    update: data,
    create: data
});

// ==================== Output Mapping ====================

const mapIpoOutput = (ipo) => {
    if (!ipo) return null;
    return {
        id: ipo.id,
        symbol: ipo.symbol,
        companyName: ipo.companyName,
        sector: ipo.sector,
        issueDate: toISOOrNull(ipo.issueDate),
        closingDate: toISOOrNull(ipo.closingDate),
        price: ipo.price,
        units: ipo.units,
        status: ipo.status,
        issueManager: ipo.issueManager
    };
};

// ==================== Core Operations ====================

const saveIPOs = async (ipos) => {
    if (!Array.isArray(ipos) || ipos.length === 0) {
        return { success: true, count: 0 };
    }

    try {
        const ops = ipos.filter(isValidIpo).map(ipo => buildUpsertOp(buildIpoData(ipo)));
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
        const [groupResult, total] = await Promise.all([
            prisma.ipo.groupBy({
                by: ['status'],
                _count: { status: true },
                where: { status: { in: statuses } }
            }),
            prisma.ipo.count()
        ]);

        const counts = {};
        for (const status of statuses) {
            const found = groupResult.find(g => g.status === status);
            counts[status] = found ? found._count.status : 0;
        }
        counts.total = total;
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
