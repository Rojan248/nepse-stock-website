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

/** Clamp a value between min and max */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Linearly map val from [inLo,inHi] to [outLo,outHi], clamped */
function mapRange({ val, inLo, inHi, outLo, outHi }) {
    if (val == null) return outLo;
    const t = clamp((val - inLo) / (inHi - inLo), 0, 1);
    return outLo + t * (outHi - outLo);
}

// ── Individual scoring functions ──────────────────────────────────────────────

/**
 * Trend score (0-20): MA alignment and trend direction
 */
function scoreTrend(trend) {
    if (!trend) return 5; // neutral default
    let s = 0;

    // Trend direction (0-10)
    if (trend.trend === 'bullish') s += 10;
    else if (trend.trend === 'neutral') s += 5;
    // bearish = 0

    // Price above MA20 (0-5)
    if (trend.priceVsMa20 != null) {
        s += mapRange({ val: trend.priceVsMa20, inLo: -5, inHi: 10, outLo: 0, outHi: 5 });
    } else {
        s += 2;
    }

    // Price above MA50 (0-3)
    if (trend.priceVsMa50 != null) {
        s += mapRange({ val: trend.priceVsMa50, inLo: -10, inHi: 15, outLo: 0, outHi: 3 });
    } else {
        s += 1;
    }

    // Golden cross bonus
    if (trend.goldenCross) s += 2;
    // Death cross penalty
    if (trend.deathCross) s -= 3;

    return clamp(s, 0, 20);
}

function getRsiScore(rsi14) {
    if (rsi14 == null) return 4;
    if (rsi14 > 75) return 3;
    if (rsi14 > 65) return 7; 
    if (rsi14 >= 40) return 10;
    if (rsi14 >= 30) return 6;
    return 2;
}

function getRocScore(mom) {
    let s = 0;
    s += mom.roc10d != null ? mapRange({ val: mom.roc10d, inLo: -5, inHi: 10, outLo: 0, outHi: 5 }) : 2;
    s += mom.roc30d != null ? mapRange({ val: mom.roc30d, inLo: -10, inHi: 15, outLo: 0, outHi: 5 }) : 2;
    return s;
}

/**
 * Momentum score (0-20): RSI in healthy range + positive ROC
 */
function scoreMomentum(mom) {
    if (!mom) return 5;
    const s = getRsiScore(mom.rsi14) + getRocScore(mom);
    return clamp(s, 0, 20);
}

function getDistanceScore(distFromHigh52w) {
    if (distFromHigh52w == null) return 4;
    const dist = Math.abs(distFromHigh52w);
    if (dist > 40) return 3;
    if (dist >= 10) return 8;
    if (dist >= 5) return 6;
    return 4;
}

function getStreakScore(price) {
    let s = 0;
    if (price.consecutiveUp >= 3) s += 3;
    else if (price.consecutiveUp >= 2) s += 2;
    else if (price.consecutiveUp >= 1) s += 1;
    if (price.consecutiveDown >= 3) s -= 3;
    return s;
}

/**
 * Price position score (0-15): room to grow based on 52w range
 */
function scorePricePosition(price) {
    if (!price) return 5;
    let s = getDistanceScore(price.distFromHigh52w) + getStreakScore(price);

    if (price.weeklyChange != null) {
        s += mapRange({ val: price.weeklyChange, inLo: -3, inHi: 8, outLo: 0, outHi: 4 });
    } else {
        s += 1;
    }

    return clamp(s, 0, 15);
}

/**
 * Liquidity score (0-15): higher trading activity = better
 */
function scoreLiquidity(liq) {
    if (!liq) return 5;
    let s = 0;

    // Liquidity score from the module (0-100 mapped to 0-10)
    if (liq.liquidityScore != null) {
        s += mapRange({ val: liq.liquidityScore, inLo: 0, inHi: 100, outLo: 0, outHi: 10 });
    } else {
        s += 3;
    }

    // Volume spike bonus (0-3)
    if (liq.isVolumeSpike) s += 3;

    // Average volume health (0-2)
    if (liq.avgVolume20d != null && liq.avgVolume20d > 5000) s += 2;
    else if (liq.avgVolume20d != null && liq.avgVolume20d > 1000) s += 1;

    return clamp(s, 0, 15);
}

/**
 * Sector outperformance score (0-10)
 */
function scoreSector(rel) {
    if (!rel) return 5;
    let s = 5; // neutral baseline

    if (rel.vsSectorAvg != null) {
        s += mapRange({ val: rel.vsSectorAvg, inLo: -5, inHi: 10, outLo: -3, outHi: 5 });
    }

    return clamp(s, 0, 10);
}

const PATTERN_WEIGHTS = {
    bullishMomentum: 2, bearishMomentum: -2, volumeBreakout: 2,
    overbought: -1, oversold: 1, sectorOutperformer: 1,
    sectorUnderperformer: -1, postBonusAdjustment: -2, lowLiquidity: -2
};

function getPatternModifiers(patterns) {
    if (!patterns) return 0;
    return Object.entries(PATTERN_WEIGHTS).reduce((sum, [key, weight]) => sum + (patterns[key] ? weight : 0), 0);
}

function getSignalModifiers(signals) {
    if (!signals || !Array.isArray(signals)) return 0;
    const bullishCount = signals.filter(s => s.sentiment === 'bullish').length;
    const bearishCount = signals.filter(s => s.sentiment === 'bearish').length;
    return Math.min(bullishCount, 2) - Math.min(bearishCount, 2);
}

/**
 * Signal patterns score (0-10): bullish patterns add, bearish subtract
 */
function scoreSignals(patterns, signals) {
    if (!patterns && !signals) return 5;
    const s = 5 + getPatternModifiers(patterns) + getSignalModifiers(signals);
    return clamp(s, 0, 10);
}

/**
 * Medium-term direction score (0-10): monthly change and price vs MA
 */
function scoreMediumTerm(price, trend) {
    let s = 5;

    // Monthly change (0-5 bonus or penalty)
    if (price?.monthlyChange != null) {
        s += mapRange({ val: price.monthlyChange, inLo: -10, inHi: 20, outLo: -3, outHi: 5 });
    }

    const p180 = trend?.priceVsMa180;
    if (p180 != null) {
        if (p180 > 0) s += 2;
        else if (p180 < -10) s -= 1;
    }

    return clamp(s, 0, 10);
}

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
