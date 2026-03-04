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
function compute(priceM, trendM, momentumM, liquidityM, relativeM, fundM) {
    const patterns = {
        postBonusAdjustment: false,
        volumeBreakout: false,
        bullishMomentum: false,
        bearishMomentum: false,
        overbought: false,
        oversold: false,
        trendReversal: false,
        highLiquidity: false,
        lowLiquidity: false,
        nearHigh52w: false,
        nearLow52w: false,
        sectorOutperformer: false,
        sectorUnderperformer: false
    };

    // Post-bonus adjustment detection
    patterns.postBonusAdjustment = isPostBonusAdjustment(priceM, fundM, liquidityM);

    // Volume breakout
    patterns.volumeBreakout = !!(liquidityM?.isVolumeSpike && (priceM?.consecutiveUp >= 2 || (trendM?.trend === 'bullish')));

    // Momentum patterns (suppress bearish if post-bonus)
    if (!patterns.postBonusAdjustment) {
        patterns.bullishMomentum = !!(
            trendM?.trend === 'bullish' &&
            momentumM?.rsi14 != null && momentumM.rsi14 > 50 &&
            momentumM.rsi14 < 70
        );
        patterns.bearishMomentum = !!(
            trendM?.trend === 'bearish' &&
            momentumM?.rsi14 != null && momentumM.rsi14 < 50 &&
            momentumM.rsi14 > 30
        );
    } else {
        // Post-bonus: only allow bullish if clearly positive momentum
        patterns.bullishMomentum = !!(momentumM?.roc10d > 5 && momentumM?.rsi14 > 55);
    }

    // RSI zones
    patterns.overbought = momentumM?.rsiZone === 'overbought';
    patterns.oversold = momentumM?.rsiZone === 'oversold';

    // Trend reversal
    patterns.trendReversal = !!(trendM?.goldenCross || trendM?.deathCross);

    // Liquidity
    patterns.highLiquidity = (liquidityM?.liquidityScore || 0) >= 70;
    patterns.lowLiquidity = (liquidityM?.liquidityScore || 0) <= 20;

    // Near 52w extremes (within 5%)
    // Suppress both when high === low (insufficient history — only 1 data point)
    const has52wRange = priceM?.high52w != null && priceM?.low52w != null && priceM.high52w !== priceM.low52w;
    if (has52wRange && priceM?.distFromHigh52w != null) {
        patterns.nearHigh52w = Math.abs(priceM.distFromHigh52w) <= 5;
    }
    if (has52wRange && priceM?.distFromLow52w != null) {
        patterns.nearLow52w = priceM.distFromLow52w <= 5;
    }

    // Sector performance
    if (relativeM?.vsSectorAvg != null) {
        patterns.sectorOutperformer = relativeM.vsSectorAvg > 2;  // >2% above sector avg
        patterns.sectorUnderperformer = relativeM.vsSectorAvg < -2; // >2% below sector avg
    }

    return patterns;
}

/**
 * Build signal badges from patterns and metrics
 * @param {Object} patterns - From patterns.compute()
 * @param {Object} priceM - priceMetrics
 * @param {Object} trendM - trendMetrics
 * @param {Object} momentumM - momentumMetrics
 * @param {Object} liquidityM - liquidityMetrics
 * @returns {Array<Object>} signals: [{type, label, sentiment}]
 */
function buildSignals(patterns, priceM, trendM, momentumM, liquidityM) {
    const signals = [];

    // Circuit signals
    if (priceM?.atCircuitHigh) {
        signals.push({ type: 'circuit', label: 'Upper Circuit', sentiment: 'bullish' });
    }
    if (priceM?.atCircuitLow) {
        signals.push({ type: 'circuit', label: 'Lower Circuit', sentiment: 'bearish' });
    }

    // Cross signals
    if (trendM?.goldenCross) {
        signals.push({ type: 'cross', label: 'Golden Cross', sentiment: 'bullish' });
    }
    if (trendM?.deathCross && !patterns.postBonusAdjustment) {
        signals.push({ type: 'cross', label: 'Death Cross', sentiment: 'bearish' });
    }

    // RSI signals
    if (patterns.overbought) {
        signals.push({ type: 'rsi', label: 'Overbought (RSI)', sentiment: 'caution' });
    }
    if (patterns.oversold) {
        signals.push({ type: 'rsi', label: 'Oversold (RSI)', sentiment: 'opportunity' });
    }

    // Volume spike
    if (liquidityM?.isVolumeSpike) {
        signals.push({ type: 'volume', label: 'Volume Spike', sentiment: 'info' });
    }

    // Streak signals
    if (priceM?.consecutiveUp >= 3) {
        signals.push({ type: 'streak', label: `${priceM.consecutiveUp}-Day Rally`, sentiment: 'bullish' });
    }
    if (priceM?.consecutiveDown >= 3 && !patterns.postBonusAdjustment) {
        signals.push({ type: 'streak', label: `${priceM.consecutiveDown}-Day Decline`, sentiment: 'bearish' });
    }

    // 52-week proximity
    if (patterns.nearHigh52w) {
        signals.push({ type: '52w', label: 'Near 52W High', sentiment: 'info' });
    }
    if (patterns.nearLow52w) {
        signals.push({ type: '52w', label: 'Near 52W Low', sentiment: 'caution' });
    }

    // Volume breakout
    if (patterns.volumeBreakout) {
        signals.push({ type: 'breakout', label: 'Volume Breakout', sentiment: 'bullish' });
    }

    // Post-bonus note
    if (patterns.postBonusAdjustment) {
        signals.push({ type: 'adjustment', label: 'Post-Bonus Adjusted', sentiment: 'info' });
    }

    // Sector performance
    if (patterns.sectorOutperformer) {
        signals.push({ type: 'sector', label: 'Sector Outperformer', sentiment: 'bullish' });
    }
    if (patterns.sectorUnderperformer && !patterns.postBonusAdjustment) {
        signals.push({ type: 'sector', label: 'Sector Underperformer', sentiment: 'bearish' });
    }

    return signals;
}

module.exports = { compute, buildSignals, isPostBonusAdjustment };
