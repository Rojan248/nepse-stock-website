/**
 * Stock Pick Reason Builders
 * Constructs human-readable reason strings from metrics data.
 * Extracted from stockPicks.js to reduce per-file complexity.
 */

// ── Trend reasons ─────────────────────────────────────────────────────────────

function appendTrendDirection(reasons, trend) {
    if (trend?.trend === 'bullish') reasons.push('Price is in an uptrend, trading above key averages');
    else if (trend?.trend === 'bearish') reasons.push('Price is trending below key averages');
}

function appendRsiReason(reasons, mom) {
    const rsi = mom?.rsi14;
    if (rsi == null) return;
    if (rsi > 70) reasons.push('Strong momentum, but may be overheated');
    else if (rsi >= 40) reasons.push('Healthy momentum — not too hot, not too cold');
    else if (rsi < 30) reasons.push('Significantly oversold — could be a recovery opportunity');
}

function appendTrendReasons(reasons, trend, mom) {
    appendTrendDirection(reasons, trend);
    appendRsiReason(reasons, mom);
}

// ── Price reasons ─────────────────────────────────────────────────────────────

function append52wReason(reasons, price) {
    const distRaw = price?.distFromHigh52w;
    if (distRaw == null) return;
    const dist = Math.abs(distRaw);
    if (dist >= 10 && dist <= 30) reasons.push(`About ${dist.toFixed(0)}% below its highest price this year — room to grow`);
    else if (dist < 5) reasons.push('Trading near its highest price this year');
}

function appendSectorReason(reasons, stock, rel) {
    const secAvg = rel?.vsSectorAvg;
    if (secAvg != null && secAvg > 2) {
        reasons.push(`Outperforming its ${stock.sector || ''} sector peers`);
    }
}

function appendMonthlyReason(reasons, price) {
    const monthChg = price?.monthlyChange;
    if (monthChg != null && monthChg > 5) {
        reasons.push(`Up ${monthChg.toFixed(1)}% over the past month`);
    }
}

function appendPriceReasons(reasons, stock, price, rel) {
    append52wReason(reasons, price);
    appendSectorReason(reasons, stock, rel);
    appendMonthlyReason(reasons, price);
}

// ── Activity reasons ──────────────────────────────────────────────────────────

function appendVolumeSpikeReason(reasons, liq) {
    if (liq?.isVolumeSpike) reasons.push('Saw a spike in trading volume today — increased interest');
}

function appendLiquidityReason(reasons, patterns) {
    if (patterns?.highLiquidity) reasons.push('Actively traded with good liquidity');
}

function appendPatternReason(reasons, patterns) {
    const isCross = patterns?.goldenCross || patterns?.volumeBreakout;
    if (isCross) reasons.push('Showing positive technical patterns');
}

function appendStreakReason(reasons, price) {
    const upStreak = price?.consecutiveUp;
    if (upStreak >= 3) reasons.push(`On a ${upStreak}-day winning streak`);
}

function appendActivityReasons(reasons, liq, patterns, price) {
    appendVolumeSpikeReason(reasons, liq);
    appendLiquidityReason(reasons, patterns);
    appendPatternReason(reasons, patterns);
    appendStreakReason(reasons, price);
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

function buildReasons(stock, { trend, mom, price, liq, rel, patterns }) {
    const reasons = [];
    appendTrendReasons(reasons, trend, mom);
    appendPriceReasons(reasons, stock, price, rel);
    appendActivityReasons(reasons, liq, patterns, price);

    if (mom?.roc10d != null && mom.roc10d > 3) reasons.push(`Price rose ${mom.roc10d.toFixed(1)}% over the last 10 days`);

    if (reasons.length === 0) reasons.push('Neutral outlook — no strong signals in either direction');
    return reasons.slice(0, 4);
}

module.exports = { buildReasons };
