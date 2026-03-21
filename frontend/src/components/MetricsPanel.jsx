import { useState, useEffect } from 'react';
import { getStockMetrics } from '../services/api';
import { TrendingUp, TrendingDown, Activity, BarChart2, Layers, Clock, Info } from 'lucide-react';
import SignalBadges from './SignalBadges';
import './MetricsPanel.css';

/**
 * Metrics Panel
 * Shows current-day trading data prominently, plus advanced technical
 * metrics as historical data accumulates over time.
 */

// ==================== Metric Section Sub-Components ====================

function MetricItem({ label, value, sub, cls }) {
    return (
        <div className={`metrics-panel__item ${cls || ''}`}>
            <span className="metrics-panel__item-label">{label}</span>
            <span className="metrics-panel__item-value">{value}</span>
            {sub && <span className="metrics-panel__item-sub">{sub}</span>}
        </div>
    );
}

function fmt(n) {
    if (n == null) return '—';
    return typeof n === 'number' ? n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : n;
}

function formatLargeNumber(n) {
    if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
    return Math.round(n).toLocaleString();
}

/** Format a signed percent value, e.g. "+2.50%" or "-1.30%" */
const formatSignedPercent = (v, decimals = 2) =>
    v == null ? null : `${v > 0 ? '+' : ''}${v.toFixed(decimals)}%`;

/** Map a numeric value to a bullish/bearish CSS class */
const trendClass = (v) => v > 0 ? 'trend-bullish' : v < 0 ? 'trend-bearish' : '';

/** Format a price-vs-MA sub-label */
const maSubLabel = (pctValue) =>
    formatSignedPercent(pctValue, 1);

function SectorRankingSection({ rm, sector }) {
    if (!rm || (rm.sectorRank == null && rm.marketRank == null)) return null;
    return (
        <div className="metrics-panel__section">
            <h4 className="metrics-panel__section-title">
                <Layers size={14} /> Sector & Ranking
            </h4>
            <div className="metrics-panel__grid">
                {sector && <MetricItem label="Sector" value={sector} />}
                {rm.sectorRank != null && (
                    <MetricItem label="Sector Rank" value={`#${rm.sectorRank}`} sub={rm.sectorTotal ? `of ${rm.sectorTotal}` : null} />
                )}
                {rm.marketRank != null && (
                    <MetricItem label="Market Rank" value={`#${rm.marketRank}`} sub={rm.marketTotal ? `of ${rm.marketTotal}` : null} />
                )}
                {rm.vsSectorAvg != null && (
                    <MetricItem
                        label="vs Sector Avg"
                        value={formatSignedPercent(rm.vsSectorAvg)}
                        cls={trendClass(rm.vsSectorAvg)}
                    />
                )}
            </div>
        </div>
    );
}

function LiquiditySection({ lm, hasEnoughForLiquidity }) {
    if (!lm || lm.liquidityScore == null || lm.liquidityScore <= 0) return null;
    return (
        <div className="metrics-panel__section">
            <h4 className="metrics-panel__section-title">
                <BarChart2 size={14} /> Liquidity
            </h4>
            <div className="metrics-panel__grid">
                {hasEnoughForLiquidity
                    ? <MetricItem label="Liquidity Score" value={`${lm.liquidityScore}/100`} />
                    : <MetricItem label="Liquidity Score" value="N/A" sub="accumulating data" />
                }
                {hasEnoughForLiquidity && lm.volumeRatio != null && (
                    <MetricItem label="Vol Ratio" value={`${lm.volumeRatio.toFixed(2)}x`} cls={lm.isVolumeSpike ? 'spike' : ''} />
                )}
                {lm.avgVolume20d != null && <MetricItem label="Avg Vol" value={formatLargeNumber(lm.avgVolume20d)} />}
                {lm.tradingDays > 0 && <MetricItem label="Trading Days" value={lm.tradingDays} />}
            </div>
        </div>
    );
}

function MovingAveragesSection({ tm }) {
    if (!tm || (!tm.ma20 && !tm.ma50 && !tm.ma180)) return null;
    return (
        <div className="metrics-panel__section">
            <h4 className="metrics-panel__section-title">
                <TrendingUp size={14} /> Moving Averages
            </h4>
            <div className="metrics-panel__grid">
                {tm.ma20 && <MetricItem label="MA 20" value={fmt(tm.ma20)} sub={maSubLabel(tm.priceVsMa20)} />}
                {tm.ma50 && <MetricItem label="MA 50" value={fmt(tm.ma50)} sub={maSubLabel(tm.priceVsMa50)} />}
                {tm.ma180 && <MetricItem label="MA 180" value={fmt(tm.ma180)} sub={maSubLabel(tm.priceVsMa180)} />}
                {tm.trend && tm.trend !== 'neutral' && <MetricItem label="Trend" value={tm.trend} cls={`trend-${tm.trend}`} />}
            </div>
        </div>
    );
}

