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
    const has52wRange = priceM?.high52w != null && priceM?.low52w != null && priceM.high52w !== priceM.low52w;
    return {
        nearHigh52w: Boolean(has52wRange && priceM?.distFromHigh52w != null && Math.abs(priceM.distFromHigh52w) <= 5),
        nearLow52w: Boolean(has52wRange && priceM?.distFromLow52w != null && priceM.distFromLow52w <= 5)
    };
}

function computeMomentumPatterns(trendM, momentumM, postBonusAdjustment) {
    let bullishMomentum = false;
    let bearishMomentum = false;

    if (!postBonusAdjustment) {
        bullishMomentum = !!(
            trendM?.trend === 'bullish' &&
            momentumM?.rsi14 != null && momentumM.rsi14 > 50 &&
            momentumM.rsi14 < 70
        );
        bearishMomentum = !!(
            trendM?.trend === 'bearish' &&
            momentumM?.rsi14 != null && momentumM.rsi14 < 50 &&
            momentumM.rsi14 > 30
        );
    } else {
        bullishMomentum = !!(momentumM?.roc10d > 5 && momentumM?.rsi14 > 55);
    }

    return { bullishMomentum, bearishMomentum };
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

/**
 * Compute pattern flags from all metrics
 * @param {Object} metrics - Combined metrics object
 * @returns {Object} patterns
 */
function compute({ priceM, trendM, momentumM, liquidityM, relativeM, fundM }) {
    const postBonusAdjustment = isPostBonusAdjustment(priceM, fundM, liquidityM);
    
    return {
        postBonusAdjustment,
        volumeBreakout: !!(liquidityM?.isVolumeSpike && (priceM?.consecutiveUp >= 2 || (trendM?.trend === 'bullish'))),
        ...computeMomentumPatterns(trendM, momentumM, postBonusAdjustment),
        overbought: momentumM?.rsiZone === 'overbought',
        oversold: momentumM?.rsiZone === 'oversold',
        trendReversal: !!(trendM?.goldenCross || trendM?.deathCross),
        ...computeLiquidityPatterns(liquidityM),
        ...computeExtremesPatterns(priceM),
        ...computeSectorPatterns(relativeM)
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
