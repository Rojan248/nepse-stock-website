import { useState, useEffect, useRef, memo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ChevronDown, Star } from 'lucide-react';
import { formatPrice, formatPercent, formatNumber, getChangeClass } from '../utils/formatting';
import { useMediaQuery } from '../hooks/useMediaQuery';
import './StockTable.css';
import './AnimatedValue.css';

// ==================== Shared Helpers ====================

/** Resolve a numeric direction from two values, or null */
function detectDirection(prevNum, newNum) {
    if (isNaN(prevNum) || isNaN(newNum)) return null;
    if (newNum > prevNum) return 'up';
    if (newNum < prevNum) return 'down';
    return null;
}

/** Resolve first truthy value from candidate fields on an object */
const resolveFirst = (obj, fields, fallback = 0) => {
    for (const f of fields) {
        const v = f.includes('.') ? f.split('.').reduce((o, k) => o?.[k], obj) : obj[f];
        if (v !== undefined && v !== null) return v;
    }
    return fallback;
};

/** Field resolution config: [outputKey, candidateFields, fallback] */
const FIELD_MAP = [
    ['symbol', ['symbol', '_id'], ''],
    ['ltp', ['ltp', 'prices.ltp', 'close'], 0],
    ['change', ['change', 'prices.change'], 0],
    ['changePercent', ['changePercent', 'prices.changePercent'], 0],
    ['companyName', ['companyName', 'name', 'symbol'], ''],
    ['sector', ['sector'], 'Others'],
    ['volume', ['volume', 'trading.volume'], 0],
];

/** Resolve common stock fields from various API shapes */
function resolveStockFields(stock) {
    const result = {};
    for (const [key, fields, fallback] of FIELD_MAP) {
        result[key] = resolveFirst(stock, fields, fallback);
    }
    return result;
}

/** Get sign prefix for a change value */
const changeSign = (val) => val > 0 ? '+' : val < 0 ? '-' : '';

/** Format a change value with sign, or '-' if zero */
const formatChangeValue = (v, sign) => (!v || v === 0) ? '-' : `${sign}${v?.toFixed(2)}`;

/** Get CSS class for a change value's direction */
const changePillClass = (val) => val > 0 ? 'positive' : val < 0 ? 'negative' : '';

// ==================== AnimatedCell ====================

const AnimatedCell = memo(function AnimatedCell({
    value,
    previousValue,
    className = '',
    formatter = (v) => v,
    showDirection = false
}) {
    const [isUpdated, setIsUpdated] = useState(false);
    const [direction, setDirection] = useState(null);

    useEffect(() => {
        if (previousValue === undefined || previousValue === value) return;

        const prevNum = parseFloat(previousValue);
        const newNum = parseFloat(value);

        if (showDirection) {
            setDirection(detectDirection(prevNum, newNum));
        }

        setIsUpdated(true);

        const timer = setTimeout(() => {
            setIsUpdated(false);
            setDirection(null);
        }, 500);

        return () => clearTimeout(timer);
    }, [value, previousValue, showDirection]);

    const classes = [
        'stock-value',
        className,
        isUpdated && 'value-updated',
        isUpdated && direction === 'up' && 'value-up',
        isUpdated && direction === 'down' && 'value-down'
    ].filter(Boolean).join(' ');

    return <span className={classes}>{formatter(value)}</span>;
});

// ==================== Column Config ====================

const SORTABLE_COLUMNS = [
    { key: 'symbol', label: 'Symbol', align: '' },
    { key: 'companyName', label: 'Company', align: '' },
    { key: 'ltp', label: 'LTP', align: 'text-right' },
    { key: 'change', label: 'Change', align: 'text-right' },
    { key: 'changePercent', label: 'Change %', align: 'text-right' },
    { key: 'volume', label: 'Volume', align: 'text-right' },
];

// ==================== Sub-Components ====================

