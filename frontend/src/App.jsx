import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import HomePage from './pages/HomePage'
import StockDetailPage from './pages/StockDetailPage'
import IPOPage from './pages/IPOPage'
import TopMoversPage from './pages/TopMoversPage'
import SearchResultsPage from './pages/SearchResultsPage'
import ErrorBoundary from './components/ErrorBoundary'

function App() {
    const [globalSearch, setGlobalSearch] = useState('');

    return (
        <ErrorBoundary>
            <div className="app">
                <Header searchTerm={globalSearch} onSearchChange={setGlobalSearch} />
                <main className="main-content">
                    <Routes>
                        <Route path="/" element={<HomePage globalSearch={globalSearch} />} />
                        <Route path="/stock/:symbol" element={<StockDetailPage />} />
                        <Route path="/ipos" element={<IPOPage />} />
                        <Route path="/top-movers" element={<TopMoversPage />} />
                        <Route path="/search" element={<SearchResultsPage />} />
                    </Routes>
                </main>
            </div>
        </ErrorBoundary>
    )
}

export default App
