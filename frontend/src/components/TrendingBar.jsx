import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flame } from 'lucide-react';
import logger from '../utils/logger';
import axios from 'axios';
import './TrendingBar.css';

const TRENDING_REFRESH_MS = 2 * 60 * 1000;

const getTrendingApiUrl = () => `${import.meta.env.VITE_API_URL || '/api'}/trending`;

const extractTrendingStocks = (response) => (
    response.data?.success ? response.data.data || [] : null
);

const fetchTrendingStocks = async () => {
    const response = await axios.get(getTrendingApiUrl());
    return extractTrendingStocks(response);
};

const normalizeChange = (changeValue) => {
    const change = Number(changeValue);
    return Number.isFinite(change) ? change : 0;
};

const getChangeClassName = (change) => (
    `trending-change ${change >= 0 ? 'positive' : 'negative'}`
);

const formatChange = (change) => `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;

const shouldHideTrending = (loading, trending) => loading || trending.length === 0;

function useTrendingStocks() {
    const [trending, setTrending] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isActive = true;

        const loadTrending = async () => {
            try {
                const nextTrending = await fetchTrendingStocks();
                if (isActive && nextTrending) setTrending(nextTrending);
            } catch (error) {
                logger.error('Failed to fetch trending stocks:', error);
            } finally {
                if (isActive) setLoading(false);
            }
        };

        loadTrending();

        const interval = setInterval(loadTrending, TRENDING_REFRESH_MS);
        return () => {
            isActive = false;
            clearInterval(interval);
        };
    }, []);

    return { loading, trending };
}

const TrendingHeader = () => (
    <div className="trending-header" style={{ display: 'flex', alignItems: 'center' }}>
        <Flame size={18} color="#ef4444" fill="#ef4444" style={{ marginRight: '8px' }} />
        <span className="trending-title">Trending:</span>
    </div>
);

const TrendingChip = ({ stock }) => {
    const change = normalizeChange(stock.change);

    return (
        <Link
            key={stock.symbol}
            to={`/stock/${stock.symbol}`}
            className="trending-chip"
        >
            <span className="trending-symbol">{stock.symbol}</span>
            <span className={getChangeClassName(change)}>
                {formatChange(change)}
            </span>
        </Link>
    );
};

const TrendingItems = ({ trending }) => (
    <div className="trending-items">
        {trending.map((stock) => (
            <TrendingChip key={stock.symbol} stock={stock} />
        ))}
    </div>
);

/**
 * TrendingBar Component
 * Displays trending stocks based on user activity.
 */
const TrendingBar = () => {
    const { loading, trending } = useTrendingStocks();

    if (shouldHideTrending(loading, trending)) {
        return null;
    }

    return (
        <div className="trending-bar">
            <div className="trending-container">
                <TrendingHeader />
                <TrendingItems trending={trending} />
            </div>
        </div>
    );
};

export default TrendingBar;
