import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

const METRIC_KEYS = [
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'open', label: 'Open' },
    { key: 'closed', label: 'Closed' },
    { key: 'completed', label: 'Completed' }
];

/** Renders the four IPO status metric cards */
function IPOMetricsBar({ statistics }) {
    return (
        <section className="ipo-metrics-bar">
            {METRIC_KEYS.map(({ key, label }) => (
                <div className="ipo-metric-card" key={key}>
                    <span className="ipo-metric-label">{label}</span>
                    <span className={`ipo-metric-value ${key}`}>
                        {statistics[key] || 0}
                    </span>
                </div>
            ))}
        </section>
    );
}

/** Renders filter tabs for IPO statuses */
function IPOTabSwitcher({ selectedStatus, onSelect }) {
    return (
        <div className="tab-switcher">
            {STATUS_TABS.map((tab) => (
                <button
                    key={tab.value}
                    className={selectedStatus === tab.value ? 'active' : ''}
                    onClick={() => onSelect(tab.value)}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
}

/** Renders the IPO card grid with empty/error states */
function IPOGridContent({ ipos, loading, error, selectedStatus }) {
    const navigate = useNavigate();

    if (error) {
        return (
            <div className="empty-state">
                Failed to load IPOs. Please try again.
            </div>
        );
    }

    if (!loading && ipos.length === 0) {
        const statusLabel = selectedStatus === 'all' ? '' : selectedStatus + ' ';
        return (
            <div className="empty-state">
                No {statusLabel}IPOs found
            </div>
        );
    }

    return (
        <div className="ipo-grid" style={{ zIndex: 1 }}>
            {ipos.map((ipo, index) => (
                <IPOCard
                    key={ipo.id || ipo.symbol || index}
                    ipo={ipo}
                    onClick={(p) => navigate(`/stock/${p.symbol}`)}
                />
            ))}
        </div>
    );
}

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
            <IPOMetricsBar statistics={statistics} />
            <IPOTabSwitcher selectedStatus={selectedStatus} onSelect={setSelectedStatus} />
            <section className="ipo-grid-section">
                <IPOGridContent
                    ipos={ipos}
                    loading={loading}
                    error={error}
                    selectedStatus={selectedStatus}
                />
            </section>
        </div>
    );
}

export default IPOPage;

