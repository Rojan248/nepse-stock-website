import { Link } from 'react-router-dom';
import { formatPrice, formatPercent, getChangeClass } from '../utils/formatting';
import './StockCard.css';

function StockCard({ stock, onClick }) {
    if (!stock) return null;

    const { symbol, companyName, sector, prices, change, changePercent } = stock;
    const ltp = stock.ltp || stock.close || 0;
    const changeClass = getChangeClass(changePercent);

    const handleClick = () => {
        if (onClick) onClick(stock);
    };

    return (
        <Link to={`/stock/${symbol}`} className="stock-card" onClick={handleClick}>
            <div className="stock-card-header">
                <span className="stock-symbol">{symbol}</span>
                <span className="stock-sector">{sector || 'Others'}</span>
            </div>

            <div className="stock-card-name">
                {companyName || symbol}
            </div>

            <div className="stock-card-price">
                <span className="stock-ltp">{formatPrice(ltp)}</span>
            </div>

            <div className={`stock-card-change ${changeClass}`}>
                <span className="change-amount">
                    {change >= 0 ? '+' : ''}{change?.toFixed(2) || '0.00'}
                </span>
                <span className="change-percent">
                    ({formatPercent(changePercent)})
                </span>
            </div>

            <div className="stock-card-arrow">→</div>
        </Link>
    );
}

export default StockCard;
