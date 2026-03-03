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

const MOVER_STYLES = {
    '1': { class: 'positive', icon: '▲', prefix: '+' },
    '-1': { class: 'negative', icon: '▼', prefix: '−' },
    '0': { class: '', icon: '', prefix: '' }
};

const FormattedMoverCard = ({ stock, activeTab, onClick }) => {
    const sign = Math.sign(stock.change).toString();
    const style = MOVER_STYLES[sign] || MOVER_STYLES['0'];

    return (
        <div className={`mover-card ${activeTab}`} onClick={() => onClick(stock)}>
            <div className="card-header">
                <span className="symbol">{stock.symbol}</span>
                <span className="sector-badge">{stock.sector || 'Others'}</span>
            </div>
            <div className="company-name">{stock.companyName}</div>
            <div className="ltp"><span className="currency">Rs</span> {formatNumber(stock.ltp)}</div>
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
};

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

    const getActiveStocks = () => {
        const stockMap = { gainers, losers, unchanged, traded };
        return stockMap[activeTab] || [];
    };

    const activeStocks = getActiveStocks();

    return (
        <div className="top-movers-page layout-container">
            {/* Top Metrics Bar */}
            <section className="top-metrics-bar">
                <div className="top-metric-card">
                    <span className="top-metric-label">GAINERS</span>
                    <span className="top-metric-value gainers">{marketSummary?.advancedCompanies || 0}</span>
                </div>
                <div className="top-metric-card">
                    <span className="top-metric-label">LOSERS</span>
                    <span className="top-metric-value losers">{marketSummary?.declinedCompanies || 0}</span>
                </div>
                <div className="top-metric-card">
                    <span className="top-metric-label">UNCHANGED</span>
                    <span className="top-metric-value unchanged">{marketSummary?.unchangedCompanies || 0}</span>
                </div>
                <div className="top-metric-card">
                    <span className="top-metric-label">TRADED</span>
                    <span className="top-metric-value traded">{marketSummary?.activeCompanies || 0}</span>
                </div>
            </section>

            {/* Tabs */}
            <div className="tab-switcher">
                <button
                    className={activeTab === 'gainers' ? 'active' : ''}
                    onClick={() => setActiveTab('gainers')}
                >
                    Gainers
                </button>
                <button
                    className={activeTab === 'losers' ? 'active' : ''}
                    onClick={() => setActiveTab('losers')}
                >
                    Losers
                </button>
                <button
                    className={activeTab === 'unchanged' ? 'active' : ''}
                    onClick={() => setActiveTab('unchanged')}
                >
                    Unchanged
                </button>
                <button
                    className={activeTab === 'traded' ? 'active' : ''}
                    onClick={() => setActiveTab('traded')}
                >
                    Traded
                </button>
            </div>

            {/* Content */}
            <div className="tab-content">
                {loading ? (
                    <LoadingSpinner text="Loading stocks..." />
                ) : (
                    <div className="top-movers-grid">
                        {activeStocks.length > 0 ? (
                            activeStocks.map((stock) => (
                                <FormattedMoverCard
                                    key={stock.symbol}
                                    stock={stock}
                                    activeTab={activeTab}
                                    onClick={handleStockClick}
                                />
                            ))
                        ) : (
                            <div className="empty-state">
                                <p>No {activeTab} available at the moment</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default TopMoversPage;
