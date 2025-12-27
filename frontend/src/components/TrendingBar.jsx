import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './TrendingBar.css';

/**
 * TrendingBar Component
 * Displays trending stocks based on user activity
 */
const TrendingBar = () => {
    const [trending, setTrending] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTrending();

        // Refresh trending data every 2 minutes
        const interval = setInterval(fetchTrending, 2 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const fetchTrending = async () => {
        try {
            const API_URL = import.meta.env.VITE_API_URL || '/api';
            const response = await axios.get(`${API_URL}/trending`);

            if (response.data && response.data.success) {
                setTrending(response.data.data || []);
            }
        } catch (error) {
            console.error('Failed to fetch trending stocks:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading || trending.length === 0) {
        return null;
    }

    return (
        <div className="trending-bar">
            <div className="trending-container">
                <div className="trending-header">
                    <span className="trending-icon">🔥</span>
                    <span className="trending-title">Trending:</span>
                </div>
                <div className="trending-items">
                    {trending.map((stock) => (
                        <Link
                            key={stock.symbol}
                            to={`/stock/${stock.symbol}`}
                            className="trending-chip"
                        >
                            <span className="trending-symbol">{stock.symbol}</span>
                            <span className={`trending-change ${stock.change >= 0 ? 'positive' : 'negative'}`}>
                                {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}%
                            </span>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default TrendingBar;
