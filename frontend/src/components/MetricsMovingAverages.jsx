import React from 'react';
import { TrendingUp } from 'lucide-react';
import { MetricItem, fmt, maSubLabel } from './MetricsUtils';

function TrendItem({ tm }) {
    const show = tm.trend && tm.trend !== 'neutral';
    if (!show) return null;
    return <MetricItem label="Trend" value={tm.trend} cls={`trend-${tm.trend}`} />;
}

export function MovingAveragesSection({ tm }) {
    if (!tm) return null;
    const hasAny = tm.ma20 || tm.ma50 || tm.ma180;
    if (!hasAny) return null;
    return (
        <div className="metrics-panel__section">
            <h4 className="metrics-panel__section-title">
                <TrendingUp size={14} /> Moving Averages
            </h4>
            <div className="metrics-panel__grid">
                {tm.ma20 && <MetricItem label="MA 20" value={fmt(tm.ma20)} sub={maSubLabel(tm.priceVsMa20)} />}
                {tm.ma50 && <MetricItem label="MA 50" value={fmt(tm.ma50)} sub={maSubLabel(tm.priceVsMa50)} />}
                {tm.ma180 && <MetricItem label="MA 180" value={fmt(tm.ma180)} sub={maSubLabel(tm.priceVsMa180)} />}
                <TrendItem tm={tm} />
            </div>
        </div>
    );
}
