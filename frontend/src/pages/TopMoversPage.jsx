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
                    <span className="top-metric-label">Gainers</span>
                    <span className="top-metric-value gainers">{marketSummary?.advancedCompanies || 0}</span>
                </div>
                <div className="top-metric-card">
                    <span className="top-metric-label">Losers</span>
                    <span className="top-metric-value losers">{marketSummary?.declinedCompanies || 0}</span>
                </div>
                <div className="top-metric-card">
                    <span className="top-metric-label">Unchanged</span>
                    <span className="top-metric-value unchanged">{marketSummary?.unchangedCompanies || 0}</span>
                </div>
                <div className="top-metric-card">
                    <span className="top-metric-label">Traded</span>
                    <span className="top-metric-value traded">{marketSummary?.activeCompanies || 0}</span>
                </div>
            </section>

            {/* Tabs */}
            <div className="tab-switcher">
                <button
                    className={activeTab === 'gainers' ? 'active' : ''}
                    onClick={() => setActiveTab('gainers')}
                >
                    Top Gainers
                </button>
                <button
                    className={activeTab === 'losers' ? 'active' : ''}
                    onClick={() => setActiveTab('losers')}
                >
                    Top Losers
                </button>
            </div>

            {/* Content */}
            <div className="tab-content">
                {loading ? (
                    <LoadingSpinner text="Loading stocks..." />
                ) : (
                    <div className="movers-table-wrapper">
                        {((activeTab === 'gainers' && gainers.length > 0) || (activeTab === 'losers' && losers.length > 0)) ? (
                            <table className="movers-table">
                                <thead>
                                    <tr>
                                        <th>Symbol</th>
                                        <th>Company</th>
                                        <th>Sector</th>
                                        <th className="text-right">LTP</th>
                                        <th className="text-right">Change</th>
                                        <th className="text-right">Change %</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(activeTab === 'gainers' ? gainers : losers).map((stock) => {
                                        const isPositive = stock.change > 0;
                                        const isNegative = stock.change < 0;
                                        const changeClass = isPositive ? 'positive' : isNegative ? 'negative' : '';

                                        return (
                                            <tr key={stock.symbol} onClick={() => handleStockClick(stock)} className="clickable-row">
                                                <td className="symbol">{stock.symbol}</td>
                                                <td className="company">{stock.companyName}</td>
                                                <td><span className="sector-badge">{stock.sector || 'Others'}</span></td>
                                                <td className="price text-right">{formatPrice(stock.ltp)}</td>
                                                <td className={`change text-right ${changeClass}`}>
                                                    {isPositive ? '+' : ''}{formatNumber(stock.change)}
                                                </td>
                                                <td className={`change-pct text-right ${changeClass}`}>
                                                    {isPositive ? '+' : ''}{formatPercent(stock.changePercent)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
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
