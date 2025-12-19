import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMarketSummary, getStocks, getSectors } from '../services/api';
import StockTable from '../components/StockTable';
import SummaryCard from '../components/SummaryCard';
import LoadingSpinner from '../components/LoadingSpinner';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import { formatNumber, formatPercent, formatTurnover, getChangeClass } from '../utils/formatting';
import { ITEMS_PER_PAGE } from '../utils/constants';
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

function HomePage() {
    const navigate = useNavigate();
    const [marketSummary, setMarketSummary] = useState(null);
    const [stocks, setStocks] = useState([]);
    const [sectors, setSectors] = useState([]);
    const [selectedSector, setSelectedSector] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);

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
            setLastUpdated(new Date());
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

    // Reset page to 1 when sector filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedSector]);

    const handleStockClick = (stock) => {
        navigate(`/stock/${stock.symbol}`);
    };

    // Client-side filtering by sector
    const filteredStocks = useMemo(() => {
        if (selectedSector === 'all') {
            return stocks;
        }

        return stocks.filter(stock => {
            if (!stock.sector) return false;

            // Robust comparison
            const stockSector = stock.sector.toLowerCase().trim();
            const filterSector = selectedSector.toLowerCase().trim();

            // Direct match
            if (stockSector === filterSector) return true;

            // Partial match (e.g. "Commercial Bank" in "Commercial Banks")
            if (stockSector.includes(filterSector) || filterSector.includes(stockSector)) return true;

            // Pluralization check (remove trailing 's')
            const s1 = stockSector.endsWith('s') ? stockSector.slice(0, -1) : stockSector;
            const s2 = filterSector.endsWith('s') ? filterSector.slice(0, -1) : filterSector;

            return s1 === s2;
        });
    }, [stocks, selectedSector]);

    // Client-side pagination
    const totalPages = Math.max(1, Math.ceil(filteredStocks.length / ITEMS_PER_PAGE));

    const displayStocks = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        return filteredStocks.slice(start, end);
    }, [filteredStocks, currentPage]);

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

    if (loading && !stocks.length) {
        return <LoadingSpinner fullPage text="Loading market data..." />;
    }

    return (
        <div className="home-page layout-container">
            {/* Market Summary */}
            <section className="market-overview">
                <div className="section-header-row">
                    <h2 className="section-title">Market Summary</h2>
                </div>
                <div className="market-cards">
                    <SummaryCard
                        label="NEPSE Index"
                        value={marketSummary?.indexValue?.toFixed(2) || '--'}
                        change={marketSummary?.indexChangePercent}
                        valueKey="nepse-index"
                    />
                    <SummaryCard
                        label="Turnover"
                        value={formatTurnover(marketSummary?.totalTurnover)}
                        valueKey="turnover"
                    />
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
            </section>

            {/* All Stocks */}
            <section className="stocks-section">
                <div className="section-header">
                    <h3 className="section-title">All Stocks ({filteredStocks.length})</h3>
                    <div className="filters">
                        <Select
                            value={selectedSector}
                            onChange={(e) => setSelectedSector(e.target.value)}
                            options={sectors.map(s => ({ value: s, label: s === 'all' ? 'All Sectors' : s }))}
                            className="sector-filter"
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
                />
            </section>

            {/* Error toast (non-blocking) */}
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
