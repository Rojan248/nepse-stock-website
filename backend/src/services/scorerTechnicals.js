/**
 * Technical Scoring
 */
const { clamp, mapRange } = require('./scorerUtils');

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

module.exports = {
    scoreTrend,
    scoreMomentum,
    scoreMediumTerm
};
