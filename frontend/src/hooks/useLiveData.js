import { useState, useEffect, useRef, useCallback } from 'react';

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

    // Compare two values and detect changes
    const detectChanges = useCallback((newData, oldData, prefix = '') => {
        const changes = new Set();
        
        if (!oldData || !newData) return changes;
        
        const compareValues = (newVal, oldVal, key) => {
            if (typeof newVal === 'object' && newVal !== null) {
                if (Array.isArray(newVal)) {
                    // For arrays, compare by index
                    newVal.forEach((item, idx) => {
                        if (typeof item === 'object' && item !== null) {
                            const itemKey = item.symbol || item.id || idx;
                            const oldItem = oldVal?.[idx];
                            const nestedChanges = detectChanges(item, oldItem, `${key}.${itemKey}`);
                            nestedChanges.forEach(c => changes.add(c));
                        } else if (item !== oldVal?.[idx]) {
                            changes.add(`${key}.${idx}`);
                        }
                    });
                } else {
                    // For objects, recurse
                    Object.keys(newVal).forEach(k => {
                        compareValues(newVal[k], oldVal?.[k], `${key}.${k}`);
                    });
                }
            } else if (newVal !== oldVal) {
                changes.add(key);
            }
        };
        
        Object.keys(newData).forEach(key => {
            compareValues(newData[key], oldData[key], prefix ? `${prefix}.${key}` : key);
        });
        
        return changes;
    }, []);

    // Fetch data function
    const fetchData = useCallback(async (isInitial = false) => {
        if (!mountedRef.current) return;
        
        try {
            if (isInitial) {
                setIsLoading(true);
            } else {
                setIsPolling(true);
            }
            setError(null);
            
            const result = await fetchFn();
            
            if (!mountedRef.current) return;
            
            // Detect changes if we have previous data
            if (previousDataRef.current && !isInitial) {
                const changes = detectChanges(result, previousDataRef.current);
                if (changes.size > 0) {
                    setChangedFields(changes);
                    // Clear changed fields after animation duration
                    setTimeout(() => {
                        if (mountedRef.current) {
                            setChangedFields(new Set());
                        }
                    }, 500);
                }
            }
            
            previousDataRef.current = result;
            setData(result);
        } catch (err) {
            if (mountedRef.current) {
                setError(err.message || 'Failed to fetch data');
                console.error('Live data fetch error:', err);
            }
        } finally {
            if (mountedRef.current) {
                setIsLoading(false);
                setIsPolling(false);
            }
        }
    }, [fetchFn, detectChanges]);

    // Manual refresh function
    const refresh = useCallback(() => {
        fetchData(false);
    }, [fetchData]);

    // Setup polling
    useEffect(() => {
        mountedRef.current = true;
        
        if (enabled) {
            // Initial fetch
            fetchData(true);
            
            // Setup interval
            intervalRef.current = setInterval(() => {
                fetchData(false);
            }, interval);
        }
        
        return () => {
            mountedRef.current = false;
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [enabled, interval, fetchData]);

    return {
        data,
        isLoading,
        isPolling,
        error,
        changedFields,
        refresh
    };
}

/**
 * Hook for tracking individual value changes with direction
 * @param {any} value - The value to track
 * @param {string} key - Unique key for this value
 * @returns {Object} { displayValue, isChanged, direction, isLoading }
 */
export function useAnimatedValue(value, key, isPolling = false) {
    const [displayValue, setDisplayValue] = useState(value);
    const [isChanged, setIsChanged] = useState(false);
    const [direction, setDirection] = useState(null); // 'up' | 'down' | null
    const previousValueRef = useRef(value);
    const timeoutRef = useRef(null);

    useEffect(() => {
        const prevValue = previousValueRef.current;
        
        // Check if value actually changed
        if (prevValue !== value && prevValue !== undefined && value !== undefined) {
            // Determine direction for numeric values
            const prevNum = parseFloat(prevValue);
            const newNum = parseFloat(value);
            
            if (!isNaN(prevNum) && !isNaN(newNum)) {
                if (newNum > prevNum) {
                    setDirection('up');
                } else if (newNum < prevNum) {
                    setDirection('down');
                }
            }
            
            setIsChanged(true);
            setDisplayValue(value);
            
            // Clear the changed state after animation
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = setTimeout(() => {
                setIsChanged(false);
                setDirection(null);
            }, 500);
        } else {
            setDisplayValue(value);
        }
        
        previousValueRef.current = value;
        
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [value, key]);

    return {
        displayValue,
        isChanged,
        direction,
        isLoading: isPolling
    };
}

export default useLiveData;
