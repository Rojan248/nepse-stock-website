import { useState, useEffect, useRef, memo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
    loading = false
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

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return '↕';
        return sortConfig.direction === 'asc' ? '↑' : '↓';
    };

    if (loading) {
        return (
            <div className="no-data">
                <p>Loading stocks...</p>
            </div>
        );
    }

    if (!stocks || stocks.length === 0) {
        return (
            <div className="no-data">
                <p>No stocks available</p>
            </div>
        );
    }

    return (
        <div className="stock-table-wrapper">
            <div className="table-container">
                <table className="stock-table">
                    <thead>
                        <tr>
                            <th onClick={() => handleSort('symbol')} className="sortable">
                                Symbol {getSortIcon('symbol')}
                            </th>
                            <th onClick={() => handleSort('companyName')} className="sortable">
                                Company {getSortIcon('companyName')}
                            </th>
                            <th>Sector</th>
                            <th onClick={() => handleSort('ltp')} className="sortable text-right">
                                LTP {getSortIcon('ltp')}
                            </th>
                            <th onClick={() => handleSort('change')} className="sortable text-right">
                                Change {getSortIcon('change')}
                            </th>
                            <th onClick={() => handleSort('changePercent')} className="sortable text-right">
                                Change % {getSortIcon('changePercent')}
                            </th>
                            <th onClick={() => handleSort('volume')} className="sortable text-right">
                                Volume {getSortIcon('volume')}
                            </th>
                            <th className="text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody className={isPolling ? 'polling' : ''}>
                        {sortedStocks.map((stock) => {
                            // Use change value for color determination (more precise than percent)
                            const changeVal = stock.change !== undefined ? stock.change : (stock.prices?.change || 0);
                            const changeClass = getChangeClass(changeVal);
                            const symbol = stock.symbol || stock._id;

                            return (
                                <tr
                                    key={symbol}
                                    onClick={() => onRowClick && onRowClick(stock)}
                                    className="clickable"
                                >
                                    <td className="symbol-cell">
                                        <span className="stock-symbol-badge">{stock.symbol}</span>
                                    </td>
                                    <td className="company-cell">
                                        {stock.companyName || stock.symbol}
                                    </td>
                                    <td>
                                        <span className="sector-tag">{stock.sector || 'Others'}</span>
                                    </td>
                                    <td className="text-right font-bold">
                                        <AnimatedCell
                                            value={stock.ltp || stock.prices?.ltp || stock.close || 0}
                                            previousValue={getPreviousValue(symbol, 'ltp')}
                                            formatter={formatPrice}
                                            showDirection={true}
                                        />
                                    </td>
                                    <td className={`text-right ${changeClass}`}>
                                        <AnimatedCell
                                            value={stock.change || stock.prices?.change || 0}
                                            previousValue={getPreviousValue(symbol, 'change')}
                                            formatter={(v) => `${v >= 0 ? '+' : ''}${v?.toFixed(2) || '0.00'}`}
                                            showDirection={true}
                                        />
                                    </td>
                                    <td className={`text-right ${changeClass}`}>
                                        <AnimatedCell
                                            value={stock.changePercent || stock.prices?.changePercent || 0}
                                            previousValue={getPreviousValue(symbol, 'changePercent')}
                                            formatter={formatPercent}
                                            showDirection={true}
                                        />
                                    </td>
                                    <td className="text-right">
                                        <AnimatedCell
                                            value={stock.volume || stock.trading?.volume || 0}
                                            previousValue={getPreviousValue(symbol, 'volume')}
                                            formatter={formatNumber}
                                            showDirection={false}
                                        />
                                    </td>
                                    <td className="text-center">
                                        <Link
                                            to={`/stock/${stock.symbol}`}
                                            className="btn btn-secondary btn-sm"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            View
                                        </Link>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

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
