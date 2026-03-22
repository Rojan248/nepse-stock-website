/**
 * Stock Pick Scoring Utils
 * Pure functions to calculate individual factor scores
 */

/** Clamp a value between min and max */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Linearly map val from [inLo,inHi] to [outLo,outHi], clamped */
function mapRange({ val, inLo, inHi, outLo, outHi }) {
    if (val == null) return outLo;
    const t = clamp((val - inLo) / (inHi - inLo), 0, 1);
    return outLo + t * (outHi - outLo);
}

module.exports = {
    clamp,
    mapRange
};
