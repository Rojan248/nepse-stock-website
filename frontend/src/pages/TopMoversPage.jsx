import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTopStocks } from '../hooks/useStocks';
import { getMarketSummary } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatPrice, formatNumber, formatPercent, formatTurnover, getChangeClass } from '../utils/formatting';
import metricGainers from '../assets/img/metric-gainers.jpg';
import metricLosers from '../assets/img/metric-losers.jpg';
import metricUnchanged from '../assets/img/metric-unchanged.jpg';
import metricTraded from '../assets/img/metric-traded.jpg';
import './TopMoversPage.css';

const TABS = ['gainers', 'losers', 'unchanged', 'traded'];
const TAB_LABELS = { gainers: 'Gainers', losers: 'Losers', unchanged: 'Unchanged', traded: 'Traded' };

const METRIC_CARDS = [
    { key: 'advancedCompanies', label: 'GAINERS', cls: 'gainers' },
    { key: 'declinedCompanies', label: 'LOSERS', cls: 'losers' },
    { key: 'unchangedCompanies', label: 'UNCHANGED', cls: 'unchanged' },
    { key: 'activeCompanies', label: 'TRADED', cls: 'traded' },
];

function MetricsBar({ marketSummary }) {
    return (
        <section className="top-metrics-bar">
            {METRIC_CARDS.map(m => (
                <div className="top-metric-card" key={m.key}>
                    <span className="top-metric-label">{m.label}</span>
                    <span className={`top-metric-value ${m.cls}`}>{marketSummary?.[m.key] || 0}</span>
                </div>
            ))}
        </section>
    );
}

function TabSwitcher({ activeTab, setActiveTab }) {
    return (
        <div className="tab-switcher">
            {TABS.map(tab => (
                <button
                    key={tab}
                    className={activeTab === tab ? 'active' : ''}
                    onClick={() => setActiveTab(tab)}
                >
                    {TAB_LABELS[tab]}
                </button>
            ))}
        </div>
    );
}

const MOVER_STYLES = {
    '1': { class: 'positive', icon: '▲', prefix: '+' },
    '-1': { class: 'negative', icon: '▼', prefix: '−' },
    '0': { class: '', icon: '', prefix: '' }
};

function FormattedMoverCard({ stock, activeTab, onClick }) {
    const style = MOVER_STYLES[Math.sign(stock.change).toString()] || MOVER_STYLES['0'];
    return (
        <div className={`mover-card ${activeTab}`} onClick={() => onClick(stock)}>
            <div className="card-header">
                <span className="symbol">{stock.symbol}</span>
                <span className="sector-badge">{stock.sector || 'Others'}</span>
            </div>
            <div className="company-name">{stock.companyName}</div>
            <div className="ltp"><span className="currency">NPR</span> {formatNumber(stock.ltp)}</div>
            <div className="change-row">
                <span className={`change ${style.class}`}>
                    {style.icon} {style.prefix}{Math.abs(stock.change).toFixed(2)}
                </span>
                <span className={`percent ${style.class}`}>
                    ({style.prefix}{Math.abs(stock.changePercent).toFixed(2)}%)
                </span>
            </div>
            <div className="volume">Vol: {(stock.volume || stock.totalTradedQuantity || 0).toLocaleString()}</div>
            <button className="view-btn">View</button>
        </div>
    );
}

function StockGrid({ stocks, activeTab, onStockClick }) {
    if (stocks.length === 0) {
        return (
            <div className="empty-state">
                <p>No {activeTab} available at the moment</p>
            </div>
        );
    }
    return (
        <div className="top-movers-grid">
            {stocks.map(stock => (
                <FormattedMoverCard key={stock.symbol} stock={stock} activeTab={activeTab} onClick={onStockClick} />
            ))}
        </div>
    );
}

function TopMoversPage() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('gainers');
    const [marketSummary, setMarketSummary] = useState(null);
    const { gainers, losers, unchanged, traded, loading } = useTopStocks(20);

    useEffect(() => {
        const fetchMarketData = async () => {
            const summary = await getMarketSummary();
            setMarketSummary(summary);
        };
        fetchMarketData();
    }, []);

    const handleStockClick = (stock) => {
        navigate(`/stock/${stock.symbol}`);
    };

    const stockMap = { gainers, losers, unchanged, traded };
    const activeStocks = stockMap[activeTab] || [];

    return (
        <div className="top-movers-page layout-container">
            <MetricsBar marketSummary={marketSummary} />
            <TabSwitcher activeTab={activeTab} setActiveTab={setActiveTab} />

            {/* Content */}
            <div className="tab-content">
                {loading ? (
                    <LoadingSpinner text="Loading stocks..." />
                ) : (
                    <StockGrid stocks={activeStocks} activeTab={activeTab} onStockClick={handleStockClick} />
                )}
            </div>
        </div>
    );
}

export default TopMoversPage;
