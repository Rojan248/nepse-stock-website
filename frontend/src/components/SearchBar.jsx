import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { searchStocks } from '../services/api';
import './SearchBar.css';

function SearchBar({ onSearch, onInputChange, value, placeholder = "Search stocks..." }) {
    const [localQuery, setLocalQuery] = useState('');
    const query = value !== undefined ? value : localQuery;
    const setQuery = value !== undefined ? (onInputChange || (() => { })) : setLocalQuery;

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
        const val = e.target.value;
        if (value === undefined) {
            setLocalQuery(val);
        }
        if (onInputChange) {
            onInputChange(val);
        }
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
