import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getSharedWatchlist, getStockBySymbol } from '../services/api';

function SharedWatchlistPage() {
    const { slug } = useParams();
    const [watchlist, setWatchlist] = useState(null);
    const [stocks, setStocks] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        getSharedWatchlist(slug)
            .then(data => {
                setWatchlist(data);
                // Fetch price data for each symbol
                const symbols = (data?.items || []).map(i => i.symbol);
                return Promise.allSettled(symbols.map(s => getStockBySymbol(s).then(d => ({ symbol: s, ...d }))));
            })
            .then(results => {
                const map = {};
                for (const r of results) {
                    if (r.status === 'fulfilled' && r.value) {
                        map[r.value.symbol] = r.value;
                    }
                }
                setStocks(map);
            })
            .catch(err => {
                setError(err.response?.data?.error?.message || 'Watchlist not found');
            })
            .finally(() => setLoading(false));
    }, [slug]);

    if (loading) {
        return <div className="page-container" style={{ padding: '2rem', textAlign: 'center' }}><p>Loading watchlist...</p></div>;
    }

    if (error) {
        return <div className="page-container" style={{ padding: '2rem', textAlign: 'center' }}><p style={{ color: '#dc2626' }}>{error}</p></div>;
    }

    return (
        <div className="page-container" style={{ maxWidth: 700, margin: '0 auto', padding: '2rem 1rem' }}>
            <h1 style={{ marginBottom: '0.25rem' }}>{watchlist?.name || 'Shared Watchlist'}</h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
                Shared by {watchlist?.owner || 'Anonymous'} • {watchlist?.items?.length || 0} stocks
            </p>

            {watchlist?.items?.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--border-main)', textAlign: 'left' }}>
                                <th style={{ padding: '0.5rem' }}>Symbol</th>
                                <th style={{ padding: '0.5rem' }}>LTP</th>
                                <th style={{ padding: '0.5rem' }}>Change</th>
                                <th style={{ padding: '0.5rem' }}>% Change</th>
                            </tr>
                        </thead>
                        <tbody>
                            {watchlist.items.map(item => {
                                const s = stocks[item.symbol];
                                const change = s?.change || 0;
                                const pct = s?.percentageChange || 0;
                                const color = change > 0 ? 'var(--success)' : change < 0 ? 'var(--danger)' : 'var(--text-muted)';
                                return (
                                    <tr key={item.symbol} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                        <td style={{ padding: '0.5rem' }}>
                                            <Link to={`/stock/${item.symbol}`} style={{ fontWeight: 600, color: 'var(--primary-accent)', textDecoration: 'none' }}>
                                                {item.symbol}
                                            </Link>
                                        </td>
                                        <td style={{ padding: '0.5rem' }}>{s?.lastTradedPrice || '—'}</td>
                                        <td style={{ padding: '0.5rem', color }}>{change >= 0 ? '+' : ''}{change}</td>
                                        <td style={{ padding: '0.5rem', color, fontWeight: 600 }}>{pct >= 0 ? '+' : ''}{pct}%</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p style={{ color: 'var(--text-muted)' }}>This watchlist is empty.</p>
            )}
        </div>
    );
}

export default SharedWatchlistPage;
