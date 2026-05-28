import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import StockTable from '../components/StockTable';
import SectorChart from '../components/SectorChart';
import TrendingBar from '../components/TrendingBar';
import Button from '../components/ui/Button';
import MarketSummarySection from '../components/MarketSummarySection';
import StocksToolbar from '../components/StocksToolbar';
import { useMarketData, useStockData } from '../hooks/useHomePageData';
import { useMarketBreadth, useFilteredStocks } from '../hooks/useFilters';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useAuth } from '../hooks/useAuth';
import { getWatchlists, importWatchlistItems, addWatchlistItem, removeWatchlistItem } from '../services/api';
import { useScrollReveal } from '../hooks/useScrollReveal';
import HomePageSkeleton from '../components/skeletons/HomePageSkeleton';
import './HomePage.css';


// ==================== Watchlist Helpers ====================

/** Merge server watchlist symbols into local favorites */
function mergeServerSymbols(setFavorites, serverItems) {
    const serverSymbols = (serverItems || []).map(i => i.symbol);
    setFavorites(prev => [...new Set([...prev, ...serverSymbols])]);
}

/** One-time migration of localStorage favorites to the server */
function migrateLocalFavorites(migrated, watchlistId, favorites) {
    if (migrated.current || favorites.length === 0) return;
    migrated.current = true;
    importWatchlistItems(watchlistId, favorites).catch(() => { });
}

/** Process the default watchlist after fetching */
function processWatchlist({ watchlist, setDefaultWatchlistId, setFavorites, migrated, favorites }) {
    setDefaultWatchlistId(watchlist.id);
    mergeServerSymbols(setFavorites, watchlist.items);
    migrateLocalFavorites(migrated, watchlist.id, favorites);
}

/** Sync a single favorite toggle to the API */
function syncFavoriteToApi(watchlistId, symbol, isFav) {
    if (!watchlistId) return;
    const action = isFav ? removeWatchlistItem : addWatchlistItem;
    action(watchlistId, symbol).catch(() => { });
}

// ==================== Watchlist Hook ====================

function useWatchlistSync() {
    const { isAuthenticated, loading: authLoading } = useAuth();
    const [favorites, setFavorites] = useLocalStorage('nepse-favorites', []);
    const [defaultWatchlistId, setDefaultWatchlistId] = useState(null);
    const migrated = useRef(false);

    useEffect(() => {
        if (authLoading) return;
        if (!isAuthenticated) { setDefaultWatchlistId(null); return; }
        getWatchlists().then(wls => {
            const list = Array.isArray(wls) ? wls : [];
            if (list.length > 0) {
                processWatchlist({ watchlist: list[0], setDefaultWatchlistId, setFavorites, migrated, favorites });
            }
        }).catch(() => { });
    }, [authLoading, isAuthenticated]);

    const toggleFavorite = useCallback((symbol) => {
        setFavorites(prev => {
            const isFav = prev.includes(symbol);
            syncFavoriteToApi(defaultWatchlistId, symbol, isFav);
            return isFav ? prev.filter(s => s !== symbol) : [...prev, symbol];
        });
    }, [setFavorites, defaultWatchlistId]);

    return { favorites, toggleFavorite };
}

// ==================== HomePage ====================

function HomePage({ globalSearch }) {
    const navigate = useNavigate();
    const { marketSummary, sectors, error, setError } = useMarketData();
    const { stocks, loading } = useStockData();
    const { favorites, toggleFavorite } = useWatchlistSync();

    const [selectedSector, setSelectedSector] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => { setCurrentPage(1); }, [selectedSector, globalSearch, statusFilter]);

    const handleStockClick = (stock) => navigate(`/stock/${stock.symbol}`);

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

            <div ref={sectorRef} className={`scroll-fade animate-up delay-1 ${sectorVisible ? 'visible' : ''}`}>
                <SectorChart stocks={stocks} />
            </div>

            <div className="animate-up delay-2">
                <TrendingBar />
            </div>

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
