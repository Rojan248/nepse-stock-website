import React from 'react';
import { TrendingDown } from 'lucide-react';
import { MetricItem, formatSignedPercent, rsiZoneClass } from './MetricsUtils';

export function MomentumSection({ mm }) {
    if (!mm) return null;
    const hasAny = mm.rsi14 != null || mm.roc10d != null;
    if (!hasAny) return null;
    return (
        <div className="metrics-panel__section">
            <h4 className="metrics-panel__section-title">
                <TrendingDown size={14} /> Momentum
            </h4>
            <div className="metrics-panel__grid">
                {mm.rsi14 != null && <MetricItem label="RSI (14)" value={mm.rsi14.toFixed(1)} cls={rsiZoneClass(mm.rsiZone)} />}
                {mm.rsi7 != null && <MetricItem label="RSI (7)" value={mm.rsi7.toFixed(1)} />}
                {mm.roc10d != null && <MetricItem label="ROC 10d" value={formatSignedPercent(mm.roc10d)} />}
                {mm.roc30d != null && <MetricItem label="ROC 30d" value={formatSignedPercent(mm.roc30d)} />}
            </div>
        </div>
    );
}
