import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import logger from '../utils/logger';
import { getMarketSummary, getSectors, getStocks } from '../services/api';

const LIVE_UPDATE_INTERVAL = 60000;
const FETCH_PAGE_SIZE = 100;

/** Fetch a single page of stocks from the API */
async function fetchPage(page) {
    const res = await getStocks(page, FETCH_PAGE_SIZE);
    return res?.stocks || res?.data || [];
}

/** Fetch ALL stocks by paginating through the API */
async function fetchAllStocks() {
    let all = [], page = 1, batch;
    do {
        batch = await fetchPage(page++);
        all = all.concat(batch);
    } while (batch.length >= FETCH_PAGE_SIZE);
    return all;
}

export function useMarketData() {
    const [marketSummary, setMarketSummary] = useState(null);
    const [sectors, setSectors] = useState([]);
    const [error, setError] = useState(null);
    const mountedRef = useRef(true);
    const intervalRef = useRef(null);

    const fetchMarket = useCallback(async (isInitial = false) => {
        if (!mountedRef.current) return;
        try {
            const [summary, sectorsData] = await Promise.all([
                getMarketSummary(),
                isInitial ? getSectors() : Promise.resolve(null)
            ]);
            if (!mountedRef.current) return;
            setMarketSummary({ ...summary, _updateId: Date.now() });
            if (sectorsData) setSectors(['all', ...(sectorsData || [])]);
            setError(null);
        } catch (err) {
            logger.error('Failed to fetch market data:', err);
            if (mountedRef.current) setError('Failed to update market data');
        }
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        fetchMarket(true);
        intervalRef.current = setInterval(() => fetchMarket(false), LIVE_UPDATE_INTERVAL);
        return () => {
            mountedRef.current = false;
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [fetchMarket]);

    return { marketSummary, sectors, error, setError };
}

export function useStockData() {
    const [stocks, setStocks] = useState([]);
    const [loading, setLoading] = useState(true);
    const mountedRef = useRef(true);
    const intervalRef = useRef(null);

    const loadAll = useCallback(async (isInitial = false) => {
        if (!mountedRef.current) return;
        try {
            if (isInitial) setLoading(true);
            const allStocks = await fetchAllStocks();
            if (mountedRef.current) setStocks(allStocks);
        } catch (err) {
            logger.error('Failed to fetch stocks:', err);
        } finally {
            if (mountedRef.current) setLoading(false);
        }
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        loadAll(true);
        intervalRef.current = setInterval(() => loadAll(false), LIVE_UPDATE_INTERVAL);
        return () => {
            mountedRef.current = false;
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [loadAll]);

    return { stocks, loading };
}
