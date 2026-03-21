import { useState, useEffect, useRef, memo } from 'react';
import { getChangeClass } from '../utils/formatting';
import './SummaryCard.css';

const ANIMATION_DURATION = 600;

/** Parse a display value to a number for comparison */
const toNumeric = (val) => parseFloat(String(val).replace(/[^0-9.-]/g, ''));

/** Determine movement direction between two values */
function computeDirection(prevValue, newValue) {
    const prevNum = toNumeric(prevValue);
    const newNum = toNumeric(newValue);
    if (isNaN(prevNum) || isNaN(newNum)) return null;
    if (newNum > prevNum) return 'up';
    if (newNum < prevNum) return 'down';
    return null;
}

/** True when the value has actually changed after the initial render */
const hasValueChanged = (prevValue, value, isFirst) =>
    prevValue !== undefined && prevValue !== value && !isFirst;

/** True when polling just finished (data loaded) */
const didFinishPolling = (isPolling, isFirst) => !isPolling && !isFirst;

/** Build the CSS class string for the value element */
function buildValueClasses(isPolling, refreshPulse, isUpdated, direction) {
    return [
        'summary-value',
        isPolling && 'value-loading',
        refreshPulse && 'value-refreshed',
        isUpdated && 'value-updated',
        isUpdated && direction === 'up' && 'value-up',
        isUpdated && direction === 'down' && 'value-down',
    ].filter(Boolean).join(' ');
}

/** Format the change badge text */
const formatChange = (change) => {
    const sign = change >= 0 ? '+' : '';
    const formatted = change?.toFixed(2) || '0.00';
    return `${sign}${formatted}%`;
};

/** Change badge sub-component */
function ChangeBadge({ change }) {
    if (change === undefined) return null;
    const changeClass = getChangeClass(change);
    return (
        <div className={`summary-badge ${changeClass}`}>
            {formatChange(change)}
        </div>
    );
}

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
    valueKey = '',
    timeframes = null,
    selectedTimeframe = null,
    onTimeframeChange = null
}) {
    const [isUpdated, setIsUpdated] = useState(false);
    const [direction, setDirection] = useState(null);
    const [refreshPulse, setRefreshPulse] = useState(false);
    const previousValueRef = useRef(value);
    const isFirstRender = useRef(true);

    // Trigger refresh pulse when isPolling changes from true to false (data loaded)
    useEffect(() => {
        if (didFinishPolling(isPolling, isFirstRender.current)) {
            setRefreshPulse(true);
            const timer = setTimeout(() => setRefreshPulse(false), ANIMATION_DURATION);
            return () => clearTimeout(timer);
        }
        isFirstRender.current = false;
    }, [isPolling]);

    // Detect value changes and trigger animation
    useEffect(() => {
        const prevValue = previousValueRef.current;

        if (hasValueChanged(prevValue, value, isFirstRender.current)) {
            setDirection(computeDirection(prevValue, value));
            setIsUpdated(true);

            const timer = setTimeout(() => {
                setIsUpdated(false);
                setDirection(null);
            }, ANIMATION_DURATION);

            previousValueRef.current = value;
            return () => clearTimeout(timer);
        }

        previousValueRef.current = value;
    }, [value]);

    const valueClasses = buildValueClasses(isPolling, refreshPulse, isUpdated, direction);
    const cardClass = `summary-card${refreshPulse ? ' card-refreshed' : ''}`;

    return (
        <div className={cardClass}>
            <div className="summary-header">
                <div className="summary-label">
                    <span className="summary-label-content">
                        {icon && <span className="summary-icon">{icon}</span>}
                        {label}
                    </span>
                </div>

                {timeframes && onTimeframeChange && (
                    <div className="timeframe-toggles">
                        {timeframes.map(tf => (
                            <button
                                key={tf}
                                className={`timeframe-btn ${selectedTimeframe === tf ? 'active' : ''}`}
                                onClick={() => onTimeframeChange(tf)}
                                aria-label={`View ${tf} data`}
                            >
                                {tf}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className={valueClasses} data-key={valueKey}>
                {value}
            </div>

            <ChangeBadge change={change} />
        </div>
    );
}

export default memo(SummaryCard);
