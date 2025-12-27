import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMarketSummary, getStocks, getSectors } from '../services/api';
import StockTable from '../components/StockTable';
import SummaryCard from '../components/SummaryCard';
import SectorChart from '../components/SectorChart';
import LoadingSpinner from '../components/LoadingSpinner';
import TrendingBar from '../components/TrendingBar';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import SearchBar from '../components/SearchBar';
import { formatNumber, formatPercent, formatTurnover, getChangeClass } from '../utils/formatting';
import { ITEMS_PER_PAGE } from '../utils/constants';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { Star, ChevronDown } from 'lucide-react';
import './HomePage.css';

// Live update interval - 15 seconds
const LIVE_UPDATE_INTERVAL = 15000;
// Page size for fetching from server (larger batches)
const FETCH_PAGE_SIZE = 100;

/**
 * Fetch ALL stocks from the server by looping through pages.
 * Returns a single array containing all stocks.
 */
async function fetchAllStocks() {
    let page = 1;
    let allStocks = [];
    let hasMore = true;

    while (hasMore) {
        const response = await getStocks(page, FETCH_PAGE_SIZE);

        // response is already unwrapped by axios interceptor
        // API returns { data: [...], count, pagination }
        const items = response?.stocks || response?.data || [];

        if (!items || items.length === 0) {
            hasMore = false;
        } else {
            allStocks = allStocks.concat(items);
            page += 1;

            // Stop if returned fewer items than requested
            if (items.length < FETCH_PAGE_SIZE) {
                hasMore = false;
            }
        }
    }

    console.log('Loaded total stocks:', allStocks.length);

    if (allStocks.length < 200) {
        console.warn(
            'Suspiciously low total stock count (expected ~270 for NEPSE):',
            allStocks.length
        );
        console.warn('Sample response:', allStocks.slice(0, 5));
    }

    return allStocks;
}

