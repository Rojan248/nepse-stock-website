import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { searchStocks } from '../services/api';
import StockTable from '../components/StockTable';
import LoadingSpinner from '../components/LoadingSpinner';
import './SearchResultsPage.css';

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
                console.error('Search failed:', error);
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
                <button className="back-btn" onClick={() => navigate(-1)}>
                    ← Back
                </button>
                <h1>Search Results</h1>
                <p className="search-query">
                    Showing results for: <strong>"{query}"</strong>
                </p>
            </header>

            {!query && (
                <div className="no-query">
                    <span className="icon">🔍</span>
                    <h3>Enter a search term</h3>
                    <p>Use the search bar to find stocks by symbol or company name</p>
                </div>
            )}

            {query && results.length === 0 && (
                <div className="no-results">
                    <span className="icon">😔</span>
                    <h3>No Results Found</h3>
                    <p>No stocks match your search for "{query}"</p>
                    <button className="btn btn-primary" onClick={() => navigate('/')}>
                        Browse All Stocks
                    </button>
                </div>
            )}

            {results.length > 0 && (
                <section className="results-section">
                    <p className="results-count">{results.length} stock{results.length !== 1 ? 's' : ''} found</p>
                    <StockTable
                        stocks={results}
                        onRowClick={handleStockClick}
                        showPagination={false}
                    />
                </section>
            )}
        </div>
    );
}

export default SearchResultsPage;
