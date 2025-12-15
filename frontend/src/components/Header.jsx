import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getServerHealth, getMarketSummary } from '../services/api';
import SearchBar from './SearchBar';
import logoPrimary from '../assets/img/logo-primary.jpg';
import './Header.css';

function Header() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [marketStatus, setMarketStatus] = useState(null);
    const [lastUpdate, setLastUpdate] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 30000); // Update every 30 seconds
        return () => clearInterval(interval);
    }, []);

    const fetchStatus = async () => {
        const health = await getServerHealth();
        if (health) {
            setMarketStatus(health.market?.isOpen ? 'Open' : 'Closed');
            setLastUpdate(health.scheduler?.lastUpdate);
        }
    };

    const handleSearch = (query) => {
        if (query.trim()) {
            navigate(`/search?q=${encodeURIComponent(query)}`);
            setIsMenuOpen(false);
        }
    };

    const formatTime = (isoDate) => {
        if (!isoDate) return '--:--';
        const date = new Date(isoDate);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    return (
        <header className="header">
            <div className="header-container">
                {/* Left: Logo Section */}
                <Link to="/" className="logo-section">
                    <div className="logo-icon">
                        <img src={logoPrimary} alt="NEPSE Logo" className="logo-img" />
                    </div>
                    <div className="logo-text-wrapper">
                        <span className="logo-text">NEPSE</span>
                        <span className="logo-subtitle">Market</span>
                    </div>
                </Link>

                {/* Center: Search Bar */}
                <div className="header-center">
                    <div className="header-search">
                        <SearchBar onSearch={handleSearch} placeholder="Search stocks..." />
                    </div>
                </div>

                {/* Right: Navigation & Status */}
                <div className="header-right">
                    {/* Desktop Navigation */}
                    <nav className={`nav ${isMenuOpen ? 'nav-open' : ''}`}>
                        <Link to="/" className="nav-link" onClick={() => setIsMenuOpen(false)}>
                            Home
                        </Link>
                        <Link to="/top-movers" className="nav-link" onClick={() => setIsMenuOpen(false)}>
                            Top Movers
                        </Link>
                        <Link to="/ipos" className="nav-link" onClick={() => setIsMenuOpen(false)}>
                            IPOs
                        </Link>
                    </nav>

                    {/* Market Status Pill */}
                    <div className="market-status-pill">
                        <div className={`status-indicator ${marketStatus === 'Open' ? 'status-open' : 'status-closed'}`}>
                            <span className="status-dot"></span>
                            <span className="status-text">{marketStatus || '--'}</span>
                        </div>
                    </div>
                </div>

                {/* Mobile Menu Button */}
                <button
                    className="menu-toggle"
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    aria-label="Toggle menu"
                >
                    <span className={`hamburger ${isMenuOpen ? 'hamburger-open' : ''}`}></span>
                </button>
            </div>

            {/* Mobile Menu Overlay */}
            {isMenuOpen && (
                <div className="mobile-overlay" onClick={() => setIsMenuOpen(false)}></div>
            )}
        </header>
    );
}

export default Header;
