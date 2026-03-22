import { useState, useEffect } from 'react';
import { getStockMetrics } from '../services/api';
import { Activity, Clock, Info } from 'lucide-react';
import SignalBadges from './SignalBadges';
import {
    SectorRankingSection,
    LiquiditySection,
    MovingAveragesSection,
    MomentumSection,
    WeekRangeSection,
} from './MetricsSections';
import './MetricsPanel.css';

/**
 * Metrics Panel
 * Orchestrates current-day trading data and advanced technical metrics.
 * Section components live in MetricsSections.jsx to limit per-file CC.
 */

function formatFooterDate(updatedAt) {
    if (!updatedAt) return 'recently';
    return new Date(updatedAt).toLocaleString();
}

function formatTrackedDays(days) {
    if (!days || days <= 0) return '';
    return ` · ${days} day${days > 1 ? 's' : ''} tracked`;
}

function MetricsPanelLoading() {
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

    if (loading) return <MetricsPanelLoading />;
    if (!metrics) return null;

    const cd = metrics.currentDay;
    const { priceMetrics: pm, trendMetrics: tm, momentumMetrics: mm, liquidityMetrics: lm, relativeMetrics: rm, signals, dataDepth } = metrics;

    const hasAdvanced = Boolean((tm && (tm.ma20 || tm.ma50)) || (mm && mm.rsi14 != null));
    const histDays = dataDepth?.historicalDays || 0;
    const showNotice = !hasAdvanced && Boolean(dataDepth?.message);
    const showSignals = Boolean(signals && signals.length > 0);

    return (
        <section className="metrics-panel sdp-animate-fade-in">
            <h3 className="metrics-panel__title">
                <Activity size={16} /> Stock Analytics
            </h3>

            {showNotice && (
                <div className="metrics-panel__notice">
                    <Info size={14} />
                    <span>{dataDepth.message}. Advanced indicators (MA, RSI, 52W) will appear as data accumulates.</span>
                </div>
            )}

            {showSignals && <SignalBadges signals={signals} />}

            <SectorRankingSection rm={rm} sector={cd?.sector} />
            <LiquiditySection lm={lm} hasEnoughForLiquidity={histDays >= 5} />
            <MovingAveragesSection tm={tm} />
            <MomentumSection mm={mm} />
            <WeekRangeSection pm={pm} />

            <div className="metrics-panel__footer">
                <Clock size={12} />
                {' '}Updated {formatFooterDate(cd?.updatedAt)}
                {formatTrackedDays(histDays)}
            </div>
        </section>
    );
}

export default MetricsPanel;
