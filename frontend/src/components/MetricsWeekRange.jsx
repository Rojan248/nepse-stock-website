import React from 'react';
import { MetricItem, fmt, formatSignedPercent } from './MetricsUtils';

export function WeekRangeSection({ pm }) {
    if (!pm) return null;
    const hasAny = pm.high52w || pm.low52w;
    if (!hasAny) return null;
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
