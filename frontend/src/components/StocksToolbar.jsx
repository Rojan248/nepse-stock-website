import React from 'react';
import Select from './ui/Select';

/** Toolbar with watchlist toggle and sector filter */
export default function StocksToolbar({ stockCount, showFavoritesOnly, setShowFavoritesOnly, favorites, sectors, selectedSector, setSelectedSector }) {
    return (
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 section-header">
            <h2 className="text-xl font-bold tracking-tight text-primary section-title">
                All Stocks <span className="font-normal ml-1 text-[color:var(--text-muted)]" style={{ fontSize: '0.9em' }}>({stockCount})</span>
            </h2>
            <div className="flex items-center gap-3 w-full md:w-auto filters">
                <button
                    onClick={() => setShowFavoritesOnly(prev => !prev)}
                    className={`watchlist-btn ${showFavoritesOnly ? 'active' : ''}`}
                    aria-pressed={showFavoritesOnly}
                    aria-label={showFavoritesOnly ? `Showing ${favorites?.length || 0} favorites` : `Show all stocks, ${favorites?.length || 0} favorites available`}
                >
                    <div className="icon-container">
                        <svg aria-hidden="true" className="star-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                        <svg aria-hidden="true" className="check-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    </div>
                    <span className="btn-label">{showFavoritesOnly ? 'Added' : 'Watchlist'}</span>
                    {(favorites || []).length > 0 && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${showFavoritesOnly ? 'bg-amber-200 text-amber-900' : 'bg-stone-100 text-stone-500'}`}>
                            {favorites.length}
                        </span>
                    )}
                </button>
                <Select
                    value={selectedSector}
                    onChange={(e) => setSelectedSector(e.target.value)}
                    options={[{ label: 'ALL SECTORS', value: 'all' }, ...(sectors || []).map(s => ({ label: s, value: s }))]}
                    placeholder="ALL SECTORS"
                />
            </div>
        </div>
    );
}
