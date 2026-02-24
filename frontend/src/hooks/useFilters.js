import { useMemo } from 'react';
import { ITEMS_PER_PAGE } from '../utils/constants';

/** Check if two strings match exactly or one contains the other */
const exactOrSubstringMatch = (a, b) => a === b || a.includes(b) || b.includes(a);

/** Strip trailing 's' for plural normalization */
const stripPlural = (s) => s.endsWith('s') ? s.slice(0, -1) : s;

/** Fuzzy sector match with plural normalization */
function matchesSector(stock, sector) {
    if (!stock.sector) return false;
    const s = stock.sector.toLowerCase().trim();
    const f = sector.toLowerCase().trim();
    return exactOrSubstringMatch(s, f) || stripPlural(s) === stripPlural(f);
}

/** Filter stock by change direction */
function matchesStatus(stock, status) {
    const change = stock.change || stock.prices?.change || 0;
    if (status === 'advanced') return change > 0;
    if (status === 'declined') return change < 0;
    if (status === 'unchanged') return change === 0;
    return true;
}

/** Filter stock by symbol or company name search */
function matchesSearch(stock, query) {
    const symbol = (stock.symbol || '').toLowerCase();
    const name = (stock.companyName || '').toLowerCase();
    return symbol.includes(query) || name.includes(query);
}

/** Apply all active filters to a stock list */
function applyFilters(stocks, { selectedSector, statusFilter, globalSearch, showFavoritesOnly, favorites }) {
    let result = stocks;
    if (selectedSector !== 'all') {
        result = result.filter(s => matchesSector(s, selectedSector));
    }
    if (statusFilter !== 'all') {
        result = result.filter(s => matchesStatus(s, statusFilter));
    }
    if (globalSearch && globalSearch.trim()) {
        const q = globalSearch.toLowerCase().trim();
        result = result.filter(s => matchesSearch(s, q));
    }
    if (showFavoritesOnly) {
        result = result.filter(s => favorites.includes(s.symbol));
    }
    return result;
}

/** Get stock's change percent, resolving nested shapes */
function getChangePercent(stock) {
    return stock.changePercent || stock.prices?.changePercent || 0;
}

/** Computes market breadth from API data with stock-derived fallback */
export function useMarketBreadth(stocks, marketSummary) {
    return useMemo(() => {
        const fromApi = {
            advanced: marketSummary?.advancedCompanies ?? null,
            declined: marketSummary?.declinedCompanies ?? null,
            unchanged: marketSummary?.unchangedCompanies ?? null
        };

        if (fromApi.advanced !== null) return fromApi;

        if (!stocks || stocks.length === 0) {
            return { advanced: 0, declined: 0, unchanged: 0 };
        }

        return {
            advanced: stocks.filter(s => getChangePercent(s) > 0).length,
            declined: stocks.filter(s => getChangePercent(s) < 0).length,
            unchanged: stocks.filter(s => getChangePercent(s) === 0).length
        };
    }, [stocks, marketSummary]);
}


/** Derives filtered + paginated stock list from raw stocks and filter state */
export function useFilteredStocks(stocks, filters, currentPage) {
    const filtered = useMemo(
        () => applyFilters(stocks, filters),
        [stocks, filters.selectedSector, filters.globalSearch, filters.showFavoritesOnly, filters.favorites, filters.statusFilter]
    );
    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    const display = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return filtered.slice(start, start + ITEMS_PER_PAGE);
    }, [filtered, currentPage]);
    return { filtered, display, totalPages };
}
