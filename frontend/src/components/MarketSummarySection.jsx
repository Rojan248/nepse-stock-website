import React, { useState } from 'react';
import SummaryCard from './SummaryCard';
import MarketBreadthCard from './MarketBreadthCard';
import { formatNumber } from '../utils/formatting';

/** Format raw turnover into { value, unit } */
function formatTurnoverDisplay(raw) {
    if (raw >= 10000000) {
        return { value: (raw / 10000000).toFixed(2), unit: 'Cr' };
    }
    return { value: (raw / 100000).toFixed(2), unit: 'L' };
}

/** Resolve the index change percent for the selected timeframe */
function resolveIndexChange(marketSummary, timeframe) {
    if (timeframe === '1D') {
        return Number.isFinite(marketSummary?.indexChangePercent) ? marketSummary.indexChangePercent : undefined;
    }
    return marketSummary?.cumulative?.[timeframe] ?? undefined;
}

/** Market summary cards section */
export default function MarketSummarySection({ marketSummary, marketStats, statusFilter, onStatusChange }) {
    const [indexTimeframe, setIndexTimeframe] = useState('1D');

    const turnoverRaw = marketSummary?.totalTurnover ?? 0;
    const turnover = formatTurnoverDisplay(turnoverRaw);

    const indexValueDisplay = Number.isFinite(marketSummary?.indexValue)
        ? marketSummary.indexValue.toFixed(2)
        : '--';

    const indexChangePercent = resolveIndexChange(marketSummary, indexTimeframe);

    return (
        <section className="market-overview">
            <div className="section-header" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center' }}>
                <h2 className="section-title text-2xl" style={{ margin: 0 }}>Market Summary</h2>
            </div>
            <div className="market-cards">
                <SummaryCard
                    label="NEPSE Index"
                    value={indexValueDisplay}
                    change={indexChangePercent}
                    valueKey="nepse-index"
                    timeframes={['1D', '1W', '1M']}
                    selectedTimeframe={indexTimeframe}
                    onTimeframeChange={setIndexTimeframe}
                />
                <div className="summary-card">
                    <div className="summary-label">TURNOVER</div>
                    <div className="summary-value turnover-value">
                        <span className="currency-symbol turnover-currency">NPR</span>
                        <span className="number">{turnover.value}</span>
                        <span className="unit turnover-unit">{turnover.unit}</span>
                    </div>
                </div>
                <SummaryCard
                    label="Transactions"
                    value={formatNumber(marketSummary?.totalTransactions)}
                    valueKey="transactions"
                />
                <SummaryCard
                    label="Volume"
                    value={formatNumber(marketSummary?.totalVolume)}
                    valueKey="volume"
                />
            </div>
            <MarketBreadthCard
                marketStats={marketStats}
                statusFilter={statusFilter}
                onFilterChange={onStatusChange}
            />
        </section>
    );
}
