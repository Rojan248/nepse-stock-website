import { useState, useMemo, useCallback } from 'react';
import { resolveSortValue, compareValues } from './sortHelpers';

/**
 * Custom hook for sorting stock arrays.
 * Returns sorted stocks, current sort config, and a sort handler.
 */
export function useSortedStocks(stocks, initialKey = 'symbol', initialDirection = 'asc', timeframe = '1D') {
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
                resolveSortValue(a, sortConfig.key, timeframe),
                resolveSortValue(b, sortConfig.key, timeframe),
                dir
            )
        );
    }, [stocks, sortConfig, timeframe]);

    return { sortedStocks, sortConfig, handleSort };
}
