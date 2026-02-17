import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getServerHealth, getStockDepth } from '../services/api';
import { useStockDetail } from '../hooks/useStocks';
import { useStocks } from '../hooks/useStocks';
import LoadingSpinner from '../components/LoadingSpinner';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { MarketDepth, Floorsheet } from '../components/depth';
import { formatPrice, formatNumber, formatPercent, formatTurnover, formatTimestamp, getChangeClass } from '../utils/formatting';
import './StockDetailPage.css';

// ==================== Shared Helpers ====================

/** Resolve common stock price fields from various API shapes */
function resolveStockPrices(stock) {
    const prices = stock.prices || {};
    const trading = stock.trading || {};

    const ltp = stock.ltp || prices.ltp || stock.close || 0;
    const previousClose = stock.previousClose || prices.previousClose || stock.close || 0;
    const displayLtp = ltp > 0 ? ltp : previousClose;

    return {
        ltp,
        previousClose,
        displayLtp,
        open: stock.open || prices.open || stock.openPrice || displayLtp,
        high: stock.high || prices.high || stock.highPrice || displayLtp,
        low: stock.low || prices.low || stock.lowPrice || displayLtp,
        volume: stock.volume || trading.volume || 0,
        turnover: stock.turnover || trading.turnover || 0,
        change: stock.change ?? prices.change ?? 0,
        changePercent: stock.changePercent ?? prices.changePercent ?? 0,
    };
}

/** Format a change value with direction symbol */
function formatChangeDisplay(change, changePercent) {
    const sym = change >= 0 ? '▲' : '▼';
    const sign = change >= 0 ? '+' : '';
    return `${sym} ${sign}${change.toFixed(2)} (${formatPercent(changePercent)})`;
}

/** Check if depth data needs to be loaded */
function needsDepthFetch(activeTab, depthData, symbol) {
    const isDepthTab = activeTab === 'depth' || activeTab === 'floorsheet';
    return isDepthTab && !depthData && !!symbol;
}

// ==================== Tab Config ====================

const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'depth', label: 'Market Depth' },
    { key: 'floorsheet', label: 'Floorsheet' },
];

// ==================== Sub-Components ====================

