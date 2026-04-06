/**
 * Market Scoring
 */
const { clamp, mapRange } = require('./scorerUtils');

function getDistanceScore(distFromHigh52w) {
    if (distFromHigh52w == null) return 4;
    const dist = Math.abs(distFromHigh52w);
    if (dist > 40) return 3;
    if (dist >= 10) return 8;
    if (dist >= 5) return 6;
    return 4;
}

function getStreakScore(price) {
    let s = Math.min(price.consecutiveUp || 0, 3);
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

function getVolumeHealthScore(avgVolume20d) {
    if (avgVolume20d == null) return 0;
    if (avgVolume20d > 5000) return 2;
    if (avgVolume20d > 1000) return 1;
    return 0;
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
    s += getVolumeHealthScore(liq.avgVolume20d);

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

module.exports = {
    scorePricePosition,
    scoreLiquidity,
    scoreSector,
    scoreSignals
};
