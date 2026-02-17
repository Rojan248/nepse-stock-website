import { useState, useMemo, useCallback } from 'react';

/** Resolve the sort value for a stock, handling nested price fields */
function resolveSortValue(stock, key) {
    if (key === 'ltp') return stock.ltp || stock.prices?.ltp || 0;
    return stock[key];
}

/** Compare two values with directional multiplier */
function compareValues(aVal, bVal, dir) {
    if (aVal < bVal) return -dir;
    if (aVal > bVal) return dir;
    return 0;
}

/**
 * Custom hook for sorting stock arrays.
 * Returns sorted stocks, current sort config, and a sort handler.
 */
export function useSortedStocks(stocks, initialKey = 'symbol', initialDirection = 'asc') {
    const [sortConfig, setSortConfig] = useState({ key: initialKey, direction: initialDirection });

    const handleSort = useCallback((key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    }, []);

    const sortedStocks = useMemo(() => {
        const dir = sortConfig.direction === 'asc' ? 1 : -1;
        return [...stocks].sort((a, b) =>
            compareValues(
                resolveSortValue(a, sortConfig.key),
                resolveSortValue(b, sortConfig.key),
                dir
            )
        );
    }, [stocks, sortConfig]);

    return { sortedStocks, sortConfig, handleSort };
}
