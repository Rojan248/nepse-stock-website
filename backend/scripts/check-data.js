require('dotenv').config();
const { prisma } = require('../src/services/database/connection');
(async () => {
    try {
        // Check how many days of history we actually have
        const sample = await prisma.marketHistory.findMany({
            where: { symbol: 'NABIL' },
            orderBy: { date: 'desc' },
            take: 5,
            select: { date: true, closePrice: true }
        });
        const total = await prisma.marketHistory.count({ where: { symbol: 'NABIL' } });

        // Check a few other stocks too
        const adbl = await prisma.marketHistory.count({ where: { symbol: 'ADBL' } });
        const hbl = await prisma.marketHistory.count({ where: { symbol: 'HBL' } });

        console.log(`NABIL: ${total} days of history`);
        console.log(`ADBL: ${adbl} days`);
        console.log(`HBL: ${hbl} days`);
        console.log('Recent NABIL dates:', sample.map(s => s.date.toISOString().split('T')[0]).join(', '));

        // Check a sample AI overview to see what it actually contains
        const ov = await prisma.aIOverview.findFirst({
            where: { symbol: 'NABIL', type: 'stock' }
        });
        if (ov) {
            let narrative, context;
            try {
                narrative = JSON.parse(ov.narrative);
                context = JSON.parse(ov.context);
            } catch (parseErr) {
                console.error(`Failed to parse JSON for overview id=${ov.id}:`, parseErr.message);
                return;
            }
            console.log('\n--- NABIL AI Overview ---');
            console.log('Summary:', narrative.summary);
            console.log('Bullets:', JSON.stringify(narrative.bullets, null, 2));
            console.log('Outlook:', narrative.outlook);
            console.log('\nContext sent to AI:', JSON.stringify(context, null, 2));
        }
    } finally {
        await prisma.$disconnect();
    }
})();
