import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getServerHealth } from '../services/api';
import { useStockDetail } from '../hooks/useStocks';
import { useStocks } from '../hooks/useStocks';
import StockCard from '../components/StockCard';
import LoadingSpinner from '../components/LoadingSpinner';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { formatPrice, formatNumber, formatPercent, formatTurnover, formatTimestamp, getChangeClass } from '../utils/formatting';
import './StockDetailPage.css';

function StockDetailPage() {
    const { symbol } = useParams();
    const navigate = useNavigate();
    const { stock, loading, error } = useStockDetail(symbol);
    const { stocks } = useStocks(1, 100);
    const [healthStatus, setHealthStatus] = useState(null);

    // Fetch server health status
    useEffect(() => {
        const checkHealth = async () => {
            const health = await getServerHealth();
            setHealthStatus(health?.status === 'ok' ? 'healthy' : 'degraded');
        };
        checkHealth();
        const interval = setInterval(checkHealth, 30000);
        return () => clearInterval(interval);
    }, []);

    // Get related stocks (same sector)
    const relatedStocks = stocks
        .filter(s => s.sector === stock?.sector && s.symbol !== stock?.symbol)
        .slice(0, 4);

    if (loading) {
        return <LoadingSpinner fullPage text="Loading stock details..." />;
    }

    if (error || !stock) {
        return (
            <div className="stock-detail-page layout-container">
                <div className="error-state">
                    <h2>Stock Not Found</h2>
                    <p>Could not find stock with symbol: {symbol}</p>
                    <Button variant="primary" onClick={() => navigate('/')}>
                        Back to Home
                    </Button>
                </div>
            </div>
        );
    }

    const prices = stock.prices || {};
    const trading = stock.trading || {};

    const ltp = stock.ltp || prices.ltp || stock.close || 0;
    const open = stock.open || prices.open || 0;
    const high = stock.high || prices.high || 0;
    const low = stock.low || prices.low || 0;
    const previousClose = stock.previousClose || prices.previousClose || stock.close || 0; // Fallback to close if prevClose missing

    // Fix: If LTP is 0 (no trades), use previous close
    const displayLtp = ltp > 0 ? ltp : previousClose;

    const volume = stock.volume || trading.volume || 0;
    const turnover = stock.turnover || trading.turnover || 0;
    const transactions = stock.noOfTransactions || trading.totalTrades || 0;
    const marketCap = stock.marketCap || 0;

    const changeVal = stock.change !== undefined ? stock.change : (prices.change || 0);
    const changePercentVal = stock.changePercent !== undefined ? stock.changePercent : (prices.changePercent || 0);

    const changeClass = getChangeClass(changeVal); // Use value for color!
    const changeValue = changeVal.toFixed(2);
    const changePercent = formatPercent(changePercentVal);

    return (
        <div className="stock-detail-page layout-container">
            {/* Back Link */}
            <Button
                variant="ghost"
                className="back-button-elevated"
                onClick={() => navigate('/')}
                icon={<span>←</span>}
            >
                Back to All Stocks
            </Button>

            {/* Stock Hero */}
            <section className="stock-hero">
                <div className="hero-left">
                    <div className="hero-heading">
                        <h1 className="stock-symbol-large">{stock.symbol}</h1>
                        <Badge variant="primary" className="sector-badge">{stock.sector || 'Others'}</Badge>
                    </div>
                    <h2 className="stock-company-name">{stock.companyName}</h2>
                </div>
                <div className="hero-right">
                    <span className="hero-price">{formatPrice(displayLtp)}</span>
                    <span className={`hero-change ${changeClass}`}>
                        {`${changeVal >= 0 ? '+' : ''}${changeValue}`}
                        <span className="hero-change-percent">
                            ({changePercent})
                        </span>
                    </span>
                    <div className="hero-updated">
                        <span className={`status-dot ${healthStatus || 'degraded'}`}></span>
                        <span className="hero-updated-text">
                            Updated {formatTimestamp(stock.timestamp || stock.updatedAt)}
                        </span>
                    </div>
                </div>
            </section>

            {/* 2-Column Layout: Metrics & Summary */}
            <section className="stock-detail-layout">
                {/* Left: Key Metrics Cards */}
                <div className="metrics-column">
                    <h3 className="column-title">Key Metrics</h3>
                    <div className="metrics-grid">
                        <div className="metric-card">
                            <span className="metric-label">Open</span>
                            <span className="metric-value">{formatPrice(open)}</span>
                        </div>
                        <div className="metric-card">
                            <span className="metric-label">High</span>
                            <span className="metric-value price-up">{formatPrice(high)}</span>
                        </div>
                        <div className="metric-card">
                            <span className="metric-label">Low</span>
                            <span className="metric-value price-down">{formatPrice(low)}</span>
                        </div>
                        <div className="metric-card">
                            <span className="metric-label">Previous Close</span>
                            <span className="metric-value">{formatPrice(previousClose)}</span>
                        </div>
                        <div className="metric-card">
                            <span className="metric-label">Volume</span>
                            <span className="metric-value">{formatNumber(volume)}</span>
                        </div>
                        <div className="metric-card">
                            <span className="metric-label">Turnover</span>
                            <span className="metric-value">{formatTurnover(turnover)}</span>
                        </div>
                        <div className="metric-card">
                            <span className="metric-label">Transactions</span>
                            <span className="metric-value">{formatNumber(transactions)}</span>
                        </div>
                        <div className="metric-card">
                            <span className="metric-label">Market Cap</span>
                            <span className="metric-value">{formatTurnover(marketCap)}</span>
                        </div>
                    </div>
                </div>

                {/* Right: Price Summary & Related Stocks */}
                <div className="summary-column">
                    {/* Price Summary */}
                    <div className="price-summary-card">
                        <h3 className="card-title">Price Summary</h3>
                        <div className="price-range">
                            <div className="range-item">
                                <span className="range-label">Day Range</span>
                                <div className="range-bar">
                                    <span className="range-low">{formatPrice(low)}</span>
                                    <div className="range-track">
                                        <div
                                            className="range-indicator"
                                            style={{
                                                left: `${((displayLtp - low) / (high - low)) * 100 || 50}%`
                                            }}
                                        ></div>
                                    </div>
                                    <span className="range-high">{formatPrice(high)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Related Stocks */}
                    {relatedStocks.length > 0 && (
                        <div className="related-section">
                            <h3 className="card-title">Related in {stock.sector}</h3>
                            <div className="related-grid">
                                {relatedStocks.map((s) => (
                                    <StockCard
                                        key={s.symbol}
                                        stock={s}
                                        onClick={() => navigate(`/stock/${s.symbol}`)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}

export default StockDetailPage;
