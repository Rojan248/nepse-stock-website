import React from 'react';

export function MetricItem({ label, value, sub, cls }) {
    return (
        <div className={`metrics-panel__item ${cls || ''}`}>
            <span className="metrics-panel__item-label">{label}</span>
            <span className="metrics-panel__item-value">{value}</span>
            {sub && <span className="metrics-panel__item-sub">{sub}</span>}
        </div>
    );
}

export function fmt(n) {
    if (n == null) return '—';
    if (typeof n === 'number') return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    return n;
}

export function formatLargeNumber(n) {
    if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
    return Math.round(n).toLocaleString();
}

export const formatSignedPercent = (v, decimals = 2) =>
    v == null ? null : `${v > 0 ? '+' : ''}${v.toFixed(decimals)}%`;

export const trendClass = (v) => v > 0 ? 'trend-bullish' : v < 0 ? 'trend-bearish' : '';
export const maSubLabel = (pctValue) => formatSignedPercent(pctValue, 1);

export function rsiZoneClass(zone) {
    if (zone === 'overbought') return 'overbought';
    if (zone === 'oversold') return 'oversold';
    return '';
}