/** Tab navigation bar */
function TabBar({ activeTab, onTabChange }) {
    return (
        <div className="sdp__tabs">
            {TABS.map(tab => (
                <button
                    key={tab.key}
                    className={`sdp__tab ${activeTab === tab.key ? 'active' : ''}`}
                    onClick={() => onTabChange(tab.key)}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
}

/** Stock header card with price and change */
function StockHeader({ stock, p, navigate }) {
    return (
        <section className="sdp__header">
            <div className="sdp__header-left">
                <div className="sdp__symbol-row">
                    <h1 className="sdp__symbol">{stock.symbol}</h1>
                    <span className="sdp__sector">{stock.sector || 'Others'}</span>
                </div>
                <h2 className="sdp__company">{stock.companyName}</h2>
            </div>
            <div className="sdp__header-right">
                <span className="sdp__price">{formatPrice(p.displayLtp)}</span>
                <span className={`sdp__change ${getChangeClass(p.change)}`}>
                    {formatChangeDisplay(p.change, p.changePercent)}
                </span>
                <span className="sdp__updated">
                    Updated {formatTimestamp(stock.timestamp || stock.updatedAt)}
                </span>
            </div>
        </section>
    );
}

/** Key metrics grid (Open, High, Low, Prev Close, Volume, Turnover) */
const METRICS = [
    { label: 'Open', field: 'open', format: formatPrice },
    { label: 'High', field: 'high', format: formatPrice, cls: 'sdp__metric-value--up' },
    { label: 'Low', field: 'low', format: formatPrice, cls: 'sdp__metric-value--down' },
    { label: 'Prev Close', field: 'previousClose', format: formatPrice },
    { label: 'Volume', field: 'volume', format: formatNumber },
    { label: 'Turnover', field: 'turnover', format: formatTurnover },
];

function KeyMetrics({ p }) {
    return (
        <section className="sdp__metrics">
            <h3 className="sdp__section-title">Key Metrics</h3>
            <div className="sdp__metrics-grid">
                {METRICS.map(m => (
                    <div className="sdp__metric" key={m.label}>
                        <span className="sdp__metric-label">{m.label}</span>
                        <span className={`sdp__metric-value ${m.cls || ''}`}>{m.format(p[m.field])}</span>
                    </div>
                ))}
            </div>
        </section>
    );
}

/** Day range indicator */
function PriceSummary({ p }) {
    const rangePercent = p.high !== p.low ? ((p.displayLtp - p.low) / (p.high - p.low)) * 100 : 50;
    return (
        <section className="sdp__summary">
            <h3 className="sdp__section-title">Price Summary</h3>
            <div className="sdp__range-stack">
                <span className="sdp__range-label">Day Range</span>
                <div className="sdp__range-values">
                    <span className="sdp__range-min">{formatPrice(p.low)}</span>
                    <span className="sdp__range-max">{formatPrice(p.high)}</span>
                </div>
                <div className="sdp__range-track">
                    <div className="sdp__range-indicator" style={{ left: `${rangePercent}%` }}></div>
                </div>
                <div className="sdp__range-current">
                    Current: <strong>{formatPrice(p.displayLtp)}</strong>
                </div>
            </div>
        </section>
    );
}

/** Single related stock row */
function RelatedStockRow({ s, navigate }) {
    const change = s.change ?? 0;
    const changePercent = s.changePercent ?? 0;
    const ltp = s.ltp || s.close || 0;

    return (
        <div className="sdp__related-row" onClick={() => navigate(`/stock/${s.symbol}`)}>
            <span className="sdp__related-symbol">{s.symbol}</span>
            <span className="sdp__related-name">{s.companyName}</span>
            <span className="sdp__related-ltp">{formatPrice(ltp)}</span>
            <span className={`sdp__related-change ${getChangeClass(change)}`}>
                {formatChangeDisplay(change, changePercent)}
            </span>
        </div>
    );
}

/** Related stocks section */
function RelatedStocks({ relatedStocks, sector, navigate }) {
    if (relatedStocks.length === 0) return null;
    return (
        <section className="sdp__related">
            <h3 className="sdp__section-title">Related in {sector}</h3>
            <div className="sdp__related-table">
                {relatedStocks.map(s => (
                    <RelatedStockRow key={s.symbol} s={s} navigate={navigate} />
                ))}
            </div>
        </section>
    );
}

// ==================== StockDetailPage ====================

function StockDetailPage() {
    const { symbol } = useParams();
    const navigate = useNavigate();
    const { stock, loading, error } = useStockDetail(symbol);
    const { stocks } = useStocks(1, 100);
    const [healthStatus, setHealthStatus] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');
    const [depthData, setDepthData] = useState(null);
    const [depthLoading, setDepthLoading] = useState(false);

    useEffect(() => {
        const checkHealth = async () => {
            const health = await getServerHealth();
            setHealthStatus(health?.status === 'ok' ? 'healthy' : 'degraded');
        };
        checkHealth();
        const interval = setInterval(checkHealth, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!needsDepthFetch(activeTab, depthData, symbol)) return;
        const fetchDepth = async () => {
            setDepthLoading(true);
            try {
                const data = await getStockDepth(symbol);
                setDepthData(data);
            } catch (err) {
                console.error('Failed to fetch depth:', err);
            } finally {
                setDepthLoading(false);
            }
        };
        fetchDepth();
    }, [activeTab, symbol, depthData]);

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

    const p = resolveStockPrices(stock);

    return (
        <div className="sdp">
            <div className="sdp__container">
                <button className="sdp__back" onClick={() => navigate('/')}>
                    ← Back to All Stocks
                </button>

                <StockHeader stock={stock} p={p} navigate={navigate} />
                <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

                <div className="sdp__tab-content">
                    {activeTab === 'overview' && (
                        <>
                            <KeyMetrics p={p} />
                            <PriceSummary p={p} />
                            <RelatedStocks relatedStocks={relatedStocks} sector={stock.sector} navigate={navigate} />
                        </>
                    )}
                    {activeTab === 'depth' && (
                        <MarketDepth symbol={symbol} data={depthData} loading={depthLoading} />
                    )}
                    {activeTab === 'floorsheet' && (
                        <Floorsheet symbol={symbol} data={depthData} loading={depthLoading} />
                    )}
                </div>
            </div>
        </div>
    );
}

export default StockDetailPage;
