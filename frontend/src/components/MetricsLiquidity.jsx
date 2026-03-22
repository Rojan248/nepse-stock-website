import React from 'react';
import { BarChart2 } from 'lucide-react';
import { MetricItem, formatLargeNumber } from './MetricsUtils';

function VolRatioItem({ lm, show }) {
    if (!show) return null;
    if (lm.volumeRatio == null) return null;
    return <MetricItem label="Vol Ratio" value={`${lm.volumeRatio.toFixed(2)}x`} cls={lm.isVolumeSpike ? 'spike' : ''} />;
}

function AvgVolItem({ lm }) {
    if (lm.avgVolume20d == null) return null;
    return <MetricItem label="Avg Vol" value={formatLargeNumber(lm.avgVolume20d)} />;
}

function TradingDaysItem({ lm }) {
    if (!lm.tradingDays || lm.tradingDays <= 0) return null;
    return <MetricItem label="Trading Days" value={lm.tradingDays} />;
}

export function LiquiditySection({ lm, hasEnoughForLiquidity }) {
    if (!lm) return null;
    if (lm.liquidityScore == null || lm.liquidityScore <= 0) return null;
    const scoreLabel = hasEnoughForLiquidity
        ? <MetricItem label="Liquidity Score" value={`${lm.liquidityScore}/100`} />
        : <MetricItem label="Liquidity Score" value="N/A" sub="accumulating data" />;
    return (
        <div className="metrics-panel__section">
            <h4 className="metrics-panel__section-title">
                <BarChart2 size={14} /> Liquidity
            </h4>
            <div className="metrics-panel__grid">
                {scoreLabel}
                <VolRatioItem lm={lm} show={hasEnoughForLiquidity} />
                <AvgVolItem lm={lm} />
                <TradingDaysItem lm={lm} />
            </div>
        </div>
    );
}
