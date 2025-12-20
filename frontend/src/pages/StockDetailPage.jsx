import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getServerHealth } from '../services/api';
import { useStockDetail } from '../hooks/useStocks';
import { useStocks } from '../hooks/useStocks';
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

    useEffect(() => {
        const checkHealth = async () => {
            const health = await getServerHealth();
            setHealthStatus(health?.status === 'ok' ? 'healthy' : 'degraded');
        };
        checkHealth();
        const interval = setInterval(checkHealth, 30000);
        return () => clearInterval(interval);
    }, []);

    const relatedStocks = stocks
        .filter(s => s.sector === stock?.sector && s.symbol !== stock?.symbol)
        .slice(0, 5);

    if (loading) {
        return <LoadingSpinner fullPage text="Loading stock details..." />;
    }

    if (error || !stock) {
        return (
            <div className="sdp">
                <div className="sdp__container">
                    <div className="sdp__error">
                        <h2>Stock Not Found</h2>
                        <p>Could not find stock with symbol: {symbol}</p>
                        <Button variant="primary" onClick={() => navigate('/')}>
                            Back to Home
                        </Button>
                    </div>
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
    const previousClose = stock.previousClose || prices.previousClose || stock.close || 0;
    const displayLtp = ltp > 0 ? ltp : previousClose;

    const volume = stock.volume || trading.volume || 0;
    const turnover = stock.turnover || trading.turnover || 0;

    const changeVal = stock.change !== undefined ? stock.change : (prices.change || 0);
    const changePercentVal = stock.changePercent !== undefined ? stock.changePercent : (prices.changePercent || 0);
    const changeClass = getChangeClass(changeVal);
    const changeSymbol = changeVal >= 0 ? '▲' : '▼';

    const rangePercent = high !== low ? ((displayLtp - low) / (high - low)) * 100 : 50;

    return (
        <div className="sdp">
            <div className="sdp__container">
                {/* Back Button */}
                <button className="sdp__back" onClick={() => navigate('/')}>
                    ← Back to All Stocks
                </button>

                {/* Stock Info Card */}
                <section className="sdp__header">
                    <div className="sdp__header-left">
                        <div className="sdp__symbol-row">
                            <h1 className="sdp__symbol">{stock.symbol}</h1>
                            <span className="sdp__sector">{stock.sector || 'Others'}</span>
                        </div>
                        <h2 className="sdp__company">{stock.companyName}</h2>
                    </div>
                    <div className="sdp__header-right">
                        <span className="sdp__price">{formatPrice(displayLtp)}</span>
                        <span className={`sdp__change ${changeClass}`}>
                            {changeSymbol} {changeVal >= 0 ? '+' : ''}{changeVal.toFixed(2)} ({formatPercent(changePercentVal)})
                        </span>
                        <span className="sdp__updated">
                            Updated {formatTimestamp(stock.timestamp || stock.updatedAt)}
                        </span>
                    </div>
                </section>

                {/* Key Metrics - 3 columns × 2 rows */}
                <section className="sdp__metrics">
                    <h3 className="sdp__section-title">Key Metrics</h3>
                    <div className="sdp__metrics-grid">
                        <div className="sdp__metric">
                            <span className="sdp__metric-label">Open</span>
                            <span className="sdp__metric-value">{formatPrice(open)}</span>
                        </div>
                        <div className="sdp__metric">
                            <span className="sdp__metric-label">High</span>
                            <span className="sdp__metric-value sdp__metric-value--up">{formatPrice(high)}</span>
                        </div>
                        <div className="sdp__metric">
                            <span className="sdp__metric-label">Low</span>
                            <span className="sdp__metric-value sdp__metric-value--down">{formatPrice(low)}</span>
                        </div>
                        <div className="sdp__metric">
                            <span className="sdp__metric-label">Prev Close</span>
                            <span className="sdp__metric-value">{formatPrice(previousClose)}</span>
                        </div>
                        <div className="sdp__metric">
                            <span className="sdp__metric-label">Volume</span>
                            <span className="sdp__metric-value">{formatNumber(volume)}</span>
                        </div>
                        <div className="sdp__metric">
                            <span className="sdp__metric-label">Turnover</span>
                            <span className="sdp__metric-value">{formatTurnover(turnover)}</span>
                        </div>
                    </div>
                </section>

                {/* Price Summary - Vertical Stack Layout */}
                <section className="sdp__summary">
                    <h3 className="sdp__section-title">Price Summary</h3>
                    <div className="sdp__range-stack">
                        <span className="sdp__range-label">Day Range</span>
                        <div className="sdp__range-values">
                            <span className="sdp__range-min">{formatPrice(low)}</span>
                            <span className="sdp__range-max">{formatPrice(high)}</span>
                        </div>
                        <div className="sdp__range-track">
                            <div className="sdp__range-indicator" style={{ left: `${rangePercent}%` }}></div>
                        </div>
                        <div className="sdp__range-current">
                            Current: <strong>{formatPrice(displayLtp)}</strong>
                        </div>
                    </div>
                </section>

                {/* Related Stocks */}
                {relatedStocks.length > 0 && (
                    <section className="sdp__related">
                        <h3 className="sdp__section-title">Related in {stock.sector}</h3>
                        <div className="sdp__related-table">
                            {relatedStocks.map((s) => {
                                const sChangeVal = s.change !== undefined ? s.change : 0;
                                const sChangePercent = s.changePercent !== undefined ? s.changePercent : 0;
                                const sChangeClass = getChangeClass(sChangeVal);
                                const sChangeSymbol = sChangeVal >= 0 ? '▲' : '▼';
                                const sLtp = s.ltp || s.close || 0;

                                return (
                                    <div
                                        key={s.symbol}
                                        className="sdp__related-row"
                                        onClick={() => navigate(`/stock/${s.symbol}`)}
                                    >
                                        <span className="sdp__related-symbol">{s.symbol}</span>
                                        <span className="sdp__related-name">{s.companyName}</span>
                                        <span className="sdp__related-ltp">{formatPrice(sLtp)}</span>
                                        <span className={`sdp__related-change ${sChangeClass}`}>
                                            {sChangeSymbol} {sChangeVal >= 0 ? '+' : ''}{sChangeVal.toFixed(2)} ({formatPercent(sChangePercent)})
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}

export default StockDetailPage;
