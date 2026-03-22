/**
 * Stock Pick Scoring Logic
 * Re-exports pure functions to calculate individual factor scores (0-100 scale).
 * Extracted the heavy logic into domain-specific files to reduce per-file complexity.
 */

const { clamp } = require('./scorerUtils');
const { scoreTrend, scoreMomentum, scoreMediumTerm } = require('./scorerTechnicals');
const { scorePricePosition, scoreLiquidity, scoreSector, scoreSignals } = require('./scorerMarket');

module.exports = {
    clamp,
    scoreTrend,
    scoreMomentum,
    scorePricePosition,
    scoreLiquidity,
    scoreSector,
    scoreSignals,
    scoreMediumTerm
};
