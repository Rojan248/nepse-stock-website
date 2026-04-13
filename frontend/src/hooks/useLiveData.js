import { useState, useEffect, useRef, useCallback } from 'react';

// ==================== Change Detection Helpers ====================

/** Can we meaningfully compare two data snapshots? */
function canCompare(newData, oldData) {
    return newData != null && oldData != null && newData !== oldData;
}

/** Are two parsed numbers both valid and different above a threshold? */
const SIGNIFICANCE_THRESHOLD = 0.001; // 0.1%

function areDifferentNumbers(a, b) {
    const valA = parseFloat(a);
    const valB = parseFloat(b);
    if (isNaN(valA) || isNaN(valB)) return false;
    if (valA === valB) return false;
    
    // Check if the percentage difference exceeds the threshold
    const diff = Math.abs(valA - valB);
    const avg = (Math.abs(valA) + Math.abs(valB)) / 2;
    if (avg === 0) return diff > 0;
    return (diff / avg) > SIGNIFICANCE_THRESHOLD;
}

/** Resolve a stable key for an array item (symbol > id > index) */
function resolveItemKey(item, idx) {
    if (typeof item === 'object' && item !== null) {
        return item.symbol || item.id || idx;
    }
    return idx;
}

/** Recurse into array elements, comparing each by resolved key */
function compareArrayItems(newArr, oldArr, key, changes) {
    for (let idx = 0; idx < newArr.length; idx++) {
        const itemKey = resolveItemKey(newArr[idx], idx);
        compareValues(newArr[idx], oldArr?.[idx], `${key}.${itemKey}`, changes);
    }
}

/** Recurse into plain-object keys */
function compareObjectKeys(newObj, oldObj, key, changes) {
    for (const k of Object.keys(newObj)) {
        compareValues(newObj[k], oldObj?.[k], `${key}.${k}`, changes);
    }
}

/**
 * Recursively compare two values and collect changed field paths.
 * Dispatches to type-specific handlers.
 */
function compareValues(newVal, oldVal, key, changes) {
    if (newVal === oldVal) return;

    if (typeof newVal !== 'object' || newVal === null) {
        changes.add(key);
        return;
    }

    if (Array.isArray(newVal)) {
        compareArrayItems(newVal, oldVal, key, changes);
    } else {
        compareObjectKeys(newVal, oldVal, key, changes);
    }
}

/**
 * Detect which fields changed between two data snapshots.
 * @returns {Set<string>} Set of changed field paths
 */
function detectChanges(newData, oldData, prefix = '') {
    const changes = new Set();
    if (!canCompare(newData, oldData)) return changes;

    for (const key of Object.keys(newData)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        compareValues(newData[key], oldData[key], fullKey, changes);
    }
    return changes;
}

/** Determine numeric direction: 'up', 'down', or null */
function getDirection(prevValue, newValue) {
    const prev = parseFloat(prevValue);
    const next = parseFloat(newValue);
    return areDifferentNumbers(prev, next) ? (next > prev ? 'up' : 'down') : null;
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

// ==================== Fetch Helpers ====================

/**
 * @typedef {Object} LiveDataCtx
 * @property {React.MutableRefObject} previousDataRef
 * @property {React.MutableRefObject} mountedRef
 * @property {Function} setData
 * @property {Function} setChangedFields
 * @property {Function} setIsLoading
 * @property {Function} setIsPolling
 * @property {Function} setError
 */

/** Process a successful fetch result — detect changes and update state */
function handleFetchResult(result, isInitial, ctx) {
    if (!ctx.mountedRef.current) return;

    if (ctx.previousDataRef.current && !isInitial) {
        const changes = detectChanges(result, ctx.previousDataRef.current);
        flashChanges(changes, ctx.setChangedFields, ctx.mountedRef);
    }

    ctx.previousDataRef.current = result;
    ctx.setData(result);
}

/** Execute a single fetch cycle, setting loading/error state around the call */
async function executeFetch(fetchFn, isInitial, ctx) {
    if (!ctx.mountedRef.current) return;

    if (isInitial) ctx.setIsLoading(true);
    else ctx.setIsPolling(true);
    ctx.setError(null);

    try {
        const result = await fetchFn();
        handleFetchResult(result, isInitial, ctx);
    } catch (err) {
        if (!ctx.mountedRef.current) return;
        ctx.setError(err.message || 'Failed to fetch data');
        console.error('Live data fetch error:', err);
    } finally {
        if (ctx.mountedRef.current) {
            ctx.setIsLoading(false);
            ctx.setIsPolling(false);
        }
    }
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

    const fetchData = useCallback((isInitial = false) => {
        /** @type {LiveDataCtx} */
        const ctx = { previousDataRef, mountedRef, setData, setChangedFields, setIsLoading, setIsPolling, setError };
        return executeFetch(fetchFn, isInitial, ctx);
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
        const hasSignificantChange = areDifferentNumbers(prevValue, value);

        setDisplayValue(value);
        previousValueRef.current = value;

        if (!hasSignificantChange) return;

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
