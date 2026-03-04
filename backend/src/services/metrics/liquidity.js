/**
 * Liquidity Module
 * Computes trading days count, liquidity score, volume ratios,
 * turnover ratios, and volume spike detection
 */

const VOLUME_SPIKE_THRESHOLD = 2.5; // 2.5x average = spike

/**
 * Compute liquidity metrics
 * @param {Array} history - MarketHistory records sorted by date DESC
 * @param {Object} currentStock - Current stock data
 * @returns {Object} liquidityMetrics
 */
function compute(history, currentStock) {
    const result = {
        tradingDays: 0,
        avgVolume20d: null,
        avgVolume50d: null,
        volumeRatio: null,      // today's volume / avgVolume20d
        turnoverRatio: null,    // today's turnover / avg turnover 20d
        liquidityScore: 0,      // 0-100 composite score
        isVolumeSpike: false,   // volume > 2.5x average
        avgTurnover20d: null
    };

    if (!history || history.length === 0) return result;

    // Count actual trading days (volume > 0)
    const tradingDays = history.filter(h => h.volume != null && h.volume > 0);
    result.tradingDays = tradingDays.length;

    if (tradingDays.length === 0) return result;

    // Average volumes — fall back to MeroLagani 30-day avg when local history is short
    const volumes20 = tradingDays.slice(0, 20).map(h => h.volume);
    const volumes50 = tradingDays.slice(0, 50).map(h => h.volume);

    if (volumes20.length > 0) {
        result.avgVolume20d = volumes20.reduce((a, b) => a + b, 0) / volumes20.length;
    }
    if (volumes50.length > 0) {
        result.avgVolume50d = volumes50.reduce((a, b) => a + b, 0) / volumes50.length;
    }

    // If we have fewer than 10 days of local data, the computed averages are unreliable.
    // Use the MeroLagani 30-day avg volume as a more accurate baseline.
    const ext30d = currentStock?.avgVol30dExt;
    if (ext30d && tradingDays.length < 10) {
        result.avgVolume20d = ext30d;  // 30-day avg is close enough to 20-day avg
        result.avgVolume50d = result.avgVolume50d || ext30d;
        result.sourceVolume = 'merolagani';
    }

    // Average turnover
    const turnovers20 = tradingDays.slice(0, 20)
        .map(h => h.turnover)
        .filter(t => t != null && t > 0);
    if (turnovers20.length > 0) {
        result.avgTurnover20d = turnovers20.reduce((a, b) => a + b, 0) / turnovers20.length;
    }

    // Volume ratio (today vs 20d average)
    const todayVolume = currentStock?.volume;
    if (todayVolume && result.avgVolume20d && result.avgVolume20d > 0) {
        result.volumeRatio = todayVolume / result.avgVolume20d;
        result.isVolumeSpike = result.volumeRatio >= VOLUME_SPIKE_THRESHOLD;
    }

    // Turnover ratio
    const todayTurnover = currentStock?.turnover;
    if (todayTurnover && result.avgTurnover20d && result.avgTurnover20d > 0) {
        result.turnoverRatio = todayTurnover / result.avgTurnover20d;
    }

    // Liquidity score (0-100)
    // Based on: trading frequency, volume consistency, turnover
    let score = 0;
    const maxDays = Math.min(history.length, 235);
    const tradingRatio = result.tradingDays / maxDays;
    score += tradingRatio * 40; // 40% weight on trading frequency

    if (result.avgVolume20d && result.avgVolume50d && result.avgVolume50d > 0) {
        // Volume consistency (20d vs 50d)
        const volConsistency = Math.min(result.avgVolume20d / result.avgVolume50d, 2);
        score += (volConsistency / 2) * 30; // 30% weight
    }

    if (result.avgTurnover20d) {
        // Turnover magnitude (log scale, capped)
        const turnoverLog = Math.min(Math.log10(result.avgTurnover20d + 1) / 8, 1);
        score += turnoverLog * 30; // 30% weight
    }

    result.liquidityScore = Math.round(Math.min(score, 100));

    return result;
}

module.exports = { compute };
