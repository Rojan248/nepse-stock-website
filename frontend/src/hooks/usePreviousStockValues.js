import { useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook that tracks previous stock values for animation purposes.
 * Returns a getter function: getPreviousValue(symbol, field) → previous value or undefined.
 */
export function usePreviousStockValues(stocks) {
    const prevStockMap = useRef(new Map());

    useEffect(() => {
        const newMap = new Map();
        stocks.forEach(stock => {
            newMap.set(stock.symbol, {
                ltp: stock.ltp,
                change: stock.change,
                changePercent: stock.changePercent,
                volume: stock.volume
            });
        });

        // Store current as previous after animation completes
        const timer = setTimeout(() => {
            prevStockMap.current = newMap;
        }, 600);

        return () => clearTimeout(timer);
    }, [stocks]);

    const getPreviousValue = useCallback((symbol, field) => {
        return prevStockMap.current.get(symbol)?.[field];
    }, []);

    return getPreviousValue;
}
