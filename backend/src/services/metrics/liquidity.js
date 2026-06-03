/**
 * Liquidity Module
 * Computes trading days count, liquidity score, volume ratios,
 * turnover ratios, and volume spike detection
 */

const VOLUME_SPIKE_THRESHOLD = 2.5; // 2.5x average = spike

const hasHistory = (history) => Array.isArray(history) && history.length > 0;

const getTradingDays = (history) => history.filter(h => h.volume != null && Number(h.volume) > 0);

const hasPositiveAverage = (value) => value > 0;

const hasCurrentValue = (value) => Boolean(value);

function calculateAverages(tradingDays, currentStock) {
    const averages = { avgVolume20d: null, avgVolume50d: null, avgTurnover20d: null, sourceVolume: null };

    const volumes20 = tradingDays.slice(0, 20).map(h => Number(h.volume));
    const volumes50 = tradingDays.slice(0, 50).map(h => Number(h.volume));

    if (volumes20.length > 0) averages.avgVolume20d = volumes20.reduce((a, b) => a + b, 0) / volumes20.length;
    if (volumes50.length > 0) averages.avgVolume50d = volumes50.reduce((a, b) => a + b, 0) / volumes50.length;

    const ext30d = currentStock?.avgVol30dExt;
    if (ext30d && tradingDays.length < 10) {
        averages.avgVolume20d = ext30d;
        averages.avgVolume50d = ext30d;
        averages.sourceVolume = 'merolagani';
    }

    const turnovers20 = tradingDays.slice(0, 20).map(h => h.turnover).filter(t => t != null && t > 0);
    if (turnovers20.length > 0) averages.avgTurnover20d = turnovers20.reduce((a, b) => a + b, 0) / turnovers20.length;

    return averages;
}

function calculateLiquidityScore(tradingDaysCount, maxDays, averages) {
    let score = 0;
    const tradingRatio = tradingDaysCount / maxDays;
    score += tradingRatio * 40;

    const has50dAvg = averages.avgVolume20d && averages.avgVolume50d && averages.avgVolume50d > 0;
    if (has50dAvg) {
        const volConsistency = Math.min(averages.avgVolume20d / averages.avgVolume50d, 2);
        score += (volConsistency / 2) * 30;
    }

    if (averages.avgTurnover20d) {
        const turnoverLog = Math.min(Math.log10(averages.avgTurnover20d + 1) / 8, 1);
        score += turnoverLog * 30;
    }

    return Math.round(Math.min(score, 100));
}

function applyVolumeMetrics(result, currentStock) {
    if (!hasCurrentValue(currentStock?.volume) || !hasPositiveAverage(result.avgVolume20d)) return;

    result.volumeRatio = currentStock.volume / result.avgVolume20d;
    result.isVolumeSpike = result.volumeRatio >= VOLUME_SPIKE_THRESHOLD;
}

function applyTurnoverMetrics(result, currentStock) {
    if (!hasCurrentValue(currentStock?.turnover) || !hasPositiveAverage(result.avgTurnover20d)) return;

    result.turnoverRatio = currentStock.turnover / result.avgTurnover20d;
}

const createResult = () => ({
    tradingDays: 0,
    avgVolume20d: null,
    avgVolume50d: null,
    volumeRatio: null,      // today's volume / avgVolume20d
    turnoverRatio: null,    // today's turnover / avg turnover 20d
    liquidityScore: 0,      // 0-100 composite score
    isVolumeSpike: false,   // volume > 2.5x average
    avgTurnover20d: null
});

/**
 * Compute liquidity metrics
 * @param {Array} history - MarketHistory records sorted by date DESC
 * @param {Object} currentStock - Current stock data
 * @returns {Object} liquidityMetrics
 */
function compute(history, currentStock) {
    const result = createResult();

    if (!hasHistory(history)) return result;

    // Count actual trading days (volume > 0)
    const tradingDays = getTradingDays(history);
    result.tradingDays = tradingDays.length;

    if (tradingDays.length === 0) return result;

    // Average volumes and turnover
    const averages = calculateAverages(tradingDays, currentStock);
    Object.assign(result, averages);

    applyVolumeMetrics(result, currentStock);
    applyTurnoverMetrics(result, currentStock);

    // Liquidity score (0-100)
    const maxDays = Math.min(history.length, 235);
    result.liquidityScore = calculateLiquidityScore(result.tradingDays, maxDays, averages);

    return result;
}

module.exports = { compute };
