import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { getServerHealth } from '../services/api';
import SearchBar from './SearchBar';
import logoPrimary from '../assets/img/logo-primary.jpg';
import './Header.css';

function Header({ searchTerm, onSearchChange, lastUpdated }) {
    const [secondsAgo, setSecondsAgo] = useState(0);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [marketStatus, setMarketStatus] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 30000); // Update every 30 seconds
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (!lastUpdated) return;

        // Reset secondsAgo when lastUpdated changes
        setSecondsAgo(0);

        const ticker = setInterval(() => {
            setSecondsAgo(prev => prev + 1);
        }, 1000);

        return () => clearInterval(ticker);
    }, [lastUpdated]);

    const fetchStatus = async () => {
        try {
            const health = await getServerHealth();
            if (health) {
                setMarketStatus(health.market?.isOpen ? 'Open' : 'Closed');
            }
        } catch (err) {
            console.error('Market status fetch failed');
        }
    };

    const handleSearch = (query) => {
        if (query.trim()) {
            // If we are not on the homepage, navigate to home and search
            if (location.pathname !== '/') {
                navigate('/');
            }
            onSearchChange(query);
            setIsMenuOpen(false);
        }
    };

    const isActive = (path) => location.pathname === path;

    return (
        <header className="header">
            <div className="header__container">
                {/* Left Side: Logo + Search */}
                <div className="header__left">
                    <Link to="/" className="logo">
                        <img src={logoPrimary} alt="NEPSE" />
                        <span>NEPSE MARKET</span>
                    </Link>

                    <div className="search-bar">
                        <SearchBar
                            value={searchTerm}
                            onInputChange={onSearchChange}
                            onSearch={handleSearch}
                            placeholder="Search stocks..."
                        />
                    </div>
                </div>

                {/* Right Side: Navigation */}
                <nav className={`header__nav ${isMenuOpen ? 'header__nav--open' : ''}`}>
                    <Link
                        to="/"
                        className={`nav-link ${isActive('/') ? 'nav-link--active' : ''}`}
                        onClick={() => setIsMenuOpen(false)}
                    >
                        Home
                    </Link>
                    <Link
                        to="/top-movers"
                        className={`nav-link ${isActive('/top-movers') ? 'nav-link--active' : ''}`}
                        onClick={() => setIsMenuOpen(false)}
                    >
                        Top Movers
                    </Link>
                    <Link
                        to="/ipos"
                        className={`nav-link ${isActive('/ipos') ? 'nav-link--active' : ''}`}
                        onClick={() => setIsMenuOpen(false)}
                    >
                        IPOs
                    </Link>

                    <div className={`market-status ${marketStatus === 'Open' ? 'market-status--open' : 'market-status--closed'}`}>
                        <div className="status-badge" style={{ display: 'flex', alignItems: 'center' }}>
                            <span className="status-dot"></span>
                            <span className="market-status__text">{marketStatus || 'Closed'}</span>
                        </div>
                        {lastUpdated && (
                            <span className="last-updated-ticker" style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginLeft: '12px' }}>
                                Updated: {secondsAgo}s ago
                            </span>
                        )}
                    </div>
                </nav>

                {/* Mobile Menu Toggle */}
                <button
                    className="menu-toggle"
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    aria-label="Toggle menu"
                >
                    <span className={`hamburger ${isMenuOpen ? 'open' : ''}`}></span>
                </button>
            </div>

            {/* Mobile Overlay */}
            {isMenuOpen && <div className="mobile-overlay" onClick={() => setIsMenuOpen(false)}></div>}
        </header>
    );
}

export default Header;
