import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import logger from '../utils/logger';
import { searchStocks } from '../services/api';
import StockTable from '../components/StockTable';
import LoadingSpinner from '../components/LoadingSpinner';
import './SearchResultsPage.css';

const SearchEmptyState = () => (
    <div className="search-empty-card animate-up">
        <div className="search-illustration search-illustration--empty">
            <div className="glass-lens"></div>
            <div className="search-line"></div>
        </div>
        <h3>Begin Your Search</h3>
        <p>Explore the Nepal Stock Exchange. Enter a symbol or company name to get started.</p>
    </div>
);

const SearchNoResults = ({ query, onBrowse }) => (
    <div className="search-empty-card animate-up">
        <div className="search-illustration search-illustration--none">
            <div className="search-circle"></div>
            <div className="search-cross"></div>
        </div>
        <h3>No Results Found</h3>
        <p>We couldn't find any stocks matching <strong>"{query}"</strong>. Double check the symbol or explore all sectors.</p>
        <button className="btn btn-primary btn-elevated" onClick={onBrowse}>
            View All Stocks
        </button>
    </div>
);

const SearchResultsList = ({ results, onRowClick }) => (
    <section className="results-section">
        <p className="results-count">{results.length} stock{results.length !== 1 ? 's' : ''} found</p>
        <StockTable
            stocks={results}
            onRowClick={onRowClick}
            showPagination={false}
        />
    </section>
);

function SearchResultsPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const query = searchParams.get('q') || '';
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const search = async () => {
            if (!query) {
                setResults([]);
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const data = await searchStocks(query);
                setResults(data.stocks || []);
            } catch (error) {
                logger.error('Search failed:', error);
                setResults([]);
            } finally {
                setLoading(false);
            }
        };

        search();
    }, [query]);

    const handleStockClick = (stock) => {
        navigate(`/stock/${stock.symbol}`);
    };

    if (loading) {
        return <LoadingSpinner fullPage text="Searching..." />;
    }

    return (
        <div className="search-results-page container">
            <header className="search-header">
                <button className="btn btn-ghost back-button-elevated" onClick={() => navigate(-1)}>
                    ← Back
                </button>
                <h1>Search Results</h1>
                <p className="search-query">
                    Showing results for: <strong>"{query}"</strong>
                </p>
            </header>

            {!query && <SearchEmptyState />}
            {query && results.length === 0 && <SearchNoResults query={query} onBrowse={() => navigate('/')} />}
            {results.length > 0 && <SearchResultsList results={results} onRowClick={handleStockClick} />}
        </div>
    );
}

export default SearchResultsPage;
