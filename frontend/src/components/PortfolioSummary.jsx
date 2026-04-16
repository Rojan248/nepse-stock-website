import React from 'react';

// Common summary box component
function SummaryBox({ label, value, color }) {
    return (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)', borderRadius: 10, padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{label}</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: color || 'var(--text-primary)' }}>{value}</div>
        </div>
    );
}

// Determines conditional generic color based on threshold relative to 0
const plColor = (value) => {
    if (!value || value === 0) return 'var(--text-primary)';
    return value > 0 ? 'var(--success)' : 'var(--danger)'; 
};

// Formats NPR currency elegantly 
const formatNPR = (num) => `NPR ${Math.round(num || 0).toLocaleString()}`;

/**
 * Renders the top-level aggregate dashboard blocks
 */
export function PortfolioSummary({ summary }) {
    if (!summary) return null;

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <SummaryBox label="Total Invested" value={formatNPR(summary.totalInvested)} />
            <SummaryBox label="Market Value" value={formatNPR(summary.totalCurrentValue)} />
            <SummaryBox 
                label="Total P&L" 
                value={formatNPR(summary.totalPnL)} 
                color={plColor(summary.totalPnL)} 
            />
            <SummaryBox 
                label="Overall Return" 
                value={`${(summary.pnlPercentage || 0).toFixed(2)}%`} 
                color={plColor(summary.pnlPercentage)} 
            />
        </div>
    );
}

/**
 * Renders detailed line-item holdings for the portfolio 
 */
export function HoldingsTable({ holdings }) {
    if (!holdings?.length) return null;

    return (
        <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-main)', textAlign: 'left' }}>
                        <th style={{ padding: '0.5rem' }}>Symbol</th>
                        <th style={{ padding: '0.5rem' }}>Shares</th>
                        <th style={{ padding: '0.5rem' }}>Avg Price</th>
                        <th style={{ padding: '0.5rem' }}>LTP</th>
                        <th style={{ padding: '0.5rem' }}>Current Value</th>
                        <th style={{ padding: '0.5rem' }}>Stock P&L</th>
                    </tr>
                </thead>
                <tbody>
                    {holdings.map(h => (
                        <tr key={h.symbol} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '0.5rem', fontWeight: 600 }}>{h.symbol}</td>
                            <td style={{ padding: '0.5rem' }}>{Math.round(h.sharesHeld).toLocaleString()}</td>
                            <td style={{ padding: '0.5rem' }}>{h.averageBuyPrice.toFixed(2)}</td>
                            <td style={{ padding: '0.5rem' }}>{h.currentPrice.toFixed(2)}</td>
                            <td style={{ padding: '0.5rem' }}>{Math.round(h.currentValue).toLocaleString()}</td>
                            <td style={{ padding: '0.5rem', color: plColor(h.unrealizedPnL), fontWeight: 600 }}>
                                {h.unrealizedPnL > 0 ? '+' : ''}{Math.round(h.unrealizedPnL).toLocaleString()} 
                                {` (${h.pnlPercentage.toFixed(2)}%)`}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default { PortfolioSummary, HoldingsTable };
