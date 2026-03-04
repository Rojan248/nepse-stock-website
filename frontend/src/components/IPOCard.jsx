import { formatPrice, formatDate } from '../utils/formatting';
import './IPOCard.css';

const UNIT_THRESHOLDS = [
    { min: 10000000, divisor: 10000000, suffix: ' Cr', decimals: 1 },
    { min: 100000, divisor: 100000, suffix: ' L', decimals: 1 },
    { min: 1000, divisor: 1000, suffix: 'K', decimals: 0 },
];

const formatUnits = (num) => {
    if (!num) return 'N/A';
    for (const t of UNIT_THRESHOLDS) {
        if (num >= t.min) return (num / t.divisor).toFixed(t.decimals) + t.suffix;
    }
    return num.toLocaleString();
};

const statusLabels = {
    open: 'OPEN',
    upcoming: 'UPCOMING',
    closed: 'CLOSED',
    completed: 'COMPLETED'
};

/** Renders the date range for an IPO */
function IPODates({ issueDate, closingDate }) {
    const parts = [];
    if (issueDate) parts.push(`Opens: ${formatDate(issueDate)}`);
    if (closingDate) parts.push(`Closes: ${formatDate(closingDate)}`);
    return <div className="volume">{parts.join(' | ')}</div>;
}

function IPOCard({ ipo, onClick }) {
    if (!ipo) return null;
    const { companyName, symbol, sector, status, price, units, issueDate, closingDate } = ipo;

    return (
        <div className={`ipo-card ${status || 'upcoming'}`} onClick={() => onClick && onClick(ipo)}>
            <div className="card-header">
                <span className="symbol">{symbol || 'IPO'}</span>
                <span className="sector-badge">{sector || 'Others'}</span>
            </div>
            <div className="company-name">{companyName}</div>
            <div className="ltp"><span className="currency">NPR</span>{price || 100}</div>
            <div className="change-row">
                <span className={`status-text ${status}`}>{statusLabels[status] || 'IPO'}</span>
                <span className="units-text">• {formatUnits(units)} units</span>
            </div>
            <IPODates issueDate={issueDate} closingDate={closingDate} />
            <button className="view-btn">View Details</button>
        </div>
    );
}

export default IPOCard;
