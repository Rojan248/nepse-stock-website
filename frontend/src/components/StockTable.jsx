import { useState, useEffect, useRef, memo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ChevronDown, Star } from 'lucide-react';
import { formatPrice, formatPercent, formatNumber, getChangeClass } from '../utils/formatting';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useSortedStocks } from '../hooks/useSortedStocks';
import { usePreviousStockValues } from '../hooks/usePreviousStockValues';
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

const NUMERIC_FIELDS = new Set(['ltp', 'change', 'changePercent', 'volume']);

const isBlankValue = (value) => value == null || value === '';

const toNumberOrNull = (value) => {
    if (isBlankValue(value)) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

/** Map timeframe to its source field on the stock object */
const TIMEFRAME_FIELD = {
    '1W': 'percentageChange1W',
    '1M': 'percentageChange1M',
};

/** Apply historical timeframe override to resolved fields */
function applyTimeframeOverride(result, stock, timeframe) {
    const field = TIMEFRAME_FIELD[timeframe];
    if (!field) return;

    const pct = toNumberOrNull(stock[field]);
    result.changePercent = pct;
    result.change = pct == null ? null : (pct === 0 ? 0 : result.ltp - (result.ltp / (1 + pct / 100)));
    if (pct == null) result.volume = null;
}

/** Resolve common stock fields from various API shapes */
function resolveStockFields(stock, timeframe = '1D') {
    const result = {};
    for (const [key, fields, fallback] of FIELD_MAP) {
        const value = resolveFirst(stock, fields, fallback);
        result[key] = NUMERIC_FIELDS.has(key) ? toNumberOrNull(value) ?? fallback : value;
    }
    
    applyTimeframeOverride(result, stock, timeframe);
    
    return result;
}

/** Get sign prefix for a change value */
const changeSign = (val) => val > 0 ? '+' : val < 0 ? '-' : '';

/** Format a change value with sign, or '0.00' if zero */
const formatChangeValue = (v, sign) => {
    const numeric = toNumberOrNull(v);
    return numeric == null ? '-' : (numeric === 0 ? '0.00' : `${sign}${numeric.toFixed(2)}`);
};

/** Get CSS class for a change value's direction */
const changePillClass = (val) => val > 0 ? 'positive' : val < 0 ? 'negative' : '';

// ==================== AnimatedCell ====================

/** Helper to determine animation direction class */
const getDirectionClass = (isUpdated, direction) => {
    if (!isUpdated) return '';
    return direction === 'up' ? 'value-up' : direction === 'down' ? 'value-down' : '';
};

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
        getDirectionClass(isUpdated, direction)
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

/** Format change percent with sign, or fallback */
const formatChangePercent = (v, sign) =>
    {
        const numeric = toNumberOrNull(v);
        return numeric == null ? '-' : (numeric === 0 ? '0.00%' : `${sign}${numeric.toFixed(2)}%`);
    };

/** Format volume, or fallback */
const formatVolume = (v) =>
    (v === null || v === undefined) ? '-' : (v === 0 ? '0' : formatNumber(v));

/** Unified change cell sub-component avoiding duplication */
function AnimatedChangeCell({ value, prevValue, changeClass, containerClass, formatter, sign }) {
    return (
        <td className="text-right financial-cell">
            <div className={`${containerClass} ${changeClass}`}>
                <AnimatedCell
                    value={value == null ? null : Math.abs(value)}
                    previousValue={Math.abs(prevValue || 0)}
                    formatter={(v) => formatter(v, sign)}
                />
            </div>
        </td>
    );
}

/** Single desktop stock table row */
const StockRow = memo(function StockRow({ stock, onRowClick, getPreviousValue, favorites, onToggleFavorite, timeframe }) {
    const f = resolveStockFields(stock, timeframe);
    const sign = changeSign(f.change);

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
            <AnimatedChangeCell 
                value={f.change} 
                prevValue={getPreviousValue(f.symbol, 'change')} 
                changeClass={changePillClass(f.change)} 
                containerClass="change-pill" 
                formatter={formatChangeValue} 
                sign={sign} 
            />
            <AnimatedChangeCell 
                value={f.changePercent} 
                prevValue={getPreviousValue(f.symbol, 'changePercent')} 
                changeClass={changePillClass(f.change)} 
                containerClass="change-percent-badge" 
                formatter={formatChangePercent} 
                sign={sign} 
            />
            <td className="text-right financial-cell volume-cell">
                <AnimatedCell
                    value={f.volume}
                    previousValue={getPreviousValue(f.symbol, 'volume')}
                    formatter={formatVolume}
                    showDirection={false}
                />
            </td>
        </tr>
    );
});

