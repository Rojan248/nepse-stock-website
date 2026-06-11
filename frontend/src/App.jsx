import { useState } from 'react'
import { Navigate, Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import HomePage from './pages/HomePage'
import StockDetailPage from './pages/StockDetailPage'
import IPOPage from './pages/IPOPage'
import TopMoversPage from './pages/TopMoversPage'
import SearchResultsPage from './pages/SearchResultsPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import PortfolioPage from './pages/PortfolioPage'
import AlertsPage from './pages/AlertsPage'
import SharedWatchlistPage from './pages/SharedWatchlistPage'
import ProtectedRoute from './components/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'
import { AuthProvider } from './hooks/useAuth'
import { PUBLIC_REGISTRATION_ENABLED } from './config/auth'

function App() {
    const [globalSearch, setGlobalSearch] = useState('');

    return (
        <AuthProvider>
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
                            <Route path="/login" element={<LoginPage />} />
                            <Route
                                path="/register"
                                element={PUBLIC_REGISTRATION_ENABLED ? <RegisterPage /> : <Navigate to="/login" replace />}
                            />
                            <Route path="/portfolio" element={<ProtectedRoute><PortfolioPage /></ProtectedRoute>} />
                            <Route path="/alerts" element={<ProtectedRoute><AlertsPage /></ProtectedRoute>} />
                            <Route path="/w/:slug" element={<SharedWatchlistPage />} />
                        </Routes>
                    </main>
                </div>
            </ErrorBoundary>
        </AuthProvider>
    )
}

export default App