function MomentumSection({ mm }) {
    if (!mm || (mm.rsi14 == null && mm.roc10d == null)) return null;
    return (
        <div className="metrics-panel__section">
            <h4 className="metrics-panel__section-title">
                <TrendingDown size={14} /> Momentum
            </h4>
            <div className="metrics-panel__grid">
                {mm.rsi14 != null && (
                    <MetricItem label="RSI (14)" value={mm.rsi14.toFixed(1)}
                        cls={mm.rsiZone === 'overbought' ? 'overbought' : mm.rsiZone === 'oversold' ? 'oversold' : ''} />
                )}
                {mm.rsi7 != null && <MetricItem label="RSI (7)" value={mm.rsi7.toFixed(1)} />}
                {mm.roc10d != null && <MetricItem label="ROC 10d" value={formatSignedPercent(mm.roc10d)} />}
                {mm.roc30d != null && <MetricItem label="ROC 30d" value={formatSignedPercent(mm.roc30d)} />}
            </div>
        </div>
    );
}

function WeekRangeSection({ pm }) {
    if (!pm || (!pm.high52w && !pm.low52w)) return null;
    return (
        <div className="metrics-panel__section">
            <h4 className="metrics-panel__section-title">52-Week Range</h4>
            <div className="metrics-panel__grid">
                {pm.high52w && <MetricItem label="52W High" value={fmt(pm.high52w)} cls="high" />}
                {pm.low52w && <MetricItem label="52W Low" value={fmt(pm.low52w)} cls="low" />}
                {pm.weeklyChange != null && <MetricItem label="Week Δ" value={formatSignedPercent(pm.weeklyChange)} />}
                {pm.monthlyChange != null && <MetricItem label="Month Δ" value={formatSignedPercent(pm.monthlyChange)} />}
            </div>
        </div>
    );
}

// ==================== Main Component ====================
function MetricsPanel({ symbol }) {
    const [metrics, setMetrics] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!symbol) return;
        let cancelled = false;

        const fetchMetrics = async () => {
            setLoading(true);
            try {
                const data = await getStockMetrics(symbol);
                if (!cancelled) setMetrics(data);
            } catch {
                // Fail silently
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchMetrics();
        return () => { cancelled = true; };
    }, [symbol]);

    if (loading) {
        return (
            <section className="metrics-panel metrics-panel--loading">
                <h3 className="metrics-panel__title">
                    <Activity size={16} /> Stock Analytics
                </h3>
                <div className="metrics-panel__skeleton">
                    <div className="skeleton-line skeleton-line--full" />
                    <div className="skeleton-line skeleton-line--80" />
                    <div className="skeleton-line skeleton-line--60" />
                </div>
            </section>
        );
    }

    if (!metrics) return null;

    const cd = metrics.currentDay;
    const { priceMetrics: pm, trendMetrics: tm, momentumMetrics: mm, liquidityMetrics: lm, relativeMetrics: rm, signals, dataDepth } = metrics;

    const hasAdvancedMetrics = (tm && (tm.ma20 || tm.ma50)) || (mm && mm.rsi14 != null);
    const hasEnoughForLiquidity = (dataDepth?.historicalDays || 0) >= 5;

    return (
        <section className="metrics-panel sdp-animate-fade-in">
            <h3 className="metrics-panel__title">
                <Activity size={16} /> Stock Analytics
            </h3>

            {/* Data depth notice */}
            {!hasAdvancedMetrics && dataDepth?.message && (
                <div className="metrics-panel__notice">
                    <Info size={14} />
                    <span>{dataDepth.message}. Advanced indicators (MA, RSI, 52W) will appear as data accumulates.</span>
                </div>
            )}

            {/* Signal Badges */}
            {signals && signals.length > 0 && <SignalBadges signals={signals} />}

            {/* Sections — each handles its own null-guard */}
            <SectorRankingSection rm={rm} sector={cd?.sector} />
            <LiquiditySection lm={lm} hasEnoughForLiquidity={hasEnoughForLiquidity} />
            <MovingAveragesSection tm={tm} />
            <MomentumSection mm={mm} />
            <WeekRangeSection pm={pm} />

            <div className="metrics-panel__footer">
                <Clock size={12} />
                {' '}Updated {cd?.updatedAt ? new Date(cd.updatedAt).toLocaleString() : 'recently'}
                {dataDepth?.historicalDays > 0 && ` · ${dataDepth.historicalDays} day${dataDepth.historicalDays > 1 ? 's' : ''} tracked`}
            </div>
        </section>
    );
}

export default MetricsPanel;
