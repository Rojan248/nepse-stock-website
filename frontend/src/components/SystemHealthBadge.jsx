import { useState, useEffect } from 'react';
import { Activity, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

// ==================== Constants ====================

const ICON_STYLE = { marginRight: '6px' };
const POLL_INTERVAL = 30000;
const STALE_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours

/** Badge configurations keyed by health state */
const HEALTH_STATES = {
    closed: { style: 'closed', icon: Clock, label: 'Market Closed' },
    offline: { style: 'error', icon: AlertTriangle, label: 'System Outage' },
    circuit: { style: 'warning', icon: Activity, label: 'Circuit Breaker Active' },
    stale: { style: 'stale', icon: Clock, label: 'Data Delay' },
    healthy: { style: 'success', icon: CheckCircle, label: 'Systems Operational' },
};

// ==================== Hooks ====================

/** Polls /api/health at a fixed interval */
function useHealthPolling() {
    const [health, setHealth] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHealth = async () => {
            try {
                const res = await fetch('/api/health');
                if (!res.ok) throw new Error('API Unreachable');
                setHealth(await res.json());
            } catch (err) {
                if (import.meta.env.DEV) console.error('Health check:', err);
                setHealth(null);
            } finally {
                setLoading(false);
            }
        };

        fetchHealth();
        const interval = setInterval(fetchHealth, POLL_INTERVAL);
        return () => clearInterval(interval);
    }, []);

    return { health, loading };
}

// ==================== Helpers ====================

/**
 * Determine the current health state from API data.
 * Priority: Market Closed > Offline > Circuit Breaker > Stale > Healthy
 * @returns {{ key: string, lastUpdateDate: Date|null, isCircuitOpen: boolean }}
 */
function getHealthState(health) {
    const isOffline = !health || health.status === 'degraded' || health.status === 'error';
    const isCircuitOpen = !!health?.resilience?.circuitBreaker?.isOpen;
    const lastUpdateDate = health?.scheduler?.lastUpdate ? new Date(health.scheduler.lastUpdate) : null;
    const isStale = lastUpdateDate && (Date.now() - lastUpdateDate > STALE_THRESHOLD);
    const marketState = health?.market?.state;
    const isMarketClosed = marketState && marketState !== 'OPEN';

    let key = 'healthy';
    if (isMarketClosed) key = 'closed';
    else if (isOffline) key = 'offline';
    else if (isCircuitOpen) key = 'circuit';
    else if (isStale) key = 'stale';

    return { key, lastUpdateDate, isCircuitOpen };
}

// ==================== Sub-components ====================

/** Hover tooltip showing sync time, stock count, and circuit breaker status */
function HealthTooltip({ lastUpdateDate, stockCount, isCircuitOpen }) {
    return (
        <div style={styles.tooltip}>
            <div style={styles.tooltipArrow}></div>
            <p style={{ margin: '0 0 4px 0' }}>
                <strong>Last Sync:</strong> {lastUpdateDate ? lastUpdateDate.toLocaleTimeString() : 'N/A'}
            </p>
            <p style={{ margin: 0 }}>
                <strong>Active Stocks:</strong> {stockCount || 'N/A'}
            </p>
            {isCircuitOpen && (
                <p style={{ margin: '4px 0 0 0', color: '#ffcc00' }}>⚠️ Circuit Breaker Open</p>
            )}
        </div>
    );
}

// ==================== Main Component ====================

export default function SystemHealthBadge() {
    const { health, loading } = useHealthPolling();
    const [isHovered, setIsHovered] = useState(false);

    if (loading) return <div style={styles.loadingPlaceholder}>System Check...</div>;

    const { key, lastUpdateDate, isCircuitOpen } = getHealthState(health);
    const config = HEALTH_STATES[key];
    const Icon = config.icon;
    const badgeStyle = { ...styles.badge, ...styles[config.style] };

    return (
        <div
            style={badgeStyle}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <Icon size={16} style={ICON_STYLE} />
            <span>{config.label}</span>

            {isHovered && (
                <HealthTooltip
                    lastUpdateDate={lastUpdateDate}
                    stockCount={health?.data?.stockCount}
                    isCircuitOpen={isCircuitOpen}
                />
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

