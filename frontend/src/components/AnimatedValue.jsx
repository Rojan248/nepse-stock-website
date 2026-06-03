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
const buildAnimatedClasses = ({ className, isLoading, isChanged, showDirection, direction }) => [
    'animated-value',
    className,
    isLoading && 'value-loading',
    isChanged && 'value-updated',
    isChanged && showDirection && direction === 'up' && 'value-up',
    isChanged && showDirection && direction === 'down' && 'value-down'
].filter(Boolean).join(' ');

const formatDisplayValue = (displayValue, formatter) =>
    formatter ? formatter(displayValue) : displayValue;

function Affix({ value, className }) {
    return value ? <span className={className}>{value}</span> : null;
}

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

    const formattedValue = formatDisplayValue(displayValue, formatter);
    const classes = buildAnimatedClasses({ className, isLoading, isChanged, showDirection, direction });

    return (
        <span className={classes} data-key={valueKey}>
            <Affix value={prefix} className="value-prefix" />
            <span className="value-content">{formattedValue ?? '--'}</span>
            <Affix value={suffix} className="value-suffix" />
        </span>
    );
}

export default memo(AnimatedValue);
