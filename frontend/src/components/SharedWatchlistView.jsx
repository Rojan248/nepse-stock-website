import { Link } from 'react-router-dom';

const pageStyle = { maxWidth: 700, margin: '0 auto', padding: '2rem 1rem' };
const centeredStyle = { padding: '2rem', textAlign: 'center' };
const mutedTextStyle = { color: 'var(--text-muted)' };

function CenteredMessage({ children, style = {} }) {
    return (
        <div className="page-container" style={centeredStyle}>
            <p style={style}>{children}</p>
        </div>
    );
}

function WatchlistHeader({ watchlist }) {
    return (
        <>
            <h1 style={{ marginBottom: '0.25rem' }}>{watchlist?.name || 'Shared Watchlist'}</h1>
            <p style={{ ...mutedTextStyle, marginBottom: '1.5rem', fontSize: '0.85rem' }}>
                Shared by {watchlist?.owner || 'Anonymous'} - {watchlist?.items?.length || 0} stocks
            </p>
        </>
    );
}

const CHANGE_COLOR_RULES = [
    { matches: (change) => change > 0, color: 'var(--success)' },
    { matches: (change) => change < 0, color: 'var(--danger)' },
];

const getChangeColor = (change) =>
    CHANGE_COLOR_RULES.find(rule => rule.matches(change))?.color || 'var(--text-muted)';

const formatSigned = (value) => `${value >= 0 ? '+' : ''}${value}`;

function WatchlistRow({ item, stock }) {
    const change = stock?.change || 0;
    const pct = stock?.percentageChange || 0;
    const color = getChangeColor(change);

    return (
        <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <td style={{ padding: '0.5rem' }}>
                <Link to={`/stock/${item.symbol}`} style={{ fontWeight: 600, color: 'var(--primary-accent)', textDecoration: 'none' }}>
                    {item.symbol}
                </Link>
            </td>
            <td style={{ padding: '0.5rem' }}>{stock?.lastTradedPrice || '-'}</td>
            <td style={{ padding: '0.5rem', color }}>{formatSigned(change)}</td>
            <td style={{ padding: '0.5rem', color, fontWeight: 600 }}>{formatSigned(pct)}%</td>
        </tr>
    );
}

function WatchlistTable({ items, stocks }) {
    return (
        <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-main)', textAlign: 'left' }}>
                        <th style={{ padding: '0.5rem' }}>Symbol</th>
                        <th style={{ padding: '0.5rem' }}>LTP</th>
                        <th style={{ padding: '0.5rem' }}>Change</th>
                        <th style={{ padding: '0.5rem' }}>% Change</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map(item => (
                        <WatchlistRow key={item.symbol} item={item} stock={stocks[item.symbol]} />
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function WatchlistContent({ watchlist, stocks }) {
    const items = watchlist?.items || [];
    return items.length > 0
        ? <WatchlistTable items={items} stocks={stocks} />
        : <p style={mutedTextStyle}>This watchlist is empty.</p>;
}

function LoadedWatchlist({ watchlist, stocks }) {
    return (
        <div className="page-container" style={pageStyle}>
            <WatchlistHeader watchlist={watchlist} />
            <WatchlistContent watchlist={watchlist} stocks={stocks} />
        </div>
    );
}

const VIEW_STATES = [
    { matches: ({ loading }) => loading, render: () => <CenteredMessage>Loading watchlist...</CenteredMessage> },
    { matches: ({ error }) => Boolean(error), render: ({ error }) => <CenteredMessage style={{ color: '#dc2626' }}>{error}</CenteredMessage> },
    { matches: () => true, render: ({ watchlist, stocks }) => <LoadedWatchlist watchlist={watchlist} stocks={stocks} /> },
];

function SharedWatchlistView(props) {
    return VIEW_STATES.find(state => state.matches(props)).render(props);
}

export default SharedWatchlistView;
