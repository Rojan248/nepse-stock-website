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

/** Resolve change value from stock, handling nested shapes */
const resolveChange = (stock) => stock.change || stock.prices?.change || 0;

/** Table-driven status predicates */
const STATUS_PREDICATES = {
    advanced: (stock) => resolveChange(stock) > 0,
    declined: (stock) => resolveChange(stock) < 0,
    unchanged: (stock) => resolveChange(stock) === 0,
};

/** Filter stock by change direction */
const matchesStatus = (stock, status) => {
    const predicate = STATUS_PREDICATES[status];
    return predicate ? predicate(stock) : true;
};

/** Filter stock by symbol or company name search */
function matchesSearch(stock, query) {
    const symbol = (stock.symbol || '').toLowerCase();
    const name = (stock.companyName || '').toLowerCase();
    return symbol.includes(query) || name.includes(query);
}

/** Normalise search input; returns empty string when inactive */
const normalizeSearch = (q) => (q ? q.toLowerCase().trim() : '');

/** Table-driven filter pipeline — each entry is skipped when inactive */
const FILTER_PIPELINE = [
    { active: (f) => f.selectedSector !== 'all', apply: (s, f) => matchesSector(s, f.selectedSector) },
    { active: (f) => f.statusFilter !== 'all', apply: (s, f) => matchesStatus(s, f.statusFilter) },
    { active: (f) => !!normalizeSearch(f.globalSearch), apply: (s, f) => matchesSearch(s, normalizeSearch(f.globalSearch)) },
    { active: (f) => f.showFavoritesOnly, apply: (s, f) => f.favorites.includes(s.symbol) },
];

/** Apply all active filters to a stock list */
function applyFilters(stocks, filters) {
    const activeSteps = FILTER_PIPELINE.filter(step => step.active(filters));
    return stocks.filter(stock => activeSteps.every(step => step.apply(stock, filters)));
}

/** Get stock's change percent, resolving nested shapes */
const getChangePercent = (stock) => stock.percentageChange ?? stock.changePercent ?? stock.prices?.changePercent ?? 0;

/** Try to resolve breadth counts from the API summary */
const resolveBreadthFromApi = (marketSummary) => ({
    advanced: marketSummary?.advancedCompanies ?? null,
    declined: marketSummary?.declinedCompanies ?? null,
    unchanged: marketSummary?.unchangedCompanies ?? null,
});

const EMPTY_BREADTH = { advanced: 0, declined: 0, unchanged: 0 };

const hasApiData = (breadth) => breadth.advanced !== null;
const hasStocks = (stocks) => stocks && stocks.length > 0;

/** Derive breadth counts from stock data */
const deriveBreadthFromStocks = (stocks) => ({
    advanced: stocks.filter(s => getChangePercent(s) > 0).length,
    declined: stocks.filter(s => getChangePercent(s) < 0).length,
    unchanged: stocks.filter(s => getChangePercent(s) === 0).length,
});

/** Computes market breadth from API data with stock-derived fallback */
export function useMarketBreadth(stocks, marketSummary) {
    return useMemo(() => {
        const fromApi = resolveBreadthFromApi(marketSummary);
        if (hasApiData(fromApi)) return fromApi;
        if (!hasStocks(stocks)) return EMPTY_BREADTH;
        return deriveBreadthFromStocks(stocks);
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
