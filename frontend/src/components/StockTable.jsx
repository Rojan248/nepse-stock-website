import { useState, useEffect, useRef, memo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ChevronDown, Star } from 'lucide-react';
import { formatPrice, formatPercent, formatNumber, getChangeClass } from '../utils/formatting';
import './StockTable.css';
import './AnimatedValue.css';

/**
 * Individual stock value cell with animation support
 */
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
        if (previousValue !== undefined && previousValue !== value) {
            // Determine direction
            const prevNum = parseFloat(previousValue);
            const newNum = parseFloat(value);

            if (!isNaN(prevNum) && !isNaN(newNum) && showDirection) {
                setDirection(newNum > prevNum ? 'up' : newNum < prevNum ? 'down' : null);
            }

            setIsUpdated(true);

            const timer = setTimeout(() => {
                setIsUpdated(false);
                setDirection(null);
            }, 500);

            return () => clearTimeout(timer);
        }
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
        // Update previous stock map when stocks change
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

    const sortedStocks = [...stocks].sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        // Handle nested properties
        if (sortConfig.key === 'ltp') {
            aVal = a.ltp || a.prices?.ltp || 0;
            bVal = b.ltp || b.prices?.ltp || 0;
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });



    const renderMobileCards = () => {
        return (
            <div className="mobile-card-container">
                {sortedStocks.map((stock) => {
                    // Use change value for color determination
                    const changeVal = stock.change !== undefined ? stock.change : (stock.prices?.change || 0);
                    const percentVal = stock.changePercent !== undefined ? stock.changePercent : (stock.prices?.changePercent || 0);
                    const isPositive = changeVal > 0;
                    const isNegative = changeVal < 0;

                    const symbol = stock.symbol || stock._id;
                    const ltp = stock.ltp || stock.prices?.ltp || stock.close || 0;

                    return (
                        <div className="stock-card" key={symbol} onClick={() => onRowClick && onRowClick(stock)}>
                            <div className="card-header">
                                <span className="stock-symbol">{stock.symbol}</span>
                                <span className="stock-ltp">
                                    <AnimatedCell
                                        value={ltp}
                                        previousValue={getPreviousValue(symbol, 'ltp')}
                                        formatter={formatPrice}
                                        showDirection={true}
                                    />
                                </span>
                            </div>
                            <div className="card-body">
                                <span className="stock-name">{stock.companyName || stock.name || stock.symbol}</span>
                                <span className={`stock-change ${isPositive ? 'stock-card-change price-up' : isNegative ? 'stock-card-change price-down' : 'stock-card-change price-unchanged'}`}>
                                    <AnimatedCell
                                        value={Math.abs(changeVal)}
                                        previousValue={Math.abs(getPreviousValue(symbol, 'change') || 0)}
                                        formatter={(v) => `${isPositive ? '+' : isNegative ? '-' : ''}${v?.toFixed(2)} (${percentVal?.toFixed(2)}%)`}
                                    />
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="stock-table-wrapper">
            <div className="table-container desktop-table-container">
                <table className="stock-table">
                    <thead>
                        <tr>
                            <th className="star-column-header" style={{ width: '40px' }}></th>
                            <th
                                onClick={() => handleSort('symbol')}
                                className="sortable group"
                                aria-sort={sortConfig.key === 'symbol' ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                            >
                                <div className="flex items-center gap-2">
                                    Symbol
                                    <ChevronDown className={`sort-icon ${sortConfig.key === 'symbol' ? `active ${sortConfig.direction}` : ''}`} />
                                </div>
                            </th>
                            <th
                                onClick={() => handleSort('companyName')}
                                className="sortable group"
                                aria-sort={sortConfig.key === 'companyName' ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                            >
                                <div className="flex items-center gap-2">
                                    Company
                                    <ChevronDown className={`sort-icon ${sortConfig.key === 'companyName' ? `active ${sortConfig.direction}` : ''}`} />
                                </div>
                            </th>
                            <th>Sector</th>
                            <th
                                onClick={() => handleSort('ltp')}
                                className="sortable text-right group"
                                aria-sort={sortConfig.key === 'ltp' ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                            >
                                <div className="flex items-center justify-end gap-2">
                                    LTP
                                    <ChevronDown className={`sort-icon ${sortConfig.key === 'ltp' ? `active ${sortConfig.direction}` : ''}`} />
                                </div>
                            </th>
                            <th
                                onClick={() => handleSort('change')}
                                className="sortable text-right group"
                                aria-sort={sortConfig.key === 'change' ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                            >
                                <div className="flex items-center justify-end gap-2">
                                    Change
                                    <ChevronDown className={`sort-icon ${sortConfig.key === 'change' ? `active ${sortConfig.direction}` : ''}`} />
                                </div>
                            </th>
                            <th
                                onClick={() => handleSort('changePercent')}
                                className="sortable text-right group"
                                aria-sort={sortConfig.key === 'changePercent' ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                            >
                                <div className="flex items-center justify-end gap-2">
                                    Change %
                                    <ChevronDown className={`sort-icon ${sortConfig.key === 'changePercent' ? `active ${sortConfig.direction}` : ''}`} />
                                </div>
                            </th>
                            <th
                                onClick={() => handleSort('volume')}
                                className="sortable text-right group"
                                aria-sort={sortConfig.key === 'volume' ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                            >
                                <div className="flex items-center justify-end gap-2">
                                    Volume
                                    <ChevronDown className={`sort-icon ${sortConfig.key === 'volume' ? `active ${sortConfig.direction}` : ''}`} />
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody className={isPolling ? 'polling' : ''}>
                        {sortedStocks.map((stock) => {
                            // Use change value for color determination
                            const changeVal = stock.change !== undefined ? stock.change : (stock.prices?.change || 0);
                            const percentVal = stock.changePercent !== undefined ? stock.changePercent : (stock.prices?.changePercent || 0);
                            const isPositive = changeVal > 0;
                            const isNegative = changeVal < 0;

                            const symbol = stock.symbol || stock._id;

                            return (
                                <tr
                                    key={symbol}
                                    onClick={() => onRowClick && onRowClick(stock)}
                                    className="clickable-row"
                                >
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
                                            className={`star-icon ${favorites.includes(symbol) ? 'active' : ''}`}
                                            fill={favorites.includes(symbol) ? 'var(--primary-accent)' : 'none'}
                                            stroke={favorites.includes(symbol) ? 'var(--primary-accent)' : '#D1D5DB'}
                                        />
                                    </td>
                                    <td className="symbol-cell">
                                        {stock.symbol}
                                    </td>
                                    <td className="company-cell">
                                        {stock.companyName || stock.symbol}
                                    </td>
                                    <td className="sector-cell">
                                        {stock.sector || 'Others'}
                                    </td>
                                    <td className="text-right financial-cell ltp-cell">
                                        <AnimatedCell
                                            value={stock.ltp || stock.prices?.ltp || stock.close || 0}
                                            previousValue={getPreviousValue(symbol, 'ltp')}
                                            formatter={formatPrice}
                                            showDirection={true}
                                        />
                                    </td>
                                    <td className="text-right financial-cell">
                                        <div className={`change-pill ${isPositive ? 'positive' : isNegative ? 'negative' : ''}`}>
                                            <AnimatedCell
                                                value={Math.abs(changeVal)}
                                                previousValue={Math.abs(getPreviousValue(symbol, 'change') || 0)}
                                                formatter={(v) => `${isPositive ? '+' : isNegative ? '-' : ''}${v?.toFixed(2)}`}
                                            />
                                        </div>
                                    </td>
                                    <td className="text-right financial-cell">
                                        <div className={`change-percent-badge ${isPositive ? 'positive' : isNegative ? 'negative' : ''}`}>
                                            <AnimatedCell
                                                value={Math.abs(percentVal)}
                                                previousValue={Math.abs(getPreviousValue(symbol, 'changePercent') || 0)}
                                                formatter={(v) => `${isPositive ? '+' : isNegative ? '-' : ''}${v?.toFixed(2)}%`}
                                            />
                                        </div>
                                    </td>
                                    <td className="text-right financial-cell volume-cell">
                                        <AnimatedCell
                                            value={stock.volume || stock.trading?.volume || 0}
                                            previousValue={getPreviousValue(symbol, 'volume')}
                                            formatter={formatNumber}
                                            showDirection={false}
                                        />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {renderMobileCards()}

            {showPagination && totalPages > 1 && (
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
            )}
        </div>
    );
}

export default memo(StockTable);