function HomePage({ globalSearch, setGlobalLastUpdated }) {
    const navigate = useNavigate();
    const [marketSummary, setMarketSummary] = useState(null);
    const [stocks, setStocks] = useState([]);
    const [sectors, setSectors] = useState([]);
    const [selectedSector, setSelectedSector] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [favorites, setFavorites] = useLocalStorage('nepse-favorites', []);
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

    // Refs for cleanup and tracking
    const mountedRef = useRef(true);
    const marketIntervalRef = useRef(null);
    const stocksIntervalRef = useRef(null);

    // Fetch market summary data
    const fetchMarketData = useCallback(async (isInitial = false) => {
        if (!mountedRef.current) return;

        try {
            const [summary, sectorsData] = await Promise.all([
                getMarketSummary(),
                isInitial ? getSectors() : Promise.resolve(null)
            ]);

            if (!mountedRef.current) return;

            setMarketSummary(prev => {
                // Force re-render even if values are same by creating new object
                return { ...summary, _updateId: Date.now() };
            });
            if (sectorsData) {
                setSectors(['all', ...(sectorsData || [])]);
            }
            setError(null);
        } catch (err) {
            console.error('Failed to fetch market data:', err);
            if (mountedRef.current) {
                setError('Failed to update market data');
            }
        }
    }, []);

    // Fetch ALL stocks (loops through pages)
    const loadAllStocks = useCallback(async (isInitial = false) => {
        if (!mountedRef.current) return;

        try {
            if (isInitial) {
                setLoading(true);
            }

            const allStocks = await fetchAllStocks();

            if (!mountedRef.current) return;

            setStocks(allStocks);
            const now = new Date();
            setLastUpdated(now);
            if (setGlobalLastUpdated) {
                setGlobalLastUpdated(now);
            }
            // Reset to page 1 when reloading all stocks
            if (isInitial) {
                setCurrentPage(1);
            }
        } catch (err) {
            console.error('Failed to fetch stocks:', err);
            // Keep existing stocks on error - don't clear them
        } finally {
            if (mountedRef.current) {
                setLoading(false);
            }
        }
    }, []);

    // Initial data fetch
    useEffect(() => {
        mountedRef.current = true;

        // Initial fetch
        fetchMarketData(true);
        loadAllStocks(true);

        // Setup polling intervals
        marketIntervalRef.current = setInterval(() => {
            fetchMarketData(false);
        }, LIVE_UPDATE_INTERVAL);

        stocksIntervalRef.current = setInterval(() => {
            loadAllStocks(false);
        }, LIVE_UPDATE_INTERVAL);

        // Cleanup on unmount
        return () => {
            mountedRef.current = false;
            if (marketIntervalRef.current) {
                clearInterval(marketIntervalRef.current);
            }
            if (stocksIntervalRef.current) {
                clearInterval(stocksIntervalRef.current);
            }
        };
    }, [fetchMarketData, loadAllStocks]);

    // Reset page to 1 when sector filter or globalSearch changes
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedSector, globalSearch]);

    const handleStockClick = (stock) => {
        navigate(`/stock/${stock.symbol}`);
    };

    const toggleFavorite = useCallback((symbol) => {
        setFavorites(prev => {
            if (prev.includes(symbol)) {
                return prev.filter(s => s !== symbol);
            }
            return [...prev, symbol];
        });
    }, [setFavorites]);

    // Client-side filtering by sector AND globalSearch query
    const filteredStocks = useMemo(() => {
        let result = stocks;

        // Filter by sector
        if (selectedSector !== 'all') {
            result = result.filter(stock => {
                if (!stock.sector) return false;

                const stockSector = stock.sector.toLowerCase().trim();
                const filterSector = selectedSector.toLowerCase().trim();

                if (stockSector === filterSector) return true;
                if (stockSector.includes(filterSector) || filterSector.includes(stockSector)) return true;

                const s1 = stockSector.endsWith('s') ? stockSector.slice(0, -1) : stockSector;
                const s2 = filterSector.endsWith('s') ? filterSector.slice(0, -1) : filterSector;

                return s1 === s2;
            });
        }

        // Filter by search query (symbol or company name)
        if (globalSearch && globalSearch.trim()) {
            const query = globalSearch.toLowerCase().trim();
            result = result.filter(stock => {
                const symbol = (stock.symbol || '').toLowerCase();
                const name = (stock.companyName || '').toLowerCase();
                return symbol.includes(query) || name.includes(query);
            });
        }

        // Filter by favorites
        if (showFavoritesOnly) {
            result = result.filter(stock => favorites.includes(stock.symbol));
        }

        return result;
    }, [stocks, selectedSector, globalSearch, showFavoritesOnly, favorites]);

    // Client-side pagination
    const totalPages = Math.max(1, Math.ceil(filteredStocks.length / ITEMS_PER_PAGE));

    const displayStocks = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        return filteredStocks.slice(start, end);
    }, [filteredStocks, currentPage]);

    // Calculate Market Breadth logic (client-side)
    const marketStats = useMemo(() => {
        if (!stocks || stocks.length === 0) return { advanced: 0, declined: 0, unchanged: 0 };
        return {
            advanced: stocks.filter(s => (s.changePercent || s.prices?.changePercent || 0) > 0).length,
            declined: stocks.filter(s => (s.changePercent || s.prices?.changePercent || 0) < 0).length,
            unchanged: stocks.filter(s => (s.changePercent || s.prices?.changePercent || 0) === 0).length
        };
    }, [stocks]);

    // DEBUG: Log stocks state changes
    useEffect(() => {
        if (stocks.length > 0) {
            console.log(`[HomePage] Total stocks in state: ${stocks.length}`);
            console.log(`[HomePage] Filtered stocks: ${filteredStocks.length}`);
            console.log(`[HomePage] Displaying page ${currentPage}: ${displayStocks.length} items`);
        } else if (!loading) {
            console.warn('[HomePage] Stocks array is empty!');
        }
    }, [stocks, filteredStocks, displayStocks, currentPage, loading]);

    // Calculate turnover for display (support fallback to summing stocks)
    let turnoverRaw = marketSummary?.totalTurnover || displayStocks.reduce((acc, stock) => acc + (parseFloat(stock.turnover) || 0), 0);
    const turnoverUnit = turnoverRaw >= 10000000 ? 'Cr' : 'L';
    const turnoverValue = turnoverRaw >= 10000000
        ? (turnoverRaw / 10000000).toFixed(2)
        : (turnoverRaw / 100000).toFixed(2);

    const totalBreadth = (marketStats.advanced + marketStats.declined + marketStats.unchanged) || 1;

    if (loading && !stocks.length) {
        return <LoadingSpinner fullPage text="Loading market data..." />;
    }

    return (
        <div className="home-page layout-container">
            {/* Market Summary */}
            <section className="market-overview">
                <div className="section-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 className="section-title text-2xl" style={{ margin: 0 }}>Market Summary</h2>
                </div>
                <div className="market-cards">
                    <SummaryCard
                        label="NEPSE Index"
                        value={marketSummary?.indexValue?.toFixed(2) || '--'}
                        change={marketSummary?.indexChangePercent}
                        valueKey="nepse-index"
                    />
                    <div className="summary-card">
                        <div className="summary-label">
                            TURNOVER
                        </div>
                        <div className="summary-value" style={{ display: 'flex', alignItems: 'baseline', columnGap: '6px' }}>
                            <span className="currency-symbol" style={{ fontSize: '0.6em', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Rs</span>
                            <span className="number">{turnoverValue}</span>
                            <span className="unit" style={{ fontSize: '0.6em', color: 'var(--text-secondary)' }}>{turnoverUnit}</span>
                        </div>
                    </div>
                    <SummaryCard
                        label="Transactions"
                        value={formatNumber(marketSummary?.totalTransactions)}
                        valueKey="transactions"
                    />
                    <SummaryCard
                        label="Volume"
                        value={formatNumber(marketSummary?.totalVolume)}
                        valueKey="volume"
                    />
                </div>

                {/* Market Breadth / Comparison */}
                {/* Market Breadth / Comparison */}
                <div className="market-breadth" style={{ marginTop: '2rem', background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Advanced</div>
                            <div style={{ color: 'var(--success)', fontSize: '1.5rem', fontWeight: '800' }}>{marketStats.advanced}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Declined</div>
                            <div style={{ color: 'var(--danger)', fontSize: '1.5rem', fontWeight: '800' }}>{marketStats.declined}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Unchanged</div>
                            <div style={{ color: 'var(--color-unchanged)', fontSize: '1.5rem', fontWeight: '800' }}>{marketStats.unchanged}</div>
                        </div>
                    </div>

                    {/* Visual Ratio Bar */}
                    <div style={{ height: '8px', width: '100%', display: 'flex', borderRadius: '999px', overflow: 'hidden', background: '#e5e7eb' }}>
                        <div style={{ width: `${(marketStats.advanced / totalBreadth) * 100}%`, background: 'var(--success)', height: '100%' }} />
                        <div style={{ width: `${(marketStats.declined / totalBreadth) * 100}%`, background: 'var(--danger)', height: '100%' }} />
                        <div style={{ width: `${(marketStats.unchanged / totalBreadth) * 100}%`, background: 'var(--color-unchanged)', height: '100%' }} />
                    </div>
                </div>
            </section>

            {/* Sector Analysis Chart */}
            <SectorChart stocks={stocks} />

            {/* Trending Stocks */}
            <TrendingBar />

            {/* All Stocks */}
            <section className="stocks-section">
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 section-header">
                    <h2 className="text-xl font-bold tracking-tight text-primary section-title">
                        All Stocks <span className="text-stone-400 font-normal ml-1" style={{ fontSize: '0.9em', color: 'var(--text-muted)' }}>({stocks.length})</span>
                    </h2>

                    <div className="flex items-center gap-3 w-full md:w-auto filters">
                        {/* Animated Watchlist Button */}
                        <button
                            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                            className={`watchlist-btn ${showFavoritesOnly ? 'active' : ''}`}
                        >
                            <div className="icon-container">
                                {/* Star Icon */}
                                <svg className="star-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                </svg>

                                {/* Check Icon */}
                                <svg className="check-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            </div>

                            <span className="btn-label">{showFavoritesOnly ? 'Added' : 'Watchlist'}</span>

                            {favorites.length > 0 && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${showFavoritesOnly ? 'bg-amber-200 text-amber-900' : 'bg-stone-100 text-stone-500'}`}>
                                    {favorites.length}
                                </span>
                            )}
                        </button>

                        {/* Rigorous Sector Select */}
                        <Select
                            value={selectedSector}
                            onChange={(e) => setSelectedSector(e.target.value)}
                            options={[{ label: 'ALL SECTORS', value: 'all' }, ...sectors.map(s => ({ label: s, value: s }))]}
                            placeholder="ALL SECTORS"
                        />
                    </div>
                </div>
                <StockTable
                    stocks={displayStocks}
                    onRowClick={handleStockClick}
                    showPagination={true}
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    loading={loading}
                    favorites={favorites}
                    onToggleFavorite={toggleFavorite}
                />
            </section >

            {/* Error toast (non-blocking) */}
            {
                error && (
                    <div className="error-toast">
                        <span>{error}</span>
                        <Button
                            variant="ghost"
                            size="sm"
                            buttonClass="circle"
                            onClick={() => setError(null)}
                            aria-label="Close error"
                        >
                            ×
                        </Button>
                    </div>
                )
            }
        </div >
    );
}

export default HomePage;
