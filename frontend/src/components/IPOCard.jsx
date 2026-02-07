import { formatPrice, formatDate } from '../utils/formatting';
import './IPOCard.css';

function IPOCard({ ipo, onClick }) {
    if (!ipo) return null;

    const {
        companyName,
        symbol,
        sector,
        status,
        price,
        units,
        issueDate,
        closingDate,
        issueManager
    } = ipo;

    const formatUnits = (num) => {
        if (!num) return 'N/A';
        if (num >= 10000000) return (num / 10000000).toFixed(1) + ' Cr';
        if (num >= 100000) return (num / 100000).toFixed(1) + ' L';
        if (num >= 1000) return (num / 1000).toFixed(0) + 'K';
        return num.toLocaleString();
    };

    const getStatusClass = () => {
        return status || 'upcoming';
    };

    const statusLabels = {
        open: 'OPEN',
        upcoming: 'UPCOMING',
        closed: 'CLOSED',
        completed: 'COMPLETED'
    };

    return (
        <div
            className={`ipo-card ${getStatusClass()}`}
            onClick={() => onClick && onClick(ipo)}
        >
            {/* Header Row */}
            <div className="card-header">
                <span className="symbol">{symbol || 'IPO'}</span>
                <span className="sector-badge">{sector || 'Others'}</span>
            </div>

            {/* Company Name */}
            <div className="company-name">{companyName}</div>

            {/* Price */}
            <div className="ltp">
                <span className="currency">Rs</span>
                {price || 100}
            </div>

            {/* Status & Units Row */}
            <div className="change-row">
                <span className={`status-text ${status}`}>{statusLabels[status] || 'IPO'}</span>
                <span className="units-text">• {formatUnits(units)} units</span>
            </div>

            {/* Dates */}
            <div className="volume">
                {issueDate && `Opens: ${formatDate(issueDate)}`}
                {issueDate && closingDate && ' | '}
                {closingDate && `Closes: ${formatDate(closingDate)}`}
            </div>

            {/* View Button */}
            <button className="view-btn">View Details</button>
        </div>
    );
}

export default IPOCard;
