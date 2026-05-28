/**
 * Patterns Module
 * Builds composite flags/patterns from all computed metrics
 * Detects post-bonus adjustment, divergences, and signal patterns
 */

/**
 * Detect if stock may be in post-bonus adjustment
 * (price dropped significantly from base but volume is normal — not bearish)
 * @param {Object} priceMetrics - From priceMetrics.compute()
 * @param {Object} fundamentals - From fundamentals.compute()
 * @param {Object} liquidityMetrics - From liquidity.compute()
 * @returns {boolean}
 */
function isPostBonusAdjustment(priceMetrics, fundamentals, liquidityMetrics) {
    if (!fundamentals?.basePrice || !fundamentals?.priceToBase) return false;
    // If price is less than 60% of base (likely bonus/rights adjusted)
    // and liquidity is normal, it's probably post-bonus
    return fundamentals.priceToBase < 0.6 && (liquidityMetrics?.liquidityScore || 0) > 20;
}

/**
 * Compute pattern flags from all metrics
 * @param {Object} priceM - priceMetrics
 * @param {Object} trendM - trendMetrics (moving averages)
 * @param {Object} momentumM - momentumMetrics
 * @param {Object} liquidityM - liquidityMetrics
 * @param {Object} relativeM - relativeMetrics
 * @param {Object} fundM - fundamentals
 * @returns {Object} patterns
 */
function computeExtremesPatterns(priceM) {
    if (!priceM) return { nearHigh52w: false, nearLow52w: false };

    const hasHigh = priceM.high52w != null;
    const hasLow = priceM.low52w != null;
    const hasRange = hasHigh && hasLow && priceM.high52w !== priceM.low52w;

    if (!hasRange) return { nearHigh52w: false, nearLow52w: false };

    const distHigh = priceM.distFromHigh52w != null ? Math.abs(priceM.distFromHigh52w) : 100;
    const distLow = priceM.distFromLow52w != null ? priceM.distFromLow52w : 100;

    return {
        nearHigh52w: distHigh <= 5,
        nearLow52w: distLow <= 5
    };
}

function computeBullishMomentum(trendM, momentumM) {
    if (trendM?.trend !== 'bullish') return false;
    if (momentumM?.rsi14 == null) return false;
    return momentumM.rsi14 > 50 && momentumM.rsi14 < 70;
}

function computeBearishMomentum(trendM, momentumM) {
    if (trendM?.trend !== 'bearish') return false;
    if (momentumM?.rsi14 == null) return false;
    return momentumM.rsi14 < 50 && momentumM.rsi14 > 30;
}

function computeMomentumPatterns(trendM, momentumM, postBonusAdjustment) {
    if (postBonusAdjustment) {
        const rocGood = momentumM?.roc10d > 5;
        const rsiGood = momentumM?.rsi14 > 55;
        return { bullishMomentum: rocGood && rsiGood, bearishMomentum: false };
    }

    return {
        bullishMomentum: computeBullishMomentum(trendM, momentumM),
        bearishMomentum: computeBearishMomentum(trendM, momentumM)
    };
}

function computeLiquidityPatterns(liquidityM) {
    const score = liquidityM?.liquidityScore || 0;
    return {
        highLiquidity: score >= 70,
        lowLiquidity: score <= 20
    };
}

function computeSectorPatterns(relativeM) {
    const vsSectorAvg = relativeM?.vsSectorAvg;
    return {
        sectorOutperformer: vsSectorAvg != null ? vsSectorAvg > 2 : false,
        sectorUnderperformer: vsSectorAvg != null ? vsSectorAvg < -2 : false
    };
}

function isVolumeBreakout(liquidityM, priceM, trendM) {
    if (!liquidityM?.isVolumeSpike) return false;
    const priceUp = priceM?.consecutiveUp >= 2;
    const trendBullish = trendM?.trend === 'bullish';
    return priceUp || trendBullish;
}

/**
 * Compute pattern flags from all metrics
 * @param {Object} metrics - Combined metrics object
 * @returns {Object} patterns
 */
