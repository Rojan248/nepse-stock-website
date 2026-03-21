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

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeJSON(str) {
    if (!str) return null;
    try { return JSON.parse(str); } catch { return null; }
}

/** Clamp a value between min and max */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Linearly map val from [inLo,inHi] to [outLo,outHi], clamped */
function mapRange(val, inLo, inHi, outLo, outHi) {
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
        s += mapRange(trend.priceVsMa20, -5, 10, 0, 5);
    } else {
        s += 2;
    }

    // Price above MA50 (0-3)
    if (trend.priceVsMa50 != null) {
        s += mapRange(trend.priceVsMa50, -10, 15, 0, 3);
    } else {
        s += 1;
    }

    // Golden cross bonus
    if (trend.goldenCross) s += 2;
    // Death cross penalty
    if (trend.deathCross) s -= 3;

    return clamp(s, 0, 20);
}

/**
 * Momentum score (0-20): RSI in healthy range + positive ROC
 */
function scoreMomentum(mom) {
    if (!mom) return 5;
    let s = 0;

    // RSI14 scoring — sweet spot is 40-65 (healthy momentum, not overbought)
    if (mom.rsi14 != null) {
        if (mom.rsi14 >= 40 && mom.rsi14 <= 65) s += 10;      // ideal zone
        else if (mom.rsi14 >= 30 && mom.rsi14 < 40) s += 6;    // recovering
        else if (mom.rsi14 > 65 && mom.rsi14 <= 75) s += 7;    // strong but watch
        else if (mom.rsi14 > 75) s += 3;                        // overbought risk
        else s += 2;                                             // oversold
    } else {
        s += 4;
    }

    // ROC 10-day (0-5)
    if (mom.roc10d != null) {
        s += mapRange(mom.roc10d, -5, 10, 0, 5);
    } else {
        s += 2;
    }

    // ROC 30-day (0-5)
    if (mom.roc30d != null) {
        s += mapRange(mom.roc30d, -10, 15, 0, 5);
    } else {
        s += 2;
    }

    return clamp(s, 0, 20);
}

/**
 * Price position score (0-15): room to grow based on 52w range
 * Stocks near 52w low get higher score (more upside), near high get less
 */
function scorePricePosition(price) {
    if (!price) return 5;
    let s = 0;

    // Distance from 52w high — closer to high means less room
    // We reward stocks that still have room to grow (10-40% below high)
    if (price.distFromHigh52w != null) {
        const dist = Math.abs(price.distFromHigh52w);
        if (dist >= 10 && dist <= 40) s += 8;       // sweet spot: room to grow
        else if (dist >= 5 && dist < 10) s += 6;     // near high, still some room
        else if (dist < 5) s += 4;                    // very near high
        else if (dist > 40) s += 3;                   // too far from high — may be falling
    } else {
        s += 4;
    }

    // Positive weekly change (0-4)
    if (price.weeklyChange != null) {
        s += mapRange(price.weeklyChange, -3, 8, 0, 4);
    } else {
        s += 1;
    }

    // Consecutive up days bonus (0-3)
    if (price.consecutiveUp >= 3) s += 3;
    else if (price.consecutiveUp >= 2) s += 2;
    else if (price.consecutiveUp >= 1) s += 1;

    // Consecutive down days penalty
    if (price.consecutiveDown >= 3) s -= 3;

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
        s += mapRange(liq.liquidityScore, 0, 100, 0, 10);
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
        s += mapRange(rel.vsSectorAvg, -5, 10, -3, 5);
    }

    return clamp(s, 0, 10);
}

/**
 * Signal patterns score (0-10): bullish patterns add, bearish subtract
 */
