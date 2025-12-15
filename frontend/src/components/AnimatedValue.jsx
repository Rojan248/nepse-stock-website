import { memo } from 'react';
import { useAnimatedValue } from '../hooks/useLiveData';
import './AnimatedValue.css';

/**
 * AnimatedValue Component
 * Displays a value with smooth animations when it changes
 * 
 * @param {any} value - The value to display
 * @param {string} valueKey - Unique key for tracking changes
 * @param {boolean} isPolling - Whether data is currently being fetched
 * @param {string} className - Additional CSS classes
 * @param {string} prefix - Text to show before the value (e.g., "Rs")
 * @param {string} suffix - Text to show after the value (e.g., "%")
 * @param {boolean} showDirection - Whether to show up/down colors
 * @param {Function} formatter - Optional function to format the value
 */
function AnimatedValue({
    value,
    valueKey,
    isPolling = false,
    className = '',
    prefix = '',
    suffix = '',
    showDirection = true,
    formatter = null
}) {
    const { displayValue, isChanged, direction, isLoading } = useAnimatedValue(
        value,
        valueKey,
        isPolling
    );

    // Format the display value if formatter provided
    const formattedValue = formatter ? formatter(displayValue) : displayValue;

    // Build CSS classes
    const classes = [
        'animated-value',
        className,
        isLoading && 'value-loading',
        isChanged && 'value-updated',
        isChanged && showDirection && direction === 'up' && 'value-up',
        isChanged && showDirection && direction === 'down' && 'value-down'
    ].filter(Boolean).join(' ');

    return (
        <span className={classes} data-key={valueKey}>
            {prefix && <span className="value-prefix">{prefix}</span>}
            <span className="value-content">{formattedValue ?? '--'}</span>
            {suffix && <span className="value-suffix">{suffix}</span>}
        </span>
    );
}

export default memo(AnimatedValue);