function compute({ priceM, trendM, momentumM, liquidityM, relativeM, fundM }) {
    const postBonusAdjustment = isPostBonusAdjustment(priceM, fundM, liquidityM);
    const momentumPatterns = computeMomentumPatterns(trendM, momentumM, postBonusAdjustment);
    const liquidityPatterns = computeLiquidityPatterns(liquidityM);
    const extremesPatterns = computeExtremesPatterns(priceM);
    const sectorPatterns = computeSectorPatterns(relativeM);

    return {
        postBonusAdjustment,
        volumeBreakout: isVolumeBreakout(liquidityM, priceM, trendM),
        ...momentumPatterns,
        overbought: momentumM?.rsiZone === 'overbought',
        oversold: momentumM?.rsiZone === 'oversold',
        trendReversal: Boolean(trendM?.goldenCross || trendM?.deathCross),
        ...liquidityPatterns,
        ...extremesPatterns,
        ...sectorPatterns
    };
}

/**
 * Data-driven signal rules.
 * Each rule: { condition(ctx) => boolean, signal: {...} | signalFn(ctx) => {...} }
 * Eliminates per-signal if-statements in favour of a declarative filter+map.
 */
const SIGNAL_RULES = [
    // Circuit signals
    { condition: ({ priceM }) => priceM?.atCircuitHigh, signal: { type: 'circuit', label: 'Upper Circuit', sentiment: 'bullish' } },
    { condition: ({ priceM }) => priceM?.atCircuitLow,  signal: { type: 'circuit', label: 'Lower Circuit', sentiment: 'bearish' } },
    // Cross signals
    { condition: ({ trendM }) => trendM?.goldenCross, signal: { type: 'cross', label: 'Golden Cross', sentiment: 'bullish' } },
    { condition: ({ trendM, pat }) => trendM?.deathCross && !pat.postBonusAdjustment, signal: { type: 'cross', label: 'Death Cross', sentiment: 'bearish' } },
    // RSI zones
    { condition: ({ pat }) => pat.overbought, signal: { type: 'rsi', label: 'Overbought (RSI)', sentiment: 'caution' } },
    { condition: ({ pat }) => pat.oversold,   signal: { type: 'rsi', label: 'Oversold (RSI)', sentiment: 'opportunity' } },
    // Volume spike
    { condition: ({ liquidityM }) => liquidityM?.isVolumeSpike, signal: { type: 'volume', label: 'Volume Spike', sentiment: 'info' } },
    // Streak signals (dynamic labels)
    { condition: ({ priceM }) => priceM?.consecutiveUp >= 3,  signalFn: ({ priceM }) => ({ type: 'streak', label: `${priceM.consecutiveUp}-Day Rally`, sentiment: 'bullish' }) },
    { condition: ({ priceM, pat }) => priceM?.consecutiveDown >= 3 && !pat.postBonusAdjustment, signalFn: ({ priceM }) => ({ type: 'streak', label: `${priceM.consecutiveDown}-Day Decline`, sentiment: 'bearish' }) },
    // 52-week proximity
    { condition: ({ pat }) => pat.nearHigh52w, signal: { type: '52w', label: 'Near 52W High', sentiment: 'info' } },
    { condition: ({ pat }) => pat.nearLow52w,  signal: { type: '52w', label: 'Near 52W Low', sentiment: 'caution' } },
    // Volume breakout
    { condition: ({ pat }) => pat.volumeBreakout, signal: { type: 'breakout', label: 'Volume Breakout', sentiment: 'bullish' } },
    // Post-bonus note
    { condition: ({ pat }) => pat.postBonusAdjustment, signal: { type: 'adjustment', label: 'Post-Bonus Adjusted', sentiment: 'info' } },
    // Sector performance
    { condition: ({ pat }) => pat.sectorOutperformer, signal: { type: 'sector', label: 'Sector Outperformer', sentiment: 'bullish' } },
    { condition: ({ pat }) => pat.sectorUnderperformer && !pat.postBonusAdjustment, signal: { type: 'sector', label: 'Sector Underperformer', sentiment: 'bearish' } },
];

/**
 * Build signal badges from patterns and metrics
 * @param {Object} metrics - Combined metrics object including computed patterns
 * @returns {Array<Object>} signals: [{type, label, sentiment}]
 */
function buildSignals({ patternsM, priceM, trendM, momentumM, liquidityM }) {
    const ctx = { pat: patternsM, priceM, trendM, momentumM, liquidityM };
    return SIGNAL_RULES
        .filter(rule => rule.condition(ctx))
        .map(rule => rule.signalFn ? rule.signalFn(ctx) : rule.signal);
}

module.exports = { compute, buildSignals, isPostBonusAdjustment };
