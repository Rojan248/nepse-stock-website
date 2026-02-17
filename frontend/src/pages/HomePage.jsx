import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMarketSummary, getStocks, getSectors } from '../services/api';
import StockTable from '../components/StockTable';
import SummaryCard from '../components/SummaryCard';
import SectorChart from '../components/SectorChart';
import MarketBreadthCard from '../components/MarketBreadthCard';
import LoadingSpinner from '../components/LoadingSpinner';
import TrendingBar from '../components/TrendingBar';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import SearchBar from '../components/SearchBar';
import { formatNumber, formatPercent, formatTurnover, getChangeClass } from '../utils/formatting';
import { ITEMS_PER_PAGE } from '../utils/constants';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { Star, ChevronDown } from 'lucide-react';
import HomePageSkeleton from '../components/skeletons/HomePageSkeleton';
import './HomePage.css';

// Live update interval - 15 seconds
const LIVE_UPDATE_INTERVAL = 60000;
// Page size for fetching from server (larger batches)
const FETCH_PAGE_SIZE = 100;

// ==================== Data Fetching ====================

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

// ==================== Filter Helpers ====================

/** Check if two strings match exactly or one contains the other */
const exactOrSubstringMatch = (a, b) => a === b || a.includes(b) || b.includes(a);

/** Strip trailing 's' for plural normalization */
const stripPlural = (s) => s.endsWith('s') ? s.slice(0, -1) : s;

/** Fuzzy sector match with plural normalization */
function matchesSector(stock, sector) {
    if (!stock.sector) return false;
    const s = stock.sector.toLowerCase().trim();
    const f = sector.toLowerCase().trim();
    return exactOrSubstringMatch(s, f) || stripPlural(s) === stripPlural(f);
}

/** Filter stock by change direction */
function matchesStatus(stock, status) {
    const change = stock.change || stock.prices?.change || 0;
    if (status === 'advanced') return change > 0;
    if (status === 'declined') return change < 0;
    if (status === 'unchanged') return change === 0;
    return true;
}

/** Filter stock by symbol or company name search */
function matchesSearch(stock, query) {
    const symbol = (stock.symbol || '').toLowerCase();
    const name = (stock.companyName || '').toLowerCase();
    return symbol.includes(query) || name.includes(query);
}

/** Apply all active filters to a stock list */
function applyFilters(stocks, { selectedSector, statusFilter, globalSearch, showFavoritesOnly, favorites }) {
    let result = stocks;
    if (selectedSector !== 'all') {
        result = result.filter(s => matchesSector(s, selectedSector));
    }
    if (statusFilter !== 'all') {
        result = result.filter(s => matchesStatus(s, statusFilter));
    }
    if (globalSearch && globalSearch.trim()) {
        const q = globalSearch.toLowerCase().trim();
        result = result.filter(s => matchesSearch(s, q));
    }
    if (showFavoritesOnly) {
        result = result.filter(s => favorites.includes(s.symbol));
    }
    return result;
}

// ==================== Display Helpers ====================

/** Format raw turnover into { value, unit } */
function formatTurnoverDisplay(raw) {
    if (raw >= 10000000) {
        return { value: (raw / 10000000).toFixed(2), unit: 'Cr' };
    }
    return { value: (raw / 100000).toFixed(2), unit: 'L' };
}

/** Get stock's change percent, resolving nested shapes */
function getChangePercent(stock) {
    return stock.changePercent || stock.prices?.changePercent || 0;
}

// ==================== Custom Hooks ====================

/** Computes market breadth from API data with stock-derived fallback */
function useMarketBreadth(stocks, marketSummary) {
    return useMemo(() => {
        const fromApi = {
            advanced: marketSummary?.advancedCompanies ?? null,
            declined: marketSummary?.declinedCompanies ?? null,
            unchanged: marketSummary?.unchangedCompanies ?? null
        };

        if (fromApi.advanced !== null) return fromApi;

        if (!stocks || stocks.length === 0) {
            return { advanced: 0, declined: 0, unchanged: 0 };
        }

        return {
            advanced: stocks.filter(s => getChangePercent(s) > 0).length,
            declined: stocks.filter(s => getChangePercent(s) < 0).length,
            unchanged: stocks.filter(s => getChangePercent(s) === 0).length
        };
    }, [stocks, marketSummary]);
}

/** Fetches and auto-refreshes market summary + sectors */
function useMarketData() {
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
            console.error('Failed to fetch market data:', err);
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

/** Fetches and auto-refreshes all stocks */
function useStockData() {
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
            console.error('Failed to fetch stocks:', err);
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

/** Derives filtered + paginated stock list from raw stocks and filter state */
function useFilteredStocks(stocks, filters, currentPage) {
    const filtered = useMemo(
        () => applyFilters(stocks, filters),
        [stocks, filters.selectedSector, filters.globalSearch, filters.showFavoritesOnly, filters.favorites, filters.statusFilter]
    );
    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    const display = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filtered.slice(start, start + ITEMS_PER_PAGE);
    }, [filtered, currentPage]);
    return { filtered, display, totalPages };
}