function scoreSignals(patterns, signals) {
    if (!patterns && !signals) return 5;
    let s = 5; // neutral baseline

    if (patterns) {
        if (patterns.bullishMomentum) s += 2;
        if (patterns.bearishMomentum) s -= 2;
        if (patterns.volumeBreakout) s += 2;
        if (patterns.overbought) s -= 1;
        if (patterns.oversold) s += 1;   // opportunity
        if (patterns.sectorOutperformer) s += 1;
        if (patterns.sectorUnderperformer) s -= 1;
        if (patterns.postBonusAdjustment) s -= 2; // uncertain price action
        if (patterns.lowLiquidity) s -= 2;
    }

    // Count bullish vs bearish signals
    if (signals && Array.isArray(signals)) {
        const bullishCount = signals.filter(s => s.sentiment === 'bullish').length;
        const bearishCount = signals.filter(s => s.sentiment === 'bearish').length;
        s += Math.min(bullishCount, 2); // cap bonus at +2
        s -= Math.min(bearishCount, 2); // cap penalty at -2
    }

    return clamp(s, 0, 10);
}

/**
 * Medium-term direction score (0-10): monthly change and price vs MA
 */
function scoreMediumTerm(price, trend) {
    let s = 5;

    // Monthly change (0-5 bonus or penalty)
    if (price?.monthlyChange != null) {
        s += mapRange(price.monthlyChange, -10, 20, -3, 5);
    }

    // Price above MA180 — long-term bullish signal
    if (trend?.priceVsMa180 != null && trend.priceVsMa180 > 0) {
        s += 2;
    } else if (trend?.priceVsMa180 != null && trend.priceVsMa180 < -10) {
        s -= 1;
    }

    return clamp(s, 0, 10);
}

// ── Reason Builder ────────────────────────────────────────────────────────────

function buildReasons(stock, trend, mom, price, liq, rel, patterns) {
    const reasons = [];

    // Trend
    if (trend?.trend === 'bullish') reasons.push('Price is in an uptrend, trading above key averages');
    else if (trend?.trend === 'bearish') reasons.push('Price is trending below key averages');

    // Momentum
    if (mom?.rsi14 != null) {
        if (mom.rsi14 >= 40 && mom.rsi14 <= 65) reasons.push('Healthy momentum — not too hot, not too cold');
        else if (mom.rsi14 > 70) reasons.push('Strong momentum, but may be overheated');
        else if (mom.rsi14 < 30) reasons.push('Significantly oversold — could be a recovery opportunity');
    }

    // ROC
    if (mom?.roc10d != null && mom.roc10d > 3) {
        reasons.push(`Price rose ${mom.roc10d.toFixed(1)}% over the last 10 days`);
    }

    // 52-week position
    if (price?.distFromHigh52w != null) {
        const dist = Math.abs(price.distFromHigh52w);
        if (dist >= 10 && dist <= 30) reasons.push(`About ${dist.toFixed(0)}% below its highest price this year — room to grow`);
        else if (dist < 5) reasons.push('Trading near its highest price this year');
    }

    // Volume
    if (liq?.isVolumeSpike) reasons.push('Saw a spike in trading volume today — increased interest');
    if (patterns?.highLiquidity) reasons.push('Actively traded with good liquidity');

    // Sector
    if (rel?.vsSectorAvg != null && rel.vsSectorAvg > 2) {
        reasons.push(`Outperforming its ${stock.sector || ''} sector peers`);
    }

    // Patterns
    if (patterns?.goldenCross || patterns?.volumeBreakout) reasons.push('Showing positive technical patterns');
    if (price?.consecutiveUp >= 3) reasons.push(`On a ${price.consecutiveUp}-day winning streak`);

    // Monthly momentum
    if (price?.monthlyChange != null && price.monthlyChange > 5) {
        reasons.push(`Up ${price.monthlyChange.toFixed(1)}% over the past month`);
    }

    // Fallback
    if (reasons.length === 0) reasons.push('Neutral outlook — no strong signals in either direction');

    return reasons.slice(0, 4); // max 4 reasons
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

    const reasons = buildReasons(stock, trend, mom, price, liq, rel, pats);

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
