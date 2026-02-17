import { useState, useEffect, useRef, useCallback } from 'react';

// ==================== Change Detection Helpers ====================

/**
 * Recursively compare two values and collect changed field paths.
 * Mutates the `changes` Set for performance.
 */
function compareValues(newVal, oldVal, key, changes) {
    if (newVal === oldVal) return;

    if (typeof newVal !== 'object' || newVal === null) {
        changes.add(key);
        return;
    }

    if (Array.isArray(newVal)) {
        newVal.forEach((item, idx) => {
            const itemKey = (typeof item === 'object' && item !== null)
                ? (item.symbol || item.id || idx)
                : idx;
            compareValues(item, oldVal?.[idx], `${key}.${itemKey}`, changes);
        });
        return;
    }

    // Plain object — recurse into keys
    for (const k of Object.keys(newVal)) {
        compareValues(newVal[k], oldVal?.[k], `${key}.${k}`, changes);
    }
}

/**
 * Detect which fields changed between two data snapshots.
 * @returns {Set<string>} Set of changed field paths
 */
function detectChanges(newData, oldData, prefix = '') {
    const changes = new Set();
    if (!oldData || !newData || newData === oldData) return changes;

    for (const key of Object.keys(newData)) {
        compareValues(newData[key], oldData[key], prefix ? `${prefix}.${key}` : key, changes);
    }
    return changes;
}

/**
 * Determine numeric direction: 'up', 'down', or null
 */
function getDirection(prevValue, newValue) {
    const prev = parseFloat(prevValue);
    const next = parseFloat(newValue);
    if (isNaN(prev) || isNaN(next) || prev === next) return null;
    return next > prev ? 'up' : 'down';
}

// ==================== Change Flash Helper ====================

const FLASH_DURATION = 500;

/**
 * Set changed fields and auto-clear after FLASH_DURATION.
 * Returns a cleanup function to cancel the timeout.
 */
function flashChanges(changes, setChangedFields, mountedRef) {
    if (changes.size === 0) return undefined;

    setChangedFields(changes);
    const timer = setTimeout(() => {
        if (mountedRef.current) setChangedFields(new Set());
    }, FLASH_DURATION);

    return () => clearTimeout(timer);
}

// ==================== useLiveData ====================

/**
 * Custom hook for live data polling with change detection
 * @param {Function} fetchFn - Async function to fetch data
 * @param {number} interval - Polling interval in milliseconds (default 15000)
 * @param {boolean} enabled - Whether polling is enabled
 * @returns {Object} { data, isLoading, isPolling, error, changedFields, refresh }
 */
export function useLiveData(fetchFn, interval = 15000, enabled = true) {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isPolling, setIsPolling] = useState(false);
    const [error, setError] = useState(null);
    const [changedFields, setChangedFields] = useState(new Set());
    const previousDataRef = useRef(null);
    const intervalRef = useRef(null);
    const mountedRef = useRef(true);

    const fetchData = useCallback(async (isInitial = false) => {
        if (!mountedRef.current) return;

        if (isInitial) setIsLoading(true);
        else setIsPolling(true);
        setError(null);

        try {
            const result = await fetchFn();
            if (!mountedRef.current) return;

            // Flash changed fields on poll updates (not initial load)
            if (previousDataRef.current && !isInitial) {
                const changes = detectChanges(result, previousDataRef.current);
                flashChanges(changes, setChangedFields, mountedRef);
            }

            previousDataRef.current = result;
            setData(result);
        } catch (err) {
            if (!mountedRef.current) return;
            setError(err.message || 'Failed to fetch data');
            console.error('Live data fetch error:', err);
        } finally {
            if (mountedRef.current) {
                setIsLoading(false);
                setIsPolling(false);
            }
        }
    }, [fetchFn]);

    const refresh = useCallback(() => fetchData(false), [fetchData]);

    // Setup polling lifecycle
    useEffect(() => {
        mountedRef.current = true;

        if (enabled) {
            fetchData(true);
            intervalRef.current = setInterval(() => fetchData(false), interval);
        }

        return () => {
            mountedRef.current = false;
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [enabled, interval, fetchData]);

    return { data, isLoading, isPolling, error, changedFields, refresh };
}

// ==================== useAnimatedValue ====================

/**
 * Hook for tracking individual value changes with direction
 * @param {any} value - The value to track
 * @param {string} key - Unique key for this value
 * @param {boolean} isPolling - Whether parent is currently polling
 * @returns {Object} { displayValue, isChanged, direction, isLoading }
 */
export function useAnimatedValue(value, key, isPolling = false) {
    const [displayValue, setDisplayValue] = useState(value);
    const [isChanged, setIsChanged] = useState(false);
    const [direction, setDirection] = useState(null);
    const previousValueRef = useRef(value);
    const timeoutRef = useRef(null);

    useEffect(() => {
        const prevValue = previousValueRef.current;
        const hasChanged = prevValue !== value && prevValue !== undefined && value !== undefined;

        setDisplayValue(value);
        previousValueRef.current = value;

        if (!hasChanged) return;

        setDirection(getDirection(prevValue, value));
        setIsChanged(true);

        // Clear previous timeout and schedule reset
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            setIsChanged(false);
            setDirection(null);
        }, FLASH_DURATION);

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [value, key]);

    return { displayValue, isChanged, direction, isLoading: isPolling };
}

export default useLiveData;

