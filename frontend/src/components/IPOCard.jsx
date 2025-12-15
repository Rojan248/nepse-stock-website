import { formatPrice, formatDate } from '../utils/formatting';
import './IPOCard.css';

function IPOCard({ ipo, onClick }) {
    if (!ipo) return null;

    const {
        companyName,
        sector,
        status,
        priceRange,
        dates,
        subscriptionRatio,
        minimumShares,
        maximumShares
    } = ipo;

    const getStatusBadge = (status) => {
        const statusConfig = {
            upcoming: { class: 'badge-info', text: 'Upcoming' },
            open: { class: 'badge-success', text: 'Open' },
            closed: { class: 'badge-warning', text: 'Closed' },
            completed: { class: 'badge-neutral', text: 'Completed' }
        };
        return statusConfig[status] || statusConfig.upcoming;
    };

    const statusBadge = getStatusBadge(status);

    const getRelevantDate = () => {
        if (status === 'open' && dates?.applicationClose) {
            return { label: 'Closes', date: dates.applicationClose };
        }
        if (status === 'upcoming' && dates?.applicationOpen) {
            return { label: 'Opens', date: dates.applicationOpen };
        }
        if ((status === 'closed' || status === 'completed') && dates?.resultDate) {
            return { label: 'Result', date: dates.resultDate };
        }
        return null;
    };

    const relevantDate = getRelevantDate();

    return (
        <div className="ipo-card" onClick={() => onClick && onClick(ipo)}>
            <div className="ipo-card-header">
                <span className={`badge ${statusBadge.class}`}>{statusBadge.text}</span>
                <span className="ipo-sector">{sector || 'Others'}</span>
            </div>

            <h3 className="ipo-company-name">{companyName}</h3>

            <div className="ipo-card-details">
                <div className="ipo-detail">
                    <span className="detail-label">Price</span>
                    <span className="detail-value">
                        {priceRange?.min === priceRange?.max
                            ? formatPrice(priceRange?.min || 100)
                            : `${formatPrice(priceRange?.min || 100)} - ${formatPrice(priceRange?.max || 100)}`
                        }
                    </span>
                </div>

                {relevantDate && (
                    <div className="ipo-detail">
                        <span className="detail-label">{relevantDate.label}</span>
                        <span className="detail-value">{formatDate(relevantDate.date)}</span>
                    </div>
                )}

                {subscriptionRatio > 0 && (
                    <div className="ipo-detail">
                        <span className="detail-label">Subscription</span>
                        <span className="detail-value subscription-ratio">
                            {subscriptionRatio.toFixed(2)}x
                        </span>
                    </div>
                )}

                {(minimumShares || maximumShares) && (
                    <div className="ipo-detail">
                        <span className="detail-label">Units</span>
                        <span className="detail-value">
                            {minimumShares || 10} - {maximumShares || 'N/A'}
                        </span>
                    </div>
                )}
            </div>

            <div className="ipo-card-footer">
                <button className="btn btn-secondary btn-sm">View Details</button>
            </div>
        </div>
    );
}

export default IPOCard;