/** Single sortable table header cell */
function SortableHeader({ col, sortConfig, onSort }) {
    const isActive = sortConfig.key === col.key;
    const ariaSort = isActive ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none';

    return (
        <th
            onClick={() => onSort(col.key)}
            className={`sortable ${col.align} group`}
            aria-sort={ariaSort}
        >
            <div className={`flex items-center ${col.align === 'text-right' ? 'justify-end' : ''} gap-2`}>
                {col.label}
                <ChevronDown className={`sort-icon ${isActive ? `active ${sortConfig.direction}` : ''}`} />
            </div>
        </th>
    );
}

/** Favorite star cell */
function FavoriteCell({ symbol, favorites, onToggleFavorite }) {
    const isFav = favorites.includes(symbol);
    return (
        <td
            className="star-cell"
            onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite && onToggleFavorite(symbol);
            }}
            style={{ width: '40px', cursor: 'pointer' }}
        >
            <Star
                size={18}
                className={`star-icon ${isFav ? 'active' : ''}`}
                fill={isFav ? 'var(--primary-accent)' : 'none'}
                stroke={isFav ? 'var(--primary-accent)' : '#D1D5DB'}
            />
        </td>
    );
}

/** Single desktop stock table row */
const StockRow = memo(function StockRow({ stock, onRowClick, getPreviousValue, favorites, onToggleFavorite }) {
    const f = resolveStockFields(stock);
    const sign = changeSign(f.change);
    const pillClass = changePillClass(f.change);

    return (
        <tr key={f.symbol} onClick={() => onRowClick && onRowClick(stock)} className="clickable-row">
            <FavoriteCell symbol={f.symbol} favorites={favorites} onToggleFavorite={onToggleFavorite} />
            <td className="symbol-cell">{stock.symbol}</td>
            <td className="company-cell">{f.companyName}</td>
            <td className="sector-cell">{f.sector}</td>
            <td className="text-right financial-cell ltp-cell">
                <AnimatedCell
                    value={f.ltp}
                    previousValue={getPreviousValue(f.symbol, 'ltp')}
                    formatter={formatPrice}
                    showDirection={true}
                />
            </td>
            <td className="text-right financial-cell">
                <div className={`change-pill ${pillClass}`}>
                    <AnimatedCell
                        value={Math.abs(f.change)}
                        previousValue={Math.abs(getPreviousValue(f.symbol, 'change') || 0)}
                        formatter={(v) => formatChangeValue(v, sign)}
                    />
                </div>
            </td>
            <td className="text-right financial-cell">
                <div className={`change-percent-badge ${pillClass}`}>
                    <AnimatedCell
                        value={Math.abs(f.changePercent)}
                        previousValue={Math.abs(getPreviousValue(f.symbol, 'changePercent') || 0)}
                        formatter={(v) => (!v || v === 0) ? '-' : `${sign}${v?.toFixed(2)}%`}
                    />
                </div>
            </td>
            <td className="text-right financial-cell volume-cell">
                <AnimatedCell
                    value={f.volume}
                    previousValue={getPreviousValue(f.symbol, 'volume')}
                    formatter={(v) => v === 0 ? '-' : formatNumber(v)}
                    showDirection={false}
                />
            </td>
        </tr>
    );
});

/** Single mobile stock card */
function MobileStockCard({ stock, onRowClick, getPreviousValue }) {
    const f = resolveStockFields(stock);
    const sign = changeSign(f.change);
    const priceClass = f.change > 0 ? 'price-up' : f.change < 0 ? 'price-down' : 'price-unchanged';

    return (
        <div className="stock-card" key={f.symbol} onClick={() => onRowClick && onRowClick(stock)}>
            <div className="card-header">
                <span className="stock-symbol">{stock.symbol}</span>
                <span className="stock-ltp">
                    <AnimatedCell
                        value={f.ltp}
                        previousValue={getPreviousValue(f.symbol, 'ltp')}
                        formatter={formatPrice}
                        showDirection={true}
                    />
                </span>
            </div>
            <div className="card-body">
                <span className="stock-name">{f.companyName}</span>
                <span className={`stock-change stock-card-change ${priceClass}`}>
                    <AnimatedCell
                        value={Math.abs(f.change)}
                        previousValue={Math.abs(getPreviousValue(f.symbol, 'change') || 0)}
                        formatter={(v) => `${sign}${v?.toFixed(2)} (${f.changePercent?.toFixed(2)}%)`}
                    />
                </span>
            </div>
        </div>
    );
}

