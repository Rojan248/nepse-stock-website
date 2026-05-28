import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CandlestickSeries, LineSeries } from 'lightweight-charts';

const normalizeChartData = (data) => {
    const byDate = new Map();

    for (const item of data || []) {
        if (!item?.date) continue;
        byDate.set(item.date.split('T')[0], item);
    }

    return [...byDate.entries()]
        .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
        .map(([date, item]) => ({ date, item }));
};

function useStockChart(chartContainerRef, data, showMA20, showMA50) {
    const chartRef = useRef();
    const candlestickSeriesRef = useRef();
    const ma20SeriesRef = useRef();
    const ma50SeriesRef = useRef();

    useEffect(() => {
        if (!chartContainerRef.current || chartRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            layout: { background: { type: ColorType.Solid, color: '#111111' }, textColor: '#d1d4dc' },
            grid: { vertLines: { color: 'rgba(42, 46, 57, 0.5)' }, horzLines: { color: 'rgba(42, 46, 57, 0.5)' } },
            rightPriceScale: { borderColor: 'rgba(197, 203, 206, 0.8)' },
            timeScale: { borderColor: 'rgba(197, 203, 206, 0.8)', timeVisible: true, secondsVisible: false },
            crosshair: { mode: 0 },
            width: chartContainerRef.current.clientWidth,
            height: 400,
        });

        candlestickSeriesRef.current = chart.addSeries(CandlestickSeries, {
            upColor: '#26a69a', downColor: '#ef5350', borderVisible: false,
            wickUpColor: '#26a69a', wickDownColor: '#ef5350',
        });

        ma20SeriesRef.current = chart.addSeries(LineSeries, { color: '#2196F3', lineWidth: 2, title: 'MA20', visible: false });
        ma50SeriesRef.current = chart.addSeries(LineSeries, { color: '#FF9800', lineWidth: 2, title: 'MA50', visible: false });

        chartRef.current = chart;

        const handleResize = () => chart.applyOptions({ width: chartContainerRef.current.clientWidth });
        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
            chartRef.current = undefined;
            candlestickSeriesRef.current = undefined;
            ma20SeriesRef.current = undefined;
            ma50SeriesRef.current = undefined;
        };
    }, []);

    useEffect(() => {
        if (!data || data.length === 0 || !candlestickSeriesRef.current) return;

        const chartData = normalizeChartData(data);

        candlestickSeriesRef.current.setData(chartData.map(({ date, item }) => ({
            time: date, open: item.open, high: item.high, low: item.low, close: item.close,
        })));

        ma20SeriesRef.current.setData(chartData.filter(({ item }) => item.ma20).map(({ date, item }) => ({ time: date, value: item.ma20 })));
        ma50SeriesRef.current.setData(chartData.filter(({ item }) => item.ma50).map(({ date, item }) => ({ time: date, value: item.ma50 })));
        chartRef.current.timeScale().fitContent();
    }, [data]);

    useEffect(() => {
        if (ma20SeriesRef.current) ma20SeriesRef.current.applyOptions({ visible: showMA20 });
    }, [showMA20]);

    useEffect(() => {
        if (ma50SeriesRef.current) ma50SeriesRef.current.applyOptions({ visible: showMA50 });
    }, [showMA50]);
}

/**
 * StockChart Component
 * Renders an interactive candlestick/line chart using TradingView's lightweight-charts.
 *
 * @param {Object} props
 * @param {string} props.symbol - Stock symbol
 * @param {Array} props.data - Historical data array [{date, open, high, low, close, ma20, ma50}]
 * @param {boolean} props.isLoading - Loading state
 */
const StockChart = ({ symbol, data, isLoading }) => {
    const chartContainerRef = useRef();
    const [showMA20, setShowMA20] = useState(false);
    const [showMA50, setShowMA50] = useState(false);

    useStockChart(chartContainerRef, data, showMA20, showMA50);

    return (
        <div style={{ position: 'relative', background: '#111', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ color: '#fff', fontSize: '1.2rem', margin: 0 }}>{symbol} Chart</h3>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <label style={{ color: '#d1d4dc', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={showMA20} onChange={(e) => setShowMA20(e.target.checked)} />
                        MA20
                    </label>
                    <label style={{ color: '#d1d4dc', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                        <input type="checkbox" checked={showMA50} onChange={(e) => setShowMA50(e.target.checked)} />
                        MA50
                    </label>
                </div>
            </div>

            <div ref={chartContainerRef} style={{ width: '100%', height: '400px' }} />

            {isLoading && (
                <div style={{ position: 'absolute', inset: '52px 16px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', background: '#111' }}>
                    Loading data...
                </div>
            )}

            {!isLoading && data.length === 0 && (
                <div style={{ position: 'absolute', inset: '52px 16px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', background: '#111' }}>
                    No historical data available for this symbol.
                </div>
            )}
        </div>
    );
};

export default StockChart;
