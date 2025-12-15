import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMarketSummary, getStocks, getSectors } from '../services/api';
import StockTable from '../components/StockTable';
import SummaryCard from '../components/SummaryCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatNumber, formatPercent, formatTurnover, getChangeClass } from '../utils/formatting';
import { ITEMS_PER_PAGE } from '../utils/constants';
import './HomePage.css';

// Live update interval - 15 seconds
const LIVE_UPDATE_INTERVAL = 15000;

function HomePage() {
    const navigate = useNavigate();
    const [marketSummary, setMarketSummary] = useState(null);
    const [stocks, setStocks] = useState([]);
    const [sectors, setSectors] = useState([]);
    const [selectedSector, setSelectedSector] = useState('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalStocks, setTotalStocks] = useState(0);
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

    // Fetch stocks with pagination
    const fetchStocks = useCallback(async (isInitial = false) => {
        if (!mountedRef.current) return;

        try {
            if (isInitial) {
                setLoading(true);
            }

            const result = await getStocks(currentPage, ITEMS_PER_PAGE);

            if (!mountedRef.current) return;

            setStocks(result.stocks || []);
            setTotalStocks(result.total || 0);
            setLastUpdated(new Date());
        } catch (err) {
            console.error('Failed to fetch stocks:', err);
            // Keep existing stocks on error - don't clear them
        } finally {
            if (mountedRef.current) {
                setLoading(false);
            }
        }
    }, [currentPage]);

    // Initial data fetch
    useEffect(() => {
        mountedRef.current = true;

        // Initial fetch
        fetchMarketData(true);
        fetchStocks(true);

        // Setup polling intervals
        marketIntervalRef.current = setInterval(() => {
            fetchMarketData(false);
        }, LIVE_UPDATE_INTERVAL);

        stocksIntervalRef.current = setInterval(() => {
            fetchStocks(false);
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
    }, [fetchMarketData, fetchStocks]);

    // Re-fetch stocks when page changes
    useEffect(() => {
        if (!loading) {
            fetchStocks(false);
        }
    }, [currentPage]);

    const handleStockClick = (stock) => {
        navigate(`/stock/${stock.symbol}`);
    };

    const filteredStocks = selectedSector === 'all'
        ? stocks
        : stocks.filter(s => s.sector?.toLowerCase().includes(selectedSector.toLowerCase()));

    const totalPages = Math.ceil(totalStocks / ITEMS_PER_PAGE);

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
                    <h3 className="section-title">All Stocks</h3>
                    <div className="filters">
                        <select
                            value={selectedSector}
                            onChange={(e) => setSelectedSector(e.target.value)}
                            className="sector-filter"
                        >
                            {sectors.map((sector) => (
                                <option key={sector} value={sector}>
                                    {sector === 'all' ? 'All Sectors' : sector}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                <StockTable
                    stocks={filteredStocks}
                    onRowClick={handleStockClick}
                    showPagination={true}
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                />
            </section>

            {/* Error toast (non-blocking) */}
            {error && (
                <div className="error-toast">
                    <span>{error}</span>
                    <button onClick={() => setError(null)}>×</button>
                </div>
            )}
        </div>
    );
}

export default HomePage;
