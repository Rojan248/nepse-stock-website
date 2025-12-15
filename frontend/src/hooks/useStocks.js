import { useState, useEffect, useCallback } from 'react';
import { getStocks, getStockBySymbol, searchStocks, getTopGainers, getTopLosers } from '../services/api';
import { REFRESH_INTERVAL } from '../utils/constants';

/**
 * Hook for fetching all stocks with auto-refresh
 */
export function useStocks(page = 1, limit = 50) {
    const [stocks, setStocks] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            const result = await getStocks(page, limit);
            setStocks(result.stocks || []);
            setTotal(result.total || 0);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [page, limit]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, REFRESH_INTERVAL);
        return () => clearInterval(interval);
    }, [fetchData]);

    return { stocks, total, loading, error, refetch: fetchData };
}

/**
 * Hook for fetching a specific stock by symbol
 */
export function useStockDetail(symbol) {
    const [stock, setStock] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async () => {
        if (!symbol) return;
        try {
            const result = await getStockBySymbol(symbol);
            setStock(result);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [symbol]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, REFRESH_INTERVAL);
        return () => clearInterval(interval);
    }, [fetchData]);

    return { stock, loading, error, refetch: fetchData };
}

/**
 * Hook for searching stocks
 */
export function useSearchStocks(query) {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!query || query.length < 1) {
            setResults([]);
            return;
        }

        const search = async () => {
            setLoading(true);
            try {
                const result = await searchStocks(query);
                setResults(result.stocks || []);
                setError(null);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        const debounce = setTimeout(search, 300);
        return () => clearTimeout(debounce);
    }, [query]);

    return { results, loading, error };
}

/**
 * Hook for top gainers and losers
 */
export function useTopStocks(limit = 5) {
    const [gainers, setGainers] = useState([]);
    const [losers, setLosers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            const [gainersData, losersData] = await Promise.all([
                getTopGainers(limit),
                getTopLosers(limit)
            ]);
            setGainers(gainersData || []);
            setLosers(losersData || []);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [limit]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, REFRESH_INTERVAL);
        return () => clearInterval(interval);
    }, [fetchData]);

    return { gainers, losers, loading, error, refetch: fetchData };
}
