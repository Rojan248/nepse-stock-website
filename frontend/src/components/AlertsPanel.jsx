import React, { useState, useEffect } from 'react';
import { getAlerts, createAlert, deleteAlert } from '../services/api';

const EMPTY_ALERT = { symbol: '', condition: 'above', threshold: '' };

export function AlertsPanel() {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState(EMPTY_ALERT);
    const [error, setError] = useState('');

    const loadAlerts = () => {
        getAlerts()
            .then(data => setAlerts(Array.isArray(data) ? data : []))
            .catch(() => setAlerts([]))
            .finally(() => setLoading(false));
    };

    useEffect(() => { loadAlerts(); }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!form.symbol || !form.threshold) {
            setError('Symbol and threshold are required.');
            return;
        }

        try {
            await createAlert({
                symbol: form.symbol.toUpperCase(),
                condition: form.condition,
                threshold: parseFloat(form.threshold)
            });
            setForm(EMPTY_ALERT);
            loadAlerts();
        } catch (err) {
            setError(err.response?.data?.error?.message || 'Failed to create alert');
        }
    };

    const handleDelete = async (id) => {
        try {
            await deleteAlert(id);
            loadAlerts();
        } catch (err) {
            setError('Failed to delete alert');
        }
    };

    const update = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

    const activeAlerts = alerts.filter(a => a.triggeredAt === null && a.enabled);
    const triggeredAlerts = alerts.filter(a => a.triggeredAt !== null || !a.enabled);

    return (
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '1rem' }}>
            <h2 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-main)', paddingBottom: '0.5rem' }}>Price Alerts</h2>
            
            {error && <div className="auth-error" style={{ marginBottom: '1rem' }}>{error}</div>}

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)', borderRadius: 12, padding: '1.5rem', marginBottom: '2rem' }}>
                <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1rem' }}>Create New Alert</h3>
                <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <div style={{ flex: '1 1 120px' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Symbol</label>
                        <input value={form.symbol} onChange={update('symbol')} placeholder="e.g. NABIL" required
                            style={{ padding: '0.6rem', borderRadius: 8, border: '1px solid var(--border-subtle)', width: '100%', background: 'var(--bg-main)', color: 'var(--text-primary)' }} />
                    </div>
                    <div style={{ flex: '1 1 120px' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Condition</label>
                        <select value={form.condition} onChange={update('condition')}
                            style={{ padding: '0.6rem', borderRadius: 8, border: '1px solid var(--border-subtle)', width: '100%', background: 'var(--bg-main)', color: 'var(--text-primary)' }}>
                            <option value="above">Above Price</option>
                            <option value="below">Below Price</option>
                            <option value="pct_change">Price Drop/Spike</option>
                        </select>
                    </div>
                    <div style={{ flex: '1 1 120px' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Threshold</label>
                        <input type="number" step="0.01" value={form.threshold} onChange={update('threshold')} placeholder="Target" required
                            style={{ padding: '0.6rem', borderRadius: 8, border: '1px solid var(--border-subtle)', width: '100%', background: 'var(--bg-main)', color: 'var(--text-primary)' }} />
                    </div>
                    <button type="submit" className="auth-btn" style={{ flex: '0 0 auto', padding: '0.6rem 1.2rem', marginTop: 0 }}>Set Alert</button>
                </form>
            </div>

            {loading ? <p>Loading alerts...</p> : (
                <>
                    <div style={{ marginBottom: '2rem' }}>
                        <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Active Alerts</h3>
                        {activeAlerts.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No active alerts. Define targets above.</p> : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {activeAlerts.map(a => (
                                    <AlertItem key={a.id} alert={a} onDelete={() => handleDelete(a.id)} active />
                                ))}
                            </div>
                        )}
                    </div>

                    <div>
                        <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Triggered History</h3>
                        {triggeredAlerts.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No alerts triggered yet.</p> : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', opacity: 0.6 }}>
                                {triggeredAlerts.map(a => (
                                    <AlertItem key={a.id} alert={a} onDelete={() => handleDelete(a.id)} />
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

function AlertItem({ alert, onDelete, active }) {
    const isAbove = alert.condition === 'above';
    const conditionText = isAbove ? 'Greater than' : (alert.condition === 'below' ? 'Less than' : 'Delta crosses');
    const color = isAbove ? 'var(--success)' : (alert.condition === 'below' ? 'var(--danger)' : 'var(--text-primary)');

    return (
        <div style={{ 
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
            padding: '1rem', background: 'var(--bg-card)', border: '1px solid var(--border-main)', borderRadius: 10 
        }}>
            <div>
                <span style={{ fontWeight: 700, marginRight: '1rem', fontSize: '1.05rem' }}>{alert.symbol}</span>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{conditionText} </span>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color }}>NPR {Number(alert.threshold).toLocaleString()}</span>
                {!active && alert.triggeredAt && (
                    <div style={{ fontSize: '0.75rem', marginTop: '0.2rem', color: 'var(--text-muted)' }}>
                        Triggered on: {new Date(alert.triggeredAt).toLocaleString()}
                    </div>
                )}
            </div>
            <button onClick={onDelete} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}>&times;</button>
        </div>
    );
}

export default AlertsPanel;
