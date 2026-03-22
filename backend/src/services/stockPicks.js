/**
 * Stock Picks Service
 * Scores stocks 0–100 using pre-computed metrics to surface the most promising picks.
 *
 * Scoring factors (total = 100):
 *   Trend (MA alignment)          20 pts
 *   Momentum (RSI + ROC)          20 pts
 *   Price position (52w range)    15 pts
 *   Liquidity / Volume            15 pts
 *   Sector outperformance         10 pts
 *   Signal patterns               10 pts
 *   Medium-term direction         10 pts
 *
 * The service reads StockMetrics and Stock tables, so it runs instantly
 * without any external API calls.
 */

const { prisma } = require('./database/connection');
const logger = require('./utils/logger');
const { buildReasons } = require('./stockPickReasons');

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeJSON(str) {
    if (!str) return null;
    try { return JSON.parse(str); } catch { return null; }
}

const {
    clamp, scoreTrend, scoreMomentum, scorePricePosition,
    scoreLiquidity, scoreSector, scoreSignals, scoreMediumTerm
} = require('./stockPickScorer');

// ── Main Scoring ──────────────────────────────────────────────────────────────

/**
 * Score a single stock using its pre-computed metrics
 */
function scoreStock(stock, metrics) {
    const trend = safeJSON(metrics.trendMetrics);
    const mom = safeJSON(metrics.momentumMetrics);
    const price = safeJSON(metrics.priceMetrics);
    const liq = safeJSON(metrics.liquidityMetrics);
    const rel = safeJSON(metrics.relativeMetrics);
    const pats = safeJSON(metrics.patterns);
    const sigs = safeJSON(metrics.signals);

    const trendScore = scoreTrend(trend);
    const momentumScore = scoreMomentum(mom);
    const priceScore = scorePricePosition(price);
    const liqScore = scoreLiquidity(liq);
    const sectorScore = scoreSector(rel);
    const signalScore = scoreSignals(pats, sigs);
    const medTermScore = scoreMediumTerm(price, trend);

    const totalScore = Math.round(
        trendScore + momentumScore + priceScore +
        liqScore + sectorScore + signalScore + medTermScore
    );

    const reasons = buildReasons(stock, { trend, mom, price, liq, rel, patterns: pats });

    return {
        score: clamp(totalScore, 0, 100),
        breakdown: {
            trend: trendScore,
            momentum: momentumScore,
            pricePosition: priceScore,
            liquidity: liqScore,
            sector: sectorScore,
            signals: signalScore,
            mediumTerm: medTermScore
        },
        reasons
    };
}

/**
 * Get top stock picks based on pre-computed metrics
 * @param {number} limit - Number of picks to return (default 10)
 * @returns {Array} Sorted list of top picks
 */
async function getTopPicks(limit = 10) {
    try {
        // Get all stocks with valid price
        const allStocks = await prisma.stock.findMany({
            where: { lastTradedPrice: { gt: 0 } },
            select: {
                symbol: true,
                companyName: true,
                sector: true,
                lastTradedPrice: true,
                previousClose: true,
                change: true,
                percentageChange: true,
                volume: true,
                turnover: true,
                highPrice: true,
                lowPrice: true
            }
        });

        // Get latest metrics for all stocks
        const allMetrics = await prisma.stockMetrics.findMany({
            orderBy: { date: 'desc' },
            distinct: ['symbol']
        });

        const metricsMap = new Map(allMetrics.map(m => [m.symbol, m]));

        // Score each stock
        const scored = [];
        for (const stock of allStocks) {
            const metrics = metricsMap.get(stock.symbol);
            if (!metrics) continue; // skip stocks without computed metrics

            const result = scoreStock(stock, metrics);

            scored.push({
                symbol: stock.symbol,
                companyName: stock.companyName,
                sector: stock.sector,
                ltp: stock.lastTradedPrice,
                change: stock.change,
                changePercent: stock.percentageChange,
                volume: stock.volume,
                high: stock.highPrice,
                low: stock.lowPrice,
                score: result.score,
                scoreBreakdown: result.breakdown,
                reasons: result.reasons
            });
        }

        // Sort by score descending, take top N
        scored.sort((a, b) => b.score - a.score);

        return scored.slice(0, limit);
    } catch (error) {
        logger.error(`Stock picks computation failed: ${error.message}`);
        return [];
    }
}

module.exports = { getTopPicks, scoreStock };
