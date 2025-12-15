import { useState } from 'react';
import { useIPOs } from '../hooks/useIPOs';
import IPOCard from '../components/IPOCard';
import LoadingSpinner from '../components/LoadingSpinner';
import { IPO_STATUSES } from '../utils/constants';
import './IPOPage.css';

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
            <header className="ipo-header">
                <h1>IPO Listings</h1>
                <p>Browse upcoming, active, and completed Initial Public Offerings</p>
            </header>

            {/* Statistics */}
            <section className="ipo-statistics">
                <div className="stat-card">
                    <span className="stat-number">{statistics.upcoming || 0}</span>
                    <span className="stat-label">Upcoming</span>
                </div>
                <div className="stat-card stat-open">
                    <span className="stat-number">{statistics.open || 0}</span>
                    <span className="stat-label">Open</span>
                </div>
                <div className="stat-card">
                    <span className="stat-number">{statistics.closed || 0}</span>
                    <span className="stat-label">Closed</span>
                </div>
                <div className="stat-card">
                    <span className="stat-number">{statistics.completed || 0}</span>
                    <span className="stat-label">Completed</span>
                </div>
            </section>

            {/* Status Tabs */}
            <section className="status-tabs">
                {IPO_STATUSES.map((status) => (
                    <button
                        key={status.value}
                        className={`tab-btn ${selectedStatus === status.value ? 'active' : ''}`}
                        onClick={() => setSelectedStatus(status.value)}
                    >
                        {status.label}
                        {status.value !== 'all' && statistics[status.value] > 0 && (
                            <span className="tab-count">{statistics[status.value]}</span>
                        )}
                    </button>
                ))}
            </section>

            {/* IPO Grid */}
            <section className="ipo-grid-section">
                {error && (
                    <div className="error-message">
                        <p>Failed to load IPOs. Please try again later.</p>
                    </div>
                )}

                {!loading && ipos.length === 0 && (
                    <div className="no-ipos">
                        <span className="no-ipos-icon">📋</span>
                        <h3>No IPOs Found</h3>
                        <p>No {selectedStatus === 'all' ? '' : selectedStatus} IPOs available at the moment.</p>
                    </div>
                )}

                <div className="ipo-grid">
                    {ipos.map((ipo, index) => (
                        <IPOCard
                            key={ipo._id || index}
                            ipo={ipo}
                        />
                    ))}
                </div>
            </section>
        </div>
    );
}

export default IPOPage;
