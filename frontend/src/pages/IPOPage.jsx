import { useState } from 'react';
import { useIPOs } from '../hooks/useIPOs';
import IPOCard from '../components/IPOCard';
import LoadingSpinner from '../components/LoadingSpinner';
import './IPOPage.css';

const STATUS_TABS = [
    { value: 'all', label: 'ALL IPOs' },
    { value: 'open', label: 'OPEN' },
    { value: 'upcoming', label: 'UPCOMING' },
    { value: 'closed', label: 'CLOSED' },
    { value: 'completed', label: 'COMPLETED' }
];

function IPOPage() {
    const [selectedStatus, setSelectedStatus] = useState('all');
    const { ipos, statistics, loading, error } = useIPOs(
        selectedStatus === 'all' ? null : selectedStatus
    );

    if (loading && !ipos.length) {
        return <LoadingSpinner fullPage text="Loading IPOs..." />;
    }

    return (
        <div className="ipo-page layout-container">
            {/* Top Metrics Bar - Same style as Top Movers */}
            <section className="ipo-metrics-bar">
                <div className="ipo-metric-card">
                    <span className="ipo-metric-label">Upcoming</span>
                    <span className="ipo-metric-value upcoming">{statistics.upcoming || 0}</span>
                </div>
                <div className="ipo-metric-card">
                    <span className="ipo-metric-label">Open</span>
                    <span className="ipo-metric-value open">{statistics.open || 0}</span>
                </div>
                <div className="ipo-metric-card">
                    <span className="ipo-metric-label">Closed</span>
                    <span className="ipo-metric-value closed">{statistics.closed || 0}</span>
                </div>
                <div className="ipo-metric-card">
                    <span className="ipo-metric-label">Completed</span>
                    <span className="ipo-metric-value completed">{statistics.completed || 0}</span>
                </div>
            </section>

            {/* Tab Switcher - Black/White style like Top Movers */}
            <div className="tab-switcher">
                {STATUS_TABS.map((tab) => (
                    <button
                        key={tab.value}
                        className={selectedStatus === tab.value ? 'active' : ''}
                        onClick={() => setSelectedStatus(tab.value)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* IPO Grid */}
            <section className="ipo-grid-section">
                {error && (
                    <div className="empty-state">
                        Failed to load IPOs. Please try again.
                    </div>
                )}

                {!loading && ipos.length === 0 && !error && (
                    <div className="empty-state">
                        No {selectedStatus === 'all' ? '' : selectedStatus + ' '}IPOs found
                    </div>
                )}

                <div className="ipo-grid">
                    {ipos.map((ipo, index) => (
                        <IPOCard
                            key={ipo.id || ipo.symbol || index}
                            ipo={ipo}
                        />
                    ))}
                </div>
            </section>
        </div>
    );
}

export default IPOPage;
