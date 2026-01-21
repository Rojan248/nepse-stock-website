import React from 'react';
import StatusFilterButton from './StatusFilterButton';

/**
 * MarketBreadthCard - Market breadth visualization with clickable filters
 * Displays Advanced/Declined/Unchanged counts with a visual ratio bar
 * Extracted from HomePage.jsx to reduce component complexity
 * 
 * @param {Object} marketStats - { advanced, declined, unchanged } counts
 * @param {string} statusFilter - Currently active filter ('all' | 'advanced' | 'declined' | 'unchanged')
 * @param {function} onFilterChange - Callback when filter changes
 */
const MarketBreadthCard = ({ marketStats, statusFilter, onFilterChange }) => {
    const { advanced = 0, declined = 0, unchanged = 0 } = marketStats;
    const totalBreadth = (advanced + declined + unchanged) || 1;
    
    return (
        <div 
            className="market-breadth" 
            style={{ 
                marginTop: '2rem', 
                background: 'var(--bg-secondary)', 
                padding: '1.5rem', 
                borderRadius: 'var(--radius-md)', 
                border: '1px solid var(--border-subtle)' 
            }}
        >
            {/* Status Filter Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <StatusFilterButton
                    status="advanced"
                    count={advanced}
                    activeFilter={statusFilter}
                    onClick={onFilterChange}
                />
                <StatusFilterButton
                    status="declined"
                    count={declined}
                    activeFilter={statusFilter}
                    onClick={onFilterChange}
                />
                <StatusFilterButton
                    status="unchanged"
                    count={unchanged}
                    activeFilter={statusFilter}
                    onClick={onFilterChange}
                />
            </div>

            {/* Visual Ratio Bar */}
            <div 
                style={{ 
                    height: '8px', 
                    width: '100%', 
                    display: 'flex', 
                    borderRadius: '999px', 
                    overflow: 'hidden', 
                    background: '#e5e7eb' 
                }}
                role="img"
                aria-label={`Market breadth: ${advanced} advanced, ${declined} declined, ${unchanged} unchanged`}
            >
                <div 
                    style={{ 
                        width: `${(advanced / totalBreadth) * 100}%`, 
                        background: 'var(--success)', 
                        height: '100%',
                        transition: 'width 0.3s ease'
                    }} 
                />
                <div 
                    style={{ 
                        width: `${(declined / totalBreadth) * 100}%`, 
                        background: 'var(--danger)', 
                        height: '100%',
                        transition: 'width 0.3s ease'
                    }} 
                />
                <div 
                    style={{ 
                        width: `${(unchanged / totalBreadth) * 100}%`, 
                        background: 'var(--color-unchanged)', 
                        height: '100%',
                        transition: 'width 0.3s ease'
                    }} 
                />
            </div>
        </div>
    );
};

export default MarketBreadthCard;
