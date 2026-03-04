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

            {/* Data depth notice — show prominently at top when data is sparse */}
            {!hasAdvancedMetrics && dataDepth?.message && (
                <div className="metrics-panel__notice">
                    <Info size={14} />
                    <span>{dataDepth.message}. Advanced indicators (MA, RSI, 52W) will appear as data accumulates.</span>
                </div>
            )}

            {/* Signal Badges */}
            {signals && signals.length > 0 && (
                <SignalBadges signals={signals} />
            )}

            {/* Sector & Ranking — from relative metrics */}
            {rm && (rm.sectorRank != null || rm.marketRank != null) && (
                <div className="metrics-panel__section">
                    <h4 className="metrics-panel__section-title">
                        <Layers size={14} /> Sector & Ranking
                    </h4>
                    <div className="metrics-panel__grid">
                        {cd?.sector && <MetricItem label="Sector" value={cd.sector} />}
                        {rm.sectorRank != null && (
                            <MetricItem
                                label="Sector Rank"
                                value={`#${rm.sectorRank}`}
                                sub={rm.sectorTotal ? `of ${rm.sectorTotal}` : null}
                            />
                        )}
                        {rm.marketRank != null && (
                            <MetricItem
                                label="Market Rank"
                                value={`#${rm.marketRank}`}
                                sub={rm.marketTotal ? `of ${rm.marketTotal}` : null}
                            />
                        )}
                        {rm.vsSectorAvg != null && (
                            <MetricItem
                                label="vs Sector Avg"
                                value={`${rm.vsSectorAvg > 0 ? '+' : ''}${rm.vsSectorAvg.toFixed(2)}%`}
                                cls={rm.vsSectorAvg > 0 ? 'trend-bullish' : rm.vsSectorAvg < 0 ? 'trend-bearish' : ''}
                            />
                        )}
                    </div>
                </div>
            )}

            {/* Liquidity */}
            {lm && (lm.liquidityScore != null && lm.liquidityScore > 0) && (
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
                            <MetricItem
                                label="Vol Ratio"
                                value={`${lm.volumeRatio.toFixed(2)}x`}
                                cls={lm.isVolumeSpike ? 'spike' : ''}
                            />
                        )}
                        {lm.avgVolume20d != null && <MetricItem label="Avg Vol" value={formatLargeNumber(lm.avgVolume20d)} />}
                        {lm.tradingDays > 0 && <MetricItem label="Trading Days" value={lm.tradingDays} />}
                    </div>
                </div>
            )}

            {/* Moving Averages — only show when enough data */}
            {tm && (tm.ma20 || tm.ma50 || tm.ma180) && (
                <div className="metrics-panel__section">
                    <h4 className="metrics-panel__section-title">
                        <TrendingUp size={14} /> Moving Averages
                    </h4>
                    <div className="metrics-panel__grid">
                        {tm.ma20 && <MetricItem label="MA 20" value={fmt(tm.ma20)} sub={tm.priceVsMa20 != null ? `${tm.priceVsMa20 > 0 ? '+' : ''}${tm.priceVsMa20.toFixed(1)}%` : null} />}
                        {tm.ma50 && <MetricItem label="MA 50" value={fmt(tm.ma50)} sub={tm.priceVsMa50 != null ? `${tm.priceVsMa50 > 0 ? '+' : ''}${tm.priceVsMa50.toFixed(1)}%` : null} />}
                        {tm.ma180 && <MetricItem label="MA 180" value={fmt(tm.ma180)} sub={tm.priceVsMa180 != null ? `${tm.priceVsMa180 > 0 ? '+' : ''}${tm.priceVsMa180.toFixed(1)}%` : null} />}
                        {tm.trend && tm.trend !== 'neutral' && <MetricItem label="Trend" value={tm.trend} cls={`trend-${tm.trend}`} />}
                    </div>
                </div>
            )}

            {/* Momentum — only show when we have RSI data */}
            {mm && (mm.rsi14 != null || mm.roc10d != null) && (
                <div className="metrics-panel__section">
                    <h4 className="metrics-panel__section-title">
                        <TrendingDown size={14} /> Momentum
                    </h4>
                    <div className="metrics-panel__grid">
                        {mm.rsi14 != null && (
                            <MetricItem
                                label="RSI (14)"
                                value={mm.rsi14.toFixed(1)}
                                cls={mm.rsiZone === 'overbought' ? 'overbought' : mm.rsiZone === 'oversold' ? 'oversold' : ''}
                            />
                        )}
                        {mm.rsi7 != null && <MetricItem label="RSI (7)" value={mm.rsi7.toFixed(1)} />}
                        {mm.roc10d != null && <MetricItem label="ROC 10d" value={`${mm.roc10d > 0 ? '+' : ''}${mm.roc10d.toFixed(2)}%`} />}
                        {mm.roc30d != null && <MetricItem label="ROC 30d" value={`${mm.roc30d > 0 ? '+' : ''}${mm.roc30d.toFixed(2)}%`} />}
                    </div>
                </div>
            )}

            {/* 52-Week Range */}
            {pm && (pm.high52w || pm.low52w) && (
                <div className="metrics-panel__section">
                    <h4 className="metrics-panel__section-title">52-Week Range</h4>
                    <div className="metrics-panel__grid">
                        {pm.high52w && <MetricItem label="52W High" value={fmt(pm.high52w)} cls="high" />}
                        {pm.low52w && <MetricItem label="52W Low" value={fmt(pm.low52w)} cls="low" />}
                        {pm.weeklyChange != null && <MetricItem label="Week Δ" value={`${pm.weeklyChange > 0 ? '+' : ''}${pm.weeklyChange.toFixed(2)}%`} />}
                        {pm.monthlyChange != null && <MetricItem label="Month Δ" value={`${pm.monthlyChange > 0 ? '+' : ''}${pm.monthlyChange.toFixed(2)}%`} />}
                    </div>
                </div>
            )}

            <div className="metrics-panel__footer">
                <Clock size={12} />
                {' '}Updated {cd?.updatedAt ? new Date(cd.updatedAt).toLocaleString() : 'recently'}
                {dataDepth?.historicalDays > 0 && ` · ${dataDepth.historicalDays} day${dataDepth.historicalDays > 1 ? 's' : ''} tracked`}
            </div>
        </section>
    );
}

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

export default MetricsPanel;