/** Single mobile stock card */
function MobileStockCard({ stock, onRowClick, getPreviousValue, timeframe }) {
    const f = resolveStockFields(stock, timeframe);
    const sign = changeSign(f.change);
    const priceClass = f.change > 0 ? 'price-up' : f.change < 0 ? 'price-down' : 'price-unchanged';

    const changeFormatter = (v) => {
        const change = toNumberOrNull(v);
        const changePercent = toNumberOrNull(f.changePercent);
        if (change == null || changePercent == null) return '-';
        return `${sign}${change.toFixed(2)} (${changePercent.toFixed(2)}%)`;
    };

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
                        value={f.change == null ? null : Math.abs(f.change)}
                        previousValue={Math.abs(getPreviousValue(f.symbol, 'change') || 0)}
                        formatter={changeFormatter}
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

/** Resolve a unique key for a stock */
const getStockKey = (stock) => stock.symbol || stock._id;

/** Mobile card list view */
function MobileStockView({ sortedStocks, onRowClick, getPreviousValue, timeframe }) {
    return (
        <div className="mobile-card-container">
            {sortedStocks.map((stock) => (
                <MobileStockCard
                    key={getStockKey(stock)}
                    stock={stock}
                    onRowClick={onRowClick}
                    getPreviousValue={getPreviousValue}
                    timeframe={timeframe}
                />
            ))}
        </div>
    );
}

/** Desktop table view */
function DesktopStockView({ sortedStocks, sortConfig, handleSort, isPolling, onRowClick, getPreviousValue, favorites, onToggleFavorite, timeframe }) {
    return (
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
                            key={getStockKey(stock)}
                            stock={stock}
                            onRowClick={onRowClick}
                            getPreviousValue={getPreviousValue}
                            favorites={favorites}
                            onToggleFavorite={onToggleFavorite}
                            timeframe={timeframe}
                        />
                    ))}
                </tbody>
            </table>
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
    const [timeframe, setTimeframe] = useState('1D');
    const { sortedStocks, sortConfig, handleSort } = useSortedStocks(stocks, 'symbol', 'asc', timeframe);
    const getPreviousValue = usePreviousStockValues(stocks);
    const isMobile = useMediaQuery('(max-width: 768px)');
    const shouldShowPagination = showPagination && totalPages > 1;

    const ViewComponent = isMobile ? MobileStockView : DesktopStockView;

    return (
        <div className="stock-table-wrapper">
            <div className="flex items-center justify-end mb-4 pr-1">
                <div className="flex bg-gray-800 rounded-lg p-1 gap-1">
                    {['1D', '1W', '1M'].map(tf => (
                        <button
                            key={tf}
                            onClick={() => setTimeframe(tf)}
                            className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                                timeframe === tf 
                                    ? 'bg-blue-600 text-white shadow' 
                                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                            }`}
                        >
                            {tf}
                        </button>
                    ))}
                </div>
            </div>

            <ViewComponent
                sortedStocks={sortedStocks}
                sortConfig={sortConfig}
                handleSort={handleSort}
                isPolling={isPolling}
                onRowClick={onRowClick}
                getPreviousValue={getPreviousValue}
                favorites={favorites}
                onToggleFavorite={onToggleFavorite}
                timeframe={timeframe}
            />

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
