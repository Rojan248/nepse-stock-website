import React from 'react';

/**
 * StatusFilterButton - Clickable status indicator for market breadth filtering
 * Extracted from HomePage to eliminate 3x duplication of identical button patterns
 * 
 * @param {string} status - The status type: 'advanced' | 'declined' | 'unchanged'
 * @param {number} count - Number of stocks in this status
 * @param {string} activeFilter - Currently active filter ('all' or a specific status)
 * @param {function} onClick - Callback when clicked, toggles filter
 */
const StatusFilterButton = ({ status, count, activeFilter, onClick }) => {
    const isActive = activeFilter === status;
    const isVisible = activeFilter === 'all' || isActive;
    
    // Color mapping for each status type
    const colorMap = {
        advanced: 'var(--success)',
        declined: 'var(--danger)',
        unchanged: 'var(--color-unchanged)'
    };
    
    // Label mapping
    const labelMap = {
        advanced: 'Advanced',
        declined: 'Declined',
        unchanged: 'Unchanged'
    };
    
    const handleClick = () => {
        onClick(isActive ? 'all' : status);
    };
    
    return (
        <div
            onClick={handleClick}
            style={{
                textAlign: 'center',
                cursor: 'pointer',
                opacity: isVisible ? 1 : 0.4,
                transform: isActive ? 'scale(1.1)' : 'scale(1)',
                transition: 'all 0.2s ease'
            }}
            role="button"
            tabIndex={0}
            aria-pressed={isActive}
            aria-label={`Filter by ${labelMap[status]}`}
            onKeyDown={(e) => e.key === 'Enter' && handleClick()}
        >
            <div style={{
                color: 'var(--text-secondary)',
                fontSize: '0.75rem',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '0.25rem'
            }}>
                {labelMap[status]}
            </div>
            <div style={{
                color: colorMap[status],
                fontSize: '1.5rem',
                fontWeight: '800'
            }}>
                {count}
            </div>
        </div>
    );
};

export default StatusFilterButton;