/** Pagination controls */
function PaginationControls({ currentPage, totalPages, onPageChange }) {
    return (
        <div className="flex items-center justify-center gap-4 my-8 pagination">
            <button
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed btn btn-secondary"
                onClick={() => onPageChange && onPageChange(currentPage - 1)}
                disabled={currentPage <= 1}
            >
                <ChevronLeft className="w-4 h-4" />
                Previous
            </button>
            <span className="text-sm text-gray-300 pagination-info">
                Page {currentPage} of {totalPages}
            </span>
            <button
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed btn btn-secondary"
                onClick={() => onPageChange && onPageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
            >
                Next
                <ChevronRight className="w-4 h-4" />
            </button>
        </div>
    );
}

// ==================== StockTable ====================

function StockTable({
    stocks = [],
    previousStocks = [],
    onRowClick,
    showPagination = true,
    currentPage = 1,
    totalPages = 1,
    onPageChange,
    isPolling = false,
    loading = false,
    favorites = [],
    onToggleFavorite
}) {
    const [sortConfig, setSortConfig] = useState({ key: 'symbol', direction: 'asc' });

    // Create a map of previous stock values for comparison
    const prevStockMap = useRef(new Map());

    useEffect(() => {
        const newMap = new Map();
        stocks.forEach(stock => {
            newMap.set(stock.symbol, {
                ltp: stock.ltp,
                change: stock.change,
                changePercent: stock.changePercent,
                volume: stock.volume
            });
        });

        // Store current as previous for next update
        setTimeout(() => {
            prevStockMap.current = newMap;
        }, 600); // After animation completes
    }, [stocks]);

    const getPreviousValue = useCallback((symbol, field) => {
        return prevStockMap.current.get(symbol)?.[field];
    }, []);

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    /** Resolve the sort value for a stock, handling nested fields */
    const resolveSortValue = (stock, key) => {
        if (key === 'ltp') return stock.ltp || stock.prices?.ltp || 0;
        return stock[key];
    };

    const sortedStocks = [...stocks].sort((a, b) => {
        const aVal = resolveSortValue(a, sortConfig.key);
        const bVal = resolveSortValue(b, sortConfig.key);
        const dir = sortConfig.direction === 'asc' ? 1 : -1;
        if (aVal < bVal) return -dir;
        if (aVal > bVal) return dir;
        return 0;
    });

    const isMobile = useMediaQuery('(max-width: 768px)');

    const shouldShowPagination = showPagination && totalPages > 1;

    return (
        <div className="stock-table-wrapper">
            {isMobile ? (
                <div className="mobile-card-container">
                    {sortedStocks.map((stock) => (
                        <MobileStockCard
                            key={stock.symbol || stock._id}
                            stock={stock}
                            onRowClick={onRowClick}
                            getPreviousValue={getPreviousValue}
                        />
                    ))}
                </div>
            ) : (
                <div className="table-container desktop-table-container">
                    <table className="stock-table">
                        <thead>
                            <tr>
                                <th className="star-column-header" style={{ width: '40px' }}></th>
                                {SORTABLE_COLUMNS.slice(0, 2).map(col => (
                                    <SortableHeader key={col.key} col={col} sortConfig={sortConfig} onSort={handleSort} />
                                ))}
                                <th>Sector</th>
                                {SORTABLE_COLUMNS.slice(2).map(col => (
                                    <SortableHeader key={col.key} col={col} sortConfig={sortConfig} onSort={handleSort} />
                                ))}
                            </tr>
                        </thead>
                        <tbody className={isPolling ? 'polling' : ''}>
                            {sortedStocks.map((stock) => (
                                <StockRow
                                    key={stock.symbol || stock._id}
                                    stock={stock}
                                    onRowClick={onRowClick}
                                    getPreviousValue={getPreviousValue}
                                    favorites={favorites}
                                    onToggleFavorite={onToggleFavorite}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {shouldShowPagination && (
                <PaginationControls
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={onPageChange}
                />
            )}
        </div>
    );
}

export default memo(StockTable);
