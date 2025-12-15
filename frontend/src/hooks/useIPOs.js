import { useState, useEffect, useCallback } from 'react';
import { getIPOs, getActiveIPOs, getIPOByCompanyName } from '../services/api';
import { REFRESH_INTERVAL } from '../utils/constants';

/**
 * Hook for fetching IPOs with optional status filter
 */
export function useIPOs(status = null) {
    const [ipos, setIpos] = useState([]);
    const [statistics, setStatistics] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            const result = await getIPOs(status);
            setIpos(result.ipos || []);
            setStatistics(result.statistics || {});
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [status]);

    useEffect(() => {
        fetchData();
        // IPOs don't need frequent refresh
        const interval = setInterval(fetchData, REFRESH_INTERVAL * 6);
        return () => clearInterval(interval);
    }, [fetchData]);

    return { ipos, statistics, loading, error, refetch: fetchData };
}

/**
 * Hook for fetching active IPOs
 */
export function useActiveIPOs() {
    const [ipos, setIpos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async () => {
        try {
            const result = await getActiveIPOs();
            setIpos(result || []);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { ipos, loading, error, refetch: fetchData };
}

/**
 * Hook for fetching a specific IPO
 */
export function useIPODetail(companyName) {
    const [ipo, setIpo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async () => {
        if (!companyName) return;
        try {
            const result = await getIPOByCompanyName(companyName);
            setIpo(result);
            setError(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [companyName]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { ipo, loading, error, refetch: fetchData };
}