// ==================== Sub-Components ====================

/** Market summary cards section */
function MarketSummarySection({ marketSummary, marketStats, statusFilter, onStatusChange }) {
    const turnoverRaw = marketSummary?.totalTurnover || 0;
    const turnover = formatTurnoverDisplay(turnoverRaw);

    const indexValueDisplay = Number.isFinite(marketSummary?.indexValue)
        ? marketSummary.indexValue.toFixed(2)
        : '--';
    const indexChangePercent = Number.isFinite(marketSummary?.indexChangePercent)
        ? marketSummary.indexChangePercent
        : undefined;

    return (
        <section className="market-overview">
            <div className="section-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 className="section-title text-2xl" style={{ margin: 0 }}>Market Summary</h2>
            </div>
            <div className="market-cards">
                <SummaryCard
                    label="NEPSE Index"
                    value={indexValueDisplay}
                    change={indexChangePercent}
                    valueKey="nepse-index"
                />
                <div className="summary-card">
                    <div className="summary-label">TURNOVER</div>
                    <div className="summary-value" style={{ display: 'flex', alignItems: 'baseline', columnGap: '6px' }}>
                        <span className="currency-symbol" style={{ fontSize: '0.6em', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Rs</span>
                        <span className="number">{turnover.value}</span>
                        <span className="unit" style={{ fontSize: '0.6em', color: 'var(--text-secondary)' }}>{turnover.unit}</span>
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
            <MarketBreadthCard
                marketStats={marketStats}
                statusFilter={statusFilter}
                onFilterChange={onStatusChange}
            />
        </section>
    );
}

/** Toolbar with watchlist toggle and sector filter */
function StocksToolbar({ stockCount, showFavoritesOnly, setShowFavoritesOnly, favorites, sectors, selectedSector, setSelectedSector }) {
    return (
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 section-header">
            <h2 className="text-xl font-bold tracking-tight text-primary section-title">
                All Stocks <span className="text-stone-400 font-normal ml-1" style={{ fontSize: '0.9em', color: 'var(--text-muted)' }}>({stockCount})</span>
            </h2>
            <div className="flex items-center gap-3 w-full md:w-auto filters">
                <button
                    onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                    className={`watchlist-btn ${showFavoritesOnly ? 'active' : ''}`}
                >
                    <div className="icon-container">
                        <svg className="star-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
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
                <Select
                    value={selectedSector}
                    onChange={(e) => setSelectedSector(e.target.value)}
                    options={[{ label: 'ALL SECTORS', value: 'all' }, ...sectors.map(s => ({ label: s, value: s }))]}
                    placeholder="ALL SECTORS"
                />
            </div>
        </div>
    );
}

// ==================== HomePage ====================

function HomePage({ globalSearch }) {
    const navigate = useNavigate();
    const { marketSummary, sectors, error, setError } = useMarketData();
    const { stocks, loading } = useStockData();

    const [selectedSector, setSelectedSector] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [favorites, setFavorites] = useLocalStorage('nepse-favorites', []);
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => { setCurrentPage(1); }, [selectedSector, globalSearch, statusFilter]);

    const handleStockClick = (stock) => navigate(`/stock/${stock.symbol}`);

    const toggleFavorite = useCallback((symbol) => {
        setFavorites(prev => prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol]);
    }, [setFavorites]);

    const filters = { selectedSector, statusFilter, globalSearch, showFavoritesOnly, favorites };
    const { display: displayStocks, totalPages } = useFilteredStocks(stocks, filters, currentPage);
    const marketStats = useMarketBreadth(stocks, marketSummary);

    const { ref: sectorRef, isVisible: sectorVisible } = useScrollReveal(0.1);
    const { ref: stocksRef, isVisible: stocksVisible } = useScrollReveal(0.1);

    if (loading && !stocks.length) {
        return <HomePageSkeleton />;
    }

    return (
        <div className="home-page layout-container">
            <MarketSummarySection
                marketSummary={marketSummary}
                marketStats={marketStats}
                statusFilter={statusFilter}
                onStatusChange={setStatusFilter}
            />

            <div ref={sectorRef} className={`scroll-fade ${sectorVisible ? 'visible' : ''}`}>
                <SectorChart stocks={stocks} />
            </div>

            <TrendingBar />

            <section ref={stocksRef} className={`stocks-section scroll-fade ${stocksVisible ? 'visible' : ''}`}>
                <StocksToolbar
                    stockCount={stocks.length}
                    showFavoritesOnly={showFavoritesOnly}
                    setShowFavoritesOnly={setShowFavoritesOnly}
                    favorites={favorites}
                    sectors={sectors}
                    selectedSector={selectedSector}
                    setSelectedSector={setSelectedSector}
                />
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
            </section>

            {error && (
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
            )}
        </div>
    );
}

export default HomePage;
