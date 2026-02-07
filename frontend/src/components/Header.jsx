import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import SearchBar from './SearchBar';
import SystemHealthBadge from './SystemHealthBadge';
import logoPrimary from '../assets/img/logo-primary.jpg';
import './Header.css';

function Header({ searchTerm, onSearchChange }) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

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



                    {/* System Health Status Badge */}
                    <SystemHealthBadge />
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
