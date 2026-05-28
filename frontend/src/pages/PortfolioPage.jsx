import { useState } from 'react';
import { PortfolioSummary, HoldingsTable } from '../components/PortfolioSummary';
import { usePortfolioData } from '../hooks/usePortfolioData';

const EMPTY_TRADE = { symbol: '', type: 'buy', quantity: '', price: '', date: '' };

// ==================== Sub-Components ====================

function TradeForm({ onSubmit }) {
    const [form, setForm] = useState(EMPTY_TRADE);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const submitted = new FormData(e.currentTarget);
        const trade = {
            symbol: submitted.get('symbol') || form.symbol,
            type: submitted.get('type') || form.type,
            quantity: submitted.get('quantity') || form.quantity,
            price: submitted.get('price') || form.price,
            date: submitted.get('date') || form.date
        };
        const success = await onSubmit(trade);
        if (success) setForm(EMPTY_TRADE);
    };

    const update = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

    return (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)', borderRadius: 12, padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1rem' }}>Add Trade</h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <input name="symbol" value={form.symbol} onChange={update('symbol')} placeholder="Symbol" required
                    style={{ padding: '0.5rem', borderRadius: 8, border: '1px solid var(--border-main)', width: 100 }} />
                <select name="type" value={form.type} onChange={update('type')}
                    style={{ padding: '0.5rem', borderRadius: 8, border: '1px solid var(--border-main)' }}>
                    <option value="buy">Buy</option>
                    <option value="sell">Sell</option>
                </select>
                <input name="quantity" type="number" value={form.quantity} onChange={update('quantity')} placeholder="Qty" required min="1"
                    style={{ padding: '0.5rem', borderRadius: 8, border: '1px solid var(--border-main)', width: 80 }} />
                <input name="price" type="number" step="0.01" value={form.price} onChange={update('price')} placeholder="Price" required
                    style={{ padding: '0.5rem', borderRadius: 8, border: '1px solid var(--border-main)', width: 100 }} />
                <input name="date" type="date" value={form.date} onChange={update('date')} required
                    style={{ padding: '0.5rem', borderRadius: 8, border: '1px solid var(--border-main)' }} />
                <button type="submit" className="auth-btn" style={{ width: 'auto', padding: '0.5rem 1rem', marginTop: 0 }}>Add</button>
            </form>
        </div>
    );
}

function TradeHistory({ trades, onDeleteTrade }) {
    if (!trades?.length) return null;
    return (
        <div>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Trade History</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-main)', textAlign: 'left' }}>
                        <th style={{ padding: '0.4rem' }}>Date</th>
                        <th style={{ padding: '0.4rem' }}>Symbol</th>
                        <th style={{ padding: '0.4rem' }}>Type</th>
                        <th style={{ padding: '0.4rem' }}>Qty</th>
                        <th style={{ padding: '0.4rem' }}>Price</th>
                        <th style={{ padding: '0.4rem' }}></th>
                    </tr>
                </thead>
                <tbody>
                    {trades.map(t => (
                        <tr key={t.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '0.4rem' }}>{new Date(t.date).toLocaleDateString()}</td>
                            <td style={{ padding: '0.4rem', fontWeight: 600 }}>{t.symbol}</td>
                            <td style={{ padding: '0.4rem', color: t.type === 'buy' ? 'var(--success)' : 'var(--danger)' }}>{t.type.toUpperCase()}</td>
                            <td style={{ padding: '0.4rem' }}>{t.quantity}</td>
                            <td style={{ padding: '0.4rem' }}>{t.price}</td>
                            <td style={{ padding: '0.4rem' }}>
                                <button onClick={() => onDeleteTrade(t.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.8rem' }}>×</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function PortfolioTabs({ portfolios, selectedId, setSelectedId, onCreatePortfolio }) {
    const [newName, setNewName] = useState('');

    const handleCreate = () => {
        onCreatePortfolio(newName);
        setNewName('');
    };

    return (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'center' }}>
            {portfolios.map(p => (
                <button key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    style={{
                        padding: '0.4rem 1rem', borderRadius: 8, border: '1px solid var(--border-main)',
                        background: p.id === selectedId ? 'var(--primary-accent)' : 'var(--bg-card)',
                        color: p.id === selectedId ? '#fff' : 'var(--text-primary)',
                        cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500
                    }}
                >
                    {p.name}
                </button>
            ))}
            <div style={{ display: 'flex', gap: '0.35rem' }}>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="New portfolio"
                    style={{ padding: '0.4rem 0.7rem', borderRadius: 8, border: '1px solid var(--border-main)', fontSize: '0.85rem' }}
                />
                <button onClick={handleCreate} className="auth-btn" style={{ width: 'auto', padding: '0.4rem 0.8rem', marginTop: 0 }}>+</button>
            </div>
        </div>
    );
}

// ==================== PortfolioPage ====================

function PortfolioPage() {
    const {
        portfolios, loading, selectedId, setSelectedId, holdings,
        error, selected, handleCreate, handleDelete, handleAddTrade, handleDeleteTrade
    } = usePortfolioData();

    if (loading) {
        return <div className="page-container"><p>Loading portfolios...</p></div>;
    }

    return (
        <div className="page-container" style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1rem' }}>
            <h1 style={{ marginBottom: '0.5rem' }}>Portfolio</h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Track your NEPSE investments</p>

            {error && <div className="auth-error" style={{ marginBottom: '1rem' }}>{error}</div>}

            <PortfolioTabs
                portfolios={portfolios}
                selectedId={selectedId}
                setSelectedId={setSelectedId}
                onCreatePortfolio={handleCreate}
            />

            {selected && (
                <>
                    <PortfolioSummary summary={holdings?.summary} />
                    <HoldingsTable holdings={holdings?.holdings} />
                    <TradeForm onSubmit={handleAddTrade} />
                    <TradeHistory trades={selected.trades} onDeleteTrade={handleDeleteTrade} />

                    <button onClick={() => handleDelete(selected.id)}
                        style={{ marginTop: '2rem', padding: '0.5rem 1rem', background: 'none', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: 8, cursor: 'pointer', fontSize: '0.8rem' }}>
                        Delete Portfolio
                    </button>
                </>
            )}
        </div>
    );
}

export default PortfolioPage;
