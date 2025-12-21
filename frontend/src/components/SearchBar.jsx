import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { searchStocks } from '../services/api';
import './SearchBar.css';

function SearchBar({ onSearch, placeholder = "Search stocks..." }) {
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const wrapperRef = useRef(null);
    const debounceRef = useRef(null);

    // Close suggestions when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Debounced search
    useEffect(() => {
        if (query.length < 1) {
            setSuggestions([]);
            setIsOpen(false);
            return;
        }

        // Clear previous timeout
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        // Set new timeout
        debounceRef.current = setTimeout(async () => {
            setLoading(true);
            const result = await searchStocks(query);
            setSuggestions(result.stocks?.slice(0, 5) || []);
            setIsOpen(true);
            setLoading(false);
        }, 300);

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, [query]);

    const handleInputChange = (e) => {
        setQuery(e.target.value);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (onSearch) onSearch(query);
            setIsOpen(false);
        }
        if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    const handleSuggestionClick = (stock) => {
        setQuery(stock.symbol);
        if (onSearch) onSearch(stock.symbol);
        setIsOpen(false);
    };

    const handleClear = () => {
        setQuery('');
        setSuggestions([]);
        setIsOpen(false);
    };

    return (
        <div className="search-bar" ref={wrapperRef}>
            <div className="search-input-wrapper">
                <Search className="search-icon" size={16} />
                <input
                    type="text"
                    value={query}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => suggestions.length > 0 && setIsOpen(true)}
                    placeholder={placeholder}
                    className="search-input"
                />
                {loading && <span className="search-loader"></span>}
                {query && !loading && (
                    <button className="search-clear" onClick={handleClear} aria-label="Clear search">
                        <X size={14} />
                    </button>
                )}
            </div>

            {isOpen && suggestions.length > 0 && (
                <ul className="search-suggestions">
                    {suggestions.map((stock) => (
                        <li
                            key={stock.symbol || stock._id}
                            className="suggestion-item"
                            onClick={() => handleSuggestionClick(stock)}
                        >
                            <span className="suggestion-symbol">{stock.symbol}</span>
                            <span className="suggestion-name">{stock.companyName}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default SearchBar;
