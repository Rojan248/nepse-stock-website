const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
    try {
        const all = await p.aIOverview.findMany({
            select: { symbol: true, narrative: true, modelVersion: true }
        });

        let badCount = 0;
        for (const o of all) {
            const full = typeof o.narrative === 'string' ? o.narrative : JSON.stringify(o.narrative);
            const issues = [];

            // Check for raw large numbers (6+ digits without comma/lakh/crore formatting)
            const rawNums = full.match(/\d{6,}/g);
            if (rawNums) issues.push(`raw numbers: ${rawNums.join(', ')}`);

            // Check for Rs instead of NPR
            if (full.includes('Rs ') || full.includes('Rs.')) issues.push('uses Rs');

            // Check for jargon
            const jargon = ['bullish', 'bearish', 'resistance', 'support', 'consolidation', 'overbought', 'oversold'];
            const found = jargon.filter(j => full.toLowerCase().includes(j));
            if (found.length) issues.push(`jargon: ${found.join(', ')}`);

            if (issues.length > 0) {
                badCount++;
                console.log(`${o.symbol} (${o.modelVersion}): ${issues.join(' | ')}`);
            }
        }

        console.log(`\n${badCount} problematic overviews out of ${all.length} total`);
    } catch (err) {
        console.error('Error checking overviews:', err);
        process.exit(1);
    } finally {
        await p.$disconnect();
        process.exit(0);
    }
})();
