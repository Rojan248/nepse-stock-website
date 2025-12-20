import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getServerHealth } from '../services/api';
import SearchBar from './SearchBar';
import logoPrimary from '../assets/img/logo-primary.jpg';
import './Header.css';

function Header() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [marketStatus, setMarketStatus] = useState(null);
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
        }
    };

    const handleSearch = (query) => {
        if (query.trim()) {
            navigate(`/search?q=${encodeURIComponent(query)}`);
            setIsMenuOpen(false);
        }
    };

    return (
        <header className="header">
            <div className="header__container">
                {/* Left Side: Logo + Search */}
                <div className="header__left">
                    <Link to="/" className="logo">
                        <img src={logoPrimary} alt="NEPSE" />
                        <span>NEPSE</span>
                        <span className="logo__subtitle">MARKET</span>
                    </Link>

                    <div className="search-bar">
                        <SearchBar onSearch={handleSearch} placeholder="Search stocks..." />
                    </div>
                </div>

                {/* Right Side: Navigation */}
                <nav className={`header__nav ${isMenuOpen ? 'header__nav--open' : ''}`}>
                    <Link to="/" className="nav-link nav-link--active" onClick={() => setIsMenuOpen(false)}>
                        Home
                    </Link>
                    <Link to="/top-movers" className="nav-link" onClick={() => setIsMenuOpen(false)}>
                        Top Movers
                    </Link>
                    <Link to="/ipos" className="nav-link" onClick={() => setIsMenuOpen(false)}>
                        IPOs
                    </Link>

                    <div className={`market-status ${marketStatus === 'Open' ? 'market-status--open' : 'market-status--closed'}`}>
                        <span className="market-status__dot"></span>
                        <span className="market-status__text">{marketStatus || 'Closed'}</span>
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
