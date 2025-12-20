import React from 'react';
import './MetricCard.css';

const MetricCard = ({ label, value, change, variant = 1, isLoading = false }) => {
    // Format change for valid number display if it's a number
    const formattedChange = change;

    // Determine change direction for styling
    const isPositive = typeof change === 'string' && (change.includes('+') || (!change.includes('-') && parseFloat(change) > 0));
    const isNegative = typeof change === 'string' && change.includes('-');

    return (
        <div className={`metric-card metric-card--variant-${variant} ${isLoading ? 'loading' : ''}`}>
            {isLoading ? (
                <div className="metric-skeleton">
                    <div className="skeleton-label"></div>
                    <div className="skeleton-value"></div>
                </div>
            ) : (
                <>
                    <div className="metric-card__label">{label}</div>
                    <div className="metric-card__value">{value}</div>
                    {change && (
                        <div className={`metric-card__change ${isPositive ? 'metric-card__change--positive' : isNegative ? 'metric-card__change--negative' : ''}`}>
                            {formattedChange}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default MetricCard;
