import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import logger from '../utils/logger';
import { getMarketSummary, getSectors, getStocks } from '../services/api';

const FALLBACK_UPDATE_INTERVAL = 5 * 60000; // 5 minute fallback
const FETCH_PAGE_SIZE = 100;
const STREAM_URL = (import.meta.env.VITE_API_URL || '/api') + '/stream';

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

const isStreamUpdate = (event) => {
    try {
        return JSON.parse(event.data).type === 'update';
    } catch (e) {
        return false;
    }
};

function useStreamRefresh(refresh) {
    useEffect(() => {
        const source = new EventSource(STREAM_URL);
        source.onmessage = (event) => {
            if (isStreamUpdate(event)) refresh(false);
        };

        const intervalId = setInterval(() => refresh(false), FALLBACK_UPDATE_INTERVAL);

        return () => {
            source.close();
            clearInterval(intervalId);
        };
    }, [refresh]);
}

export function useMarketData() {
    const [marketSummary, setMarketSummary] = useState(null);
    const [sectors, setSectors] = useState([]);
    const [error, setError] = useState(null);
    const mountedRef = useRef(true);

    const fetchMarket = useCallback(async (isInitial = false) => {
        if (!mountedRef.current) return;
        try {
            const summaryPromise = getMarketSummary();
            const sectorsPromise = isInitial ? getSectors() : Promise.resolve(null);

            const [summary, sectorsData] = await Promise.all([summaryPromise, sectorsPromise]);

            if (!mountedRef.current) return;

            setMarketSummary({ ...summary, _updateId: Date.now() });
            if (sectorsData) setSectors(['all', ...sectorsData]);
            setError(null);
        } catch (err) {
            logger.error('Failed to fetch market data:', err);
            if (mountedRef.current) setError('Failed to update market data');
        }
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        fetchMarket(true);

        return () => {
            mountedRef.current = false;
        };
    }, [fetchMarket]);
    useStreamRefresh(fetchMarket);

    return { marketSummary, sectors, error, setError };
}

export function useStockData() {
    const [stocks, setStocks] = useState([]);
    const [loading, setLoading] = useState(true);
    const mountedRef = useRef(true);

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

        return () => {
            mountedRef.current = false;
        };
    }, [loadAll]);
    useStreamRefresh(loadAll);

    return { stocks, loading };
}
