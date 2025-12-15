import { useState, useEffect, useRef, memo } from 'react';
import { getChangeClass } from '../utils/formatting';
import './SummaryCard.css';

/**
 * SummaryCard Component with live update animations
 */
function SummaryCard({ 
    label, 
    value, 
    change, 
    format = 'text', 
    icon = null,
    isPolling = false,
    valueKey = ''
}) {
    const changeClass = change !== undefined ? getChangeClass(change) : '';
    const [isUpdated, setIsUpdated] = useState(false);
    const [direction, setDirection] = useState(null);
    const [refreshPulse, setRefreshPulse] = useState(false);
    const previousValueRef = useRef(value);
    const isFirstRender = useRef(true);
    
    // Trigger refresh pulse when isPolling changes from true to false (data loaded)
    useEffect(() => {
        if (!isPolling && !isFirstRender.current) {
            setRefreshPulse(true);
            const timer = setTimeout(() => setRefreshPulse(false), 600);
            return () => clearTimeout(timer);
        }
        isFirstRender.current = false;
    }, [isPolling]);
    
    // Detect value changes and trigger animation
    useEffect(() => {
        const prevValue = previousValueRef.current;
        
        if (prevValue !== undefined && prevValue !== value && !isFirstRender.current) {
            // Determine direction for change indicator
            const prevNum = parseFloat(String(prevValue).replace(/[^0-9.-]/g, ''));
            const newNum = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
            
            if (!isNaN(prevNum) && !isNaN(newNum)) {
                setDirection(newNum > prevNum ? 'up' : newNum < prevNum ? 'down' : null);
            }
            
            setIsUpdated(true);
            
            // Clear animation after 600ms
            const timer = setTimeout(() => {
                setIsUpdated(false);
                setDirection(null);
            }, 600);
            
            previousValueRef.current = value;
            return () => clearTimeout(timer);
        }
        
        previousValueRef.current = value;
    }, [value]);

    // Build value classes
    const valueClasses = [
        'summary-value',
        isPolling && 'value-loading',
        refreshPulse && 'value-refreshed',
        isUpdated && 'value-updated',
        isUpdated && direction === 'up' && 'value-up',
        isUpdated && direction === 'down' && 'value-down'
    ].filter(Boolean).join(' ');
    
    return (
        <div className={`summary-card ${refreshPulse ? 'card-refreshed' : ''}`}>
            {/* Label */}
            <div className="summary-label">
                {icon && <span className="summary-icon">{icon}</span>}
                <span>{label}</span>
            </div>

            {/* Value with animation */}
            <div className={valueClasses} data-key={valueKey}>
                {value}
            </div>

            {/* Change Badge */}
            {change !== undefined && (
                <div className={`summary-badge ${changeClass}`}>
                    {change >= 0 ? '+' : ''}{change?.toFixed(2) || '0.00'}%
                </div>
            )}
        </div>
    );
}

export default memo(SummaryCard);
