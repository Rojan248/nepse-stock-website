const { prisma } = require('../src/services/database/connection');
const { getIPOCounts } = require('../src/services/database/ipoOperations');

async function benchmark() {
    console.log('🚀 Starting Benchmark: getIPOCounts');

    // 1. Setup Data
    console.log('📝 Seeding database with 1000 IPOs...');

    // Clear existing data
    try {
        await prisma.ipo.deleteMany({});
    } catch (e) {
        console.error('Error clearing data:', e.message);
    }

    const statuses = ['upcoming', 'open', 'closed', 'completed'];
    const ipos = [];
    for (let i = 0; i < 1000; i++) {
        ipos.push({
            symbol: `IPO${i}`,
            companyName: `Company ${i}`,
            status: statuses[i % statuses.length],
            issueDate: new Date(),
            closingDate: new Date(),
            price: 100,
            units: 1000
        });
    }

    try {
        // Attempt createMany (supported in recent Prisma versions even for SQLite)
        await prisma.ipo.createMany({ data: ipos });
    } catch (e) {
        console.log('createMany failed, falling back to loop', e.message);
        // Fallback
        for (const ipo of ipos) {
            await prisma.ipo.create({ data: ipo });
        }
    }

    console.log('✅ Seeding complete.');

    // 2. Measure Performance
    const iterations = 100;
    console.log(`⏱️  Running getIPOCounts ${iterations} times...`);
    const start = Date.now();
    for (let i = 0; i < iterations; i++) {
        await getIPOCounts();
    }
    const end = Date.now();
    const duration = end - start;
    const average = duration / iterations;

    console.log(`📊 Total Time: ${duration.toFixed(2)}ms`);
    console.log(`📊 Average Time per call: ${average.toFixed(2)}ms`);

    // 3. Verification
    const counts = await getIPOCounts();
    console.log('🔍 counts:', JSON.stringify(counts, null, 2));

    // Cleanup
    await prisma.ipo.deleteMany({});
    await prisma.$disconnect();
}

benchmark().catch(console.error);
