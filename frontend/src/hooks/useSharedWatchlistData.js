import { useState, useEffect } from 'react';
import { getSharedWatchlist, getStockBySymbol } from '../services/api';

const fetchStockSnapshot = (symbol) => getStockBySymbol(symbol).then(data => ({ symbol, ...data }));

const isResolvedStock = (result) => result.status === 'fulfilled' && result.value;

const buildStockMap = (results) => results
    .filter(isResolvedStock)
    .reduce((map, result) => ({ ...map, [result.value.symbol]: result.value }), {});

const fetchSharedWatchlistData = async (slug) => {
    const watchlist = await getSharedWatchlist(slug);
    const symbols = (watchlist?.items || []).map(i => i.symbol);
    const stockResults = await Promise.allSettled(symbols.map(fetchStockSnapshot));
    return { watchlist, stocks: buildStockMap(stockResults) };
};

const getWatchlistError = (err) => err.response?.data?.error?.message || 'Watchlist not found';

export function useSharedWatchlistData(slug) {
    const [watchlist, setWatchlist] = useState(null);
    const [stocks, setStocks] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        const updateIfActive = (update) => {
            if (!cancelled) update();
        };

        setLoading(true);
        fetchSharedWatchlistData(slug)
            .then(({ watchlist, stocks }) => updateIfActive(() => {
                setWatchlist(watchlist);
                setStocks(stocks);
                setError('');
            }))
            .catch(err => updateIfActive(() => setError(getWatchlistError(err))))
            .finally(() => updateIfActive(() => setLoading(false)));

        return () => {
            cancelled = true;
        };
    }, [slug]);

    return { watchlist, stocks, loading, error };
}
