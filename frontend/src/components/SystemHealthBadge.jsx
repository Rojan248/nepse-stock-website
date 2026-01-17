import { useState, useEffect } from 'react';
import { Activity, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

/**
 * SystemHealthBadge - Displays real-time system health status
 * Features:
 * - Polls /api/health every 30 seconds
 * - Shows: Operational, Circuit Breaker Active, Data Delay, or System Outage
 * - Hover tooltip with details
 */
export default function SystemHealthBadge() {
    const [health, setHealth] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isHovered, setIsHovered] = useState(false);

    useEffect(() => {
        const fetchHealth = async () => {
            try {
                const res = await fetch('/api/health');

                if (!res.ok) throw new Error("API Unreachable");

                const data = await res.json();
                setHealth(data);
            } catch (err) {
                if (import.meta.env.DEV) console.error("Health check:", err);
                setHealth(null);
            } finally {
                setLoading(false);
            }
        };

        fetchHealth();
        const interval = setInterval(fetchHealth, 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading) return <div style={styles.loadingPlaceholder}>System Check...</div>;

    // Determine State
    const isOffline = !health || health.status === 'degraded' || health.status === 'error';
    const isCircuitOpen = health?.resilience?.circuitBreaker?.isOpen;
    const lastUpdateDate = health?.scheduler?.lastUpdate ? new Date(health.scheduler.lastUpdate) : null;
    const isStale = lastUpdateDate && (new Date() - lastUpdateDate > 24 * 60 * 60 * 1000);

    // Check if market is closed (anything other than OPEN)
    const marketState = health?.market?.state;
    const isMarketClosed = marketState && marketState !== 'OPEN';

    // Default: Systems Operational
    let badgeStyle = { ...styles.badge, ...styles.success };
    let icon = <CheckCircle size={16} style={{ marginRight: '6px' }} />;
    let label = "Systems Operational";

    // Priority: Market Closed (weekend/post-3pm) > Offline > Circuit Breaker > Stale > Healthy
    if (isMarketClosed && (isOffline || isCircuitOpen)) {
        // Show friendly "Market Closed" instead of error during non-trading hours
        badgeStyle = { ...styles.badge, ...styles.closed };
        icon = <Clock size={16} style={{ marginRight: '6px' }} />;
        label = "Market Closed";
    } else if (isOffline) {
        badgeStyle = { ...styles.badge, ...styles.error };
        icon = <AlertTriangle size={16} style={{ marginRight: '6px' }} />;
        label = "System Outage";
    } else if (isCircuitOpen) {
        badgeStyle = { ...styles.badge, ...styles.warning };
        icon = <Activity size={16} style={{ marginRight: '6px' }} />;
        label = "Circuit Breaker Active";
    } else if (isStale) {
        badgeStyle = { ...styles.badge, ...styles.stale };
        icon = <Clock size={16} style={{ marginRight: '6px' }} />;
        label = "Data Delay";
    }

    return (
        <div
            style={badgeStyle}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {icon}
            <span>{label}</span>

            {/* Tooltip Popup */}
            {isHovered && (
                <div style={styles.tooltip}>
                    <div style={styles.tooltipArrow}></div>
                    <p style={{ margin: '0 0 4px 0' }}>
                        <strong>Last Sync:</strong> {lastUpdateDate ? lastUpdateDate.toLocaleTimeString() : 'N/A'}
                    </p>
                    <p style={{ margin: 0 }}>
                        <strong>Active Stocks:</strong> {health?.data?.stockCount || 'N/A'}
                    </p>
                    {isCircuitOpen && (
                        <p style={{ margin: '4px 0 0 0', color: '#ffcc00' }}>⚠️ Circuit Breaker Open</p>
                    )}
                </div>
            )}
        </div>
    );
}

const styles = {
    loadingPlaceholder: {
        padding: '4px 12px',
        backgroundColor: '#f3f4f6',
        borderRadius: '9999px',
        fontSize: '11px',
        color: '#6b7280',
        display: 'inline-block'
    },
    badge: {
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 12px',
        borderRadius: '9999px',
        fontSize: '12px',
        fontWeight: '600',
        border: '1px solid transparent',
        cursor: 'default',
        position: 'relative',
        transition: 'all 0.2s ease',
        whiteSpace: 'nowrap'
    },
    success: {
        backgroundColor: '#dcfce7',
        color: '#166534',
        borderColor: '#bbf7d0'
    },
    warning: {
        backgroundColor: '#ffedd5',
        color: '#9a3412',
        borderColor: '#fed7aa'
    },
    stale: {
        backgroundColor: '#fef9c3',
        color: '#854d0e',
        borderColor: '#fde047'
    },
    error: {
        backgroundColor: '#fee2e2',
        color: '#991b1b',
        borderColor: '#fecaca'
    },
    closed: {
        backgroundColor: '#dbeafe',
        color: '#1e40af',
        borderColor: '#93c5fd'
    },
    tooltip: {
        position: 'absolute',
        top: '120%',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: '#1f2937',
        color: 'white',
        padding: '8px 12px',
        borderRadius: '6px',
        fontSize: '11px',
        whiteSpace: 'nowrap',
        zIndex: 100,
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    },
    tooltipArrow: {
        position: 'absolute',
        bottom: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        borderWidth: '5px',
        borderStyle: 'solid',
        borderColor: 'transparent transparent #1f2937 transparent'
    }
};
