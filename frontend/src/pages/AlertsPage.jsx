import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getAlerts, createAlert, updateAlert, deleteAlert } from '../services/api';

function AlertsPage() {
    const { user } = useAuth();
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [form, setForm] = useState({ symbol: '', condition: 'above', threshold: '' });

    const loadAlerts = useCallback(() => {
        getAlerts()
            .then(data => setAlerts(Array.isArray(data) ? data : []))
            .catch(() => setAlerts([]))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { loadAlerts(); }, [loadAlerts]);

    const handleCreate = async (e) => {
        e.preventDefault();
        setError('');
        try {
            await createAlert({
                symbol: form.symbol.toUpperCase(),
                condition: form.condition,
                threshold: parseFloat(form.threshold)
            });
            setForm({ symbol: '', condition: 'above', threshold: '' });
            loadAlerts();
        } catch (err) {
            setError(err.response?.data?.error?.message || 'Failed to create alert');
        }
    };

    const handleToggle = async (id, enabled) => {
        try {
            await updateAlert(id, { enabled: !enabled });
            loadAlerts();
        } catch { setError('Failed to update alert'); }
    };

    const handleDelete = async (id) => {
        try {
            await deleteAlert(id);
            loadAlerts();
        } catch { setError('Failed to delete alert'); }
    };

    if (loading) {
        return <div className="page-container"><p>Loading alerts...</p></div>;
    }

    return (
        <div className="page-container" style={{ maxWidth: 700, margin: '0 auto', padding: '2rem 1rem' }}>
            <h1 style={{ marginBottom: '0.5rem' }}>Price Alerts</h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Get notified when stocks hit your target price</p>

            {error && <div className="auth-error" style={{ marginBottom: '1rem' }}>{error}</div>}

            {/* Create alert form */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)', borderRadius: 12, padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1rem' }}>New Alert</h3>
                <form onSubmit={handleCreate} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                    <input value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value }))} placeholder="Symbol" required
                        style={{ padding: '0.5rem', borderRadius: 8, border: '1px solid var(--border-main)', width: 100 }} />
                    <select value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}
                        style={{ padding: '0.5rem', borderRadius: 8, border: '1px solid var(--border-main)' }}>
                        <option value="above">Price Above</option>
                        <option value="below">Price Below</option>
                        <option value="pct_change">% Change ≥</option>
                    </select>
                    <input type="number" step="0.01" value={form.threshold} onChange={e => setForm(f => ({ ...f, threshold: e.target.value }))} placeholder="Value" required
                        style={{ padding: '0.5rem', borderRadius: 8, border: '1px solid var(--border-main)', width: 100 }} />
                    <button type="submit" className="auth-btn" style={{ width: 'auto', padding: '0.5rem 1rem', marginTop: 0 }}>Create</button>
                </form>
            </div>

            {/* Alerts list */}
            {alerts.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No alerts configured yet.</p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {alerts.map(a => (
                        <div key={a.id} style={{
                            background: 'var(--bg-card)', border: '1px solid var(--border-main)', borderRadius: 10,
                            padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            opacity: a.enabled ? 1 : 0.5
                        }}>
                            <div>
                                <span style={{ fontWeight: 700, marginRight: '0.5rem' }}>{a.symbol}</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                    {a.condition === 'above' ? '≥' : a.condition === 'below' ? '≤' : '% ≥'} {a.threshold}
                                </span>
                                {a.deliveries?.length > 0 && (
                                    <span style={{ marginLeft: '0.75rem', fontSize: '0.75rem', color: 'var(--primary-accent)' }}>
                                        Last triggered: {new Date(a.deliveries[0].triggeredAt).toLocaleString()} @ {a.deliveries[0].priceAtTrigger}
                                    </span>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <button onClick={() => handleToggle(a.id, a.enabled)}
                                    style={{ background: 'none', border: '1px solid var(--border-main)', borderRadius: 6, padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.75rem' }}>
                                    {a.enabled ? 'Disable' : 'Enable'}
                                </button>
                                <button onClick={() => handleDelete(a.id)}
                                    style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '1rem' }}>×</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default AlertsPage;
