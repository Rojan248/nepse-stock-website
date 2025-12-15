import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTopStocks } from '../hooks/useStocks';
import { getMarketSummary } from '../services/api';
import StockCard from '../components/StockCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { formatPrice, formatNumber, formatPercent, formatTurnover, getChangeClass } from '../utils/formatting';
import metricGainers from '../assets/img/metric-gainers.jpg';
import metricLosers from '../assets/img/metric-losers.jpg';
import metricUnchanged from '../assets/img/metric-unchanged.jpg';
import metricTraded from '../assets/img/metric-traded.jpg';
import './TopMoversPage.css';

function TopMoversPage() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('gainers');
    const [marketSummary, setMarketSummary] = useState(null);
    const { gainers, losers, loading } = useTopStocks(20);

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

    return (
        <div className="top-movers-page layout-container">
            {/* Top Metrics Bar */}
            <section className="top-metrics-bar">
                <div className="top-metric-card">
                    <img src={metricGainers} alt="Gainers" className="top-metric-icon" />
                    <span className="top-metric-value gainers">{marketSummary?.advancedCompanies || 0}</span>
                    <span className="top-metric-label">Gainers</span>
                </div>
                <div className="top-metric-card">
                    <img src={metricLosers} alt="Losers" className="top-metric-icon" />
                    <span className="top-metric-value losers">{marketSummary?.declinedCompanies || 0}</span>
                    <span className="top-metric-label">Losers</span>
                </div>
                <div className="top-metric-card">
                    <img src={metricUnchanged} alt="Unchanged" className="top-metric-icon" />
                    <span className="top-metric-value unchanged">{marketSummary?.unchangedCompanies || 0}</span>
                    <span className="top-metric-label">Unchanged</span>
                </div>
                <div className="top-metric-card">
                    <img src={metricTraded} alt="Traded" className="top-metric-icon" />
                    <span className="top-metric-value traded">{marketSummary?.activeCompanies || 0}</span>
                    <span className="top-metric-label">Traded</span>
                </div>
            </section>

            {/* Tabs */}
            <div className="tabs">
                <button
                    className={`tab ${activeTab === 'gainers' ? 'tab-active' : ''}`}
                    onClick={() => setActiveTab('gainers')}
                >
                    <span className="tab-icon">▲</span>
                    Top Gainers
                    {!loading && <span className="tab-count">{gainers.length}</span>}
                </button>
                <button
                    className={`tab ${activeTab === 'losers' ? 'tab-active' : ''}`}
                    onClick={() => setActiveTab('losers')}
                >
                    <span className="tab-icon">▼</span>
                    Top Losers
                    {!loading && <span className="tab-count">{losers.length}</span>}
                </button>
            </div>

            {/* Content */}
            <div className="tab-content">
                {loading ? (
                    <LoadingSpinner text="Loading stocks..." />
                ) : (
                    <>
                        {activeTab === 'gainers' && (
                            <div className="stocks-grid">
                                {gainers.length > 0 ? (
                                    gainers.map((stock) => (
                                        <StockCard
                                            key={stock.symbol}
                                            stock={stock}
                                            onClick={handleStockClick}
                                        />
                                    ))
                                ) : (
                                    <div className="empty-state">
                                        <p>No gainers available at the moment</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'losers' && (
                            <div className="stocks-grid">
                                {losers.length > 0 ? (
                                    losers.map((stock) => (
                                        <StockCard
                                            key={stock.symbol}
                                            stock={stock}
                                            onClick={handleStockClick}
                                        />
                                    ))
                                ) : (
                                    <div className="empty-state">
                                        <p>No losers available at the moment</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default TopMoversPage;
