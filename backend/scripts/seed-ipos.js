const logger = require('../src/services/utils/logger');
/**
 * Comprehensive IPO Seed Script - Seeds realistic Nepal IPO data
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ipos = [
    // ===== OPEN IPOs (2) =====
    {
        symbol: 'SJLIC',
        companyName: 'Surya Jyoti Life Insurance Company Limited',
        sector: 'Life Insurance',
        status: 'open',
        price: 100,
        units: 8000000,
        issueDate: new Date('2026-02-05'),
        closingDate: new Date('2026-02-12'),
        issueManager: 'NIBL Capital Markets'
    },
    {
        symbol: 'NHDL',
        companyName: 'Nepal Hydropower Development Company Limited',
        sector: 'Hydropower',
        status: 'open',
        price: 100,
        units: 5000000,
        issueDate: new Date('2026-02-03'),
        closingDate: new Date('2026-02-10'),
        issueManager: 'Sunrise Capital Ltd'
    },

    // ===== UPCOMING IPOs (4) =====
    {
        symbol: 'UFIL',
        companyName: 'United Finance Limited (FPO)',
        sector: 'Finance',
        status: 'upcoming',
        price: 158,
        units: 2500000,
        issueDate: new Date('2026-02-15'),
        closingDate: new Date('2026-02-22'),
        issueManager: 'Prabhu Capital'
    },
    {
        symbol: 'GBIME',
        companyName: 'Global IME Bank Limited (FPO)',
        sector: 'Commercial Bank',
        status: 'upcoming',
        price: 325,
        units: 12000000,
        issueDate: new Date('2026-02-20'),
        closingDate: new Date('2026-02-28'),
        issueManager: 'Global IME Capital'
    },
    {
        symbol: 'HDHPC',
        companyName: 'Himalayan Distillery Hydropower Company',
        sector: 'Hydropower',
        status: 'upcoming',
        price: 100,
        units: 3200000,
        issueDate: new Date('2026-03-01'),
        closingDate: null,
        issueManager: 'NMB Capital'
    },
    {
        symbol: 'MLBS',
        companyName: 'Muktinath Bikas Bank Limited',
        sector: 'Development Bank',
        status: 'upcoming',
        price: 100,
        units: 4000000,
        issueDate: new Date('2026-03-10'),
        closingDate: null,
        issueManager: 'NIBL Capital Markets'
    },

    // ===== CLOSED IPOs (5) =====
    {
        symbol: 'SJCLN',
        companyName: 'Shree Jaleshwori Cement Nepal Limited',
        sector: 'Manufacturing',
        status: 'closed',
        price: 360,
        units: 2000000,
        issueDate: new Date('2026-01-20'),
        closingDate: new Date('2026-01-27'),
        issueManager: 'Nabil Investment Banking'
    },
    {
        symbol: 'PCLIC',
        companyName: 'Prime Commercial Life Insurance Company',
        sector: 'Life Insurance',
        status: 'closed',
        price: 100,
        units: 5500000,
        issueDate: new Date('2026-01-15'),
        closingDate: new Date('2026-01-22'),
        issueManager: 'Civil Capital Markets'
    },
    {
        symbol: 'NLBBL',
        companyName: 'Nepal Lube Oil Limited',
        sector: 'Manufacturing',
        status: 'closed',
        price: 212,
        units: 1500000,
        issueDate: new Date('2026-01-10'),
        closingDate: new Date('2026-01-17'),
        issueManager: 'Sunrise Capital Ltd'
    },
    {
        symbol: 'UMHL',
        companyName: 'Upper Modi Hydropower Limited',
        sector: 'Hydropower',
        status: 'closed',
        price: 100,
        units: 7500000,
        issueDate: new Date('2026-01-05'),
        closingDate: new Date('2026-01-12'),
        issueManager: 'Prabhu Capital'
    },
    {
        symbol: 'RBCL',
        companyName: 'Reliance Finance (FPO)',
        sector: 'Finance',
        status: 'closed',
        price: 135,
        units: 1800000,
        issueDate: new Date('2025-12-28'),
        closingDate: new Date('2026-01-04'),
        issueManager: 'NMB Capital'
    },

    // ===== COMPLETED IPOs (6) =====
    {
        symbol: 'AKPL',
        companyName: 'Arun Kabeli Power Limited',
        sector: 'Hydropower',
        status: 'completed',
        price: 100,
        units: 9500000,
        issueDate: new Date('2025-12-15'),
        closingDate: new Date('2025-12-22'),
        issueManager: 'Global IME Capital'
    },
    {
        symbol: 'NHIF',
        companyName: 'National Hydel Investment Fund',
        sector: 'Mutual Fund',
        status: 'completed',
        price: 10,
        units: 50000000,
        issueDate: new Date('2025-12-01'),
        closingDate: new Date('2025-12-08'),
        issueManager: 'Sunrise Capital Ltd'
    },
    {
        symbol: 'NLIC',
        companyName: 'Nepal Life Insurance Company (FPO)',
        sector: 'Life Insurance',
        status: 'completed',
        price: 657,
        units: 3000000,
        issueDate: new Date('2025-11-20'),
        closingDate: new Date('2025-11-27'),
        issueManager: 'NIBL Capital Markets'
    },
    {
        symbol: 'NBB',
        companyName: 'Nepal Bangladesh Bank (Right Share)',
        sector: 'Commercial Bank',
        status: 'completed',
        price: 100,
        units: 8000000,
        issueDate: new Date('2025-11-10'),
        closingDate: new Date('2025-11-17'),
        issueManager: 'Civil Capital Markets'
    },
    {
        symbol: 'SRBL',
        companyName: 'Sunrise Bank Limited (Bonus)',
        sector: 'Commercial Bank',
        status: 'completed',
        price: 100,
        units: 5500000,
        issueDate: new Date('2025-10-25'),
        closingDate: new Date('2025-11-01'),
        issueManager: 'Sunrise Capital Ltd'
    },
    {
        symbol: 'SNPL',
        companyName: 'Sanjen Power Limited',
        sector: 'Hydropower',
        status: 'completed',
        price: 100,
        units: 4200000,
        issueDate: new Date('2025-10-15'),
        closingDate: new Date('2025-10-22'),
        issueManager: 'NMB Capital'
    }
];

async function seedIPOs() {
    logger.info('Seeding comprehensive IPO data...');

    await prisma.ipo.deleteMany({});
    logger.info('Cleared existing IPO data');

    await prisma.ipo.createMany({ data: ipos });

    for (const ipo of ipos) {
        logger.info(`  [${ipo.status}] ${ipo.companyName}`);
    }

    // Get counts
    const [open, upcoming, closed, completed] = await Promise.all([
        prisma.ipo.count({ where: { status: 'open' } }),
        prisma.ipo.count({ where: { status: 'upcoming' } }),
        prisma.ipo.count({ where: { status: 'closed' } }),
        prisma.ipo.count({ where: { status: 'completed' } })
    ]);

    const counts = { open, upcoming, closed, completed };

    logger.info('IPO Statistics:');
    logger.info(`   Open:      ${counts.open}`);
    logger.info(`   Upcoming:  ${counts.upcoming}`);
    logger.info(`   Closed:    ${counts.closed}`);
    logger.info(`   Completed: ${counts.completed}`);
    logger.info('   -----------------');
    logger.info(`   Total:     ${counts.open + counts.upcoming + counts.closed + counts.completed}`);

    logger.info('IPO seeding completed successfully.');
}

seedIPOs()
    .catch(logger.error)
    .finally(() => prisma.$disconnect());
