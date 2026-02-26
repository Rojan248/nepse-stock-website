/**
 * Market Depth Component
 * Displays Bid/Ask order book with premium visualization
 */

import { useState, useEffect } from 'react';
import { formatPrice, formatNumber } from '../../utils/formatting';
import './MarketDepth.css';

function MarketDepth({ symbol, data, loading }) {
    if (loading) {
        return (
            <div className="depth-loading">
                <div className="depth-spinner"></div>
                <span>Loading market depth...</span>
            </div>
        );
    }

    if (!data || !data.marketDepth) {
        return (
            <div className="depth-empty">
                <span>No market depth data available</span>
            </div>
        );
    }

    const { buy, sell } = data.marketDepth;

    if (buy.length === 0 && sell.length === 0) {
        return (
            <div className="depth-empty">
                <span>Market is currently closed or no orders available</span>
            </div>
        );
    }

    // Calculate max quantities for volume bars
    const maxBuyQty = Math.max(...buy.map(b => b.quantity), 1);
    const maxSellQty = Math.max(...sell.map(s => s.quantity), 1);

    return (
        <div className="market-depth">
            <div className="depth-header">
                <span className="depth-title">Order Book</span>
                <span className="depth-source">{data?.source === 'mock' ? '(Demo Data)' : '(Live)'}</span>
            </div>

            <div className="depth-container">
                {/* Buy Side (Left) */}
                <div className="depth-side depth-buy">
                    <div className="depth-side-header">
                        <span className="depth-col">Orders</span>
                        <span className="depth-col">Qty</span>
                        <span className="depth-col">Bid</span>
                    </div>
                    <div className="depth-rows">
                        {buy.map((order, idx) => {
                            const widthPercent = (order.quantity / maxBuyQty) * 100;
                            return (
                                <div key={idx} className="depth-row">
                                    <div
                                        className="depth-bar depth-bar-buy"
                                        style={{ width: `${widthPercent}%` }}
                                    ></div>
                                    <span className="depth-cell">{order.orders}</span>
                                    <span className="depth-cell">{formatNumber(order.quantity)}</span>
                                    <span className="depth-cell depth-price">{formatPrice(order.rate)}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Divider */}
                <div className="depth-divider"></div>

                {/* Sell Side (Right) */}
                <div className="depth-side depth-sell">
                    <div className="depth-side-header">
                        <span className="depth-col">Ask</span>
                        <span className="depth-col">Qty</span>
                        <span className="depth-col">Orders</span>
                    </div>
                    <div className="depth-rows">
                        {sell.map((order, idx) => {
                            const widthPercent = (order.quantity / maxSellQty) * 100;
                            return (
                                <div key={idx} className="depth-row depth-row-sell">
                                    <div
                                        className="depth-bar depth-bar-sell"
                                        style={{ width: `${widthPercent}%` }}
                                    ></div>
                                    <span className="depth-cell depth-price">{formatPrice(order.rate)}</span>
                                    <span className="depth-cell">{formatNumber(order.quantity)}</span>
                                    <span className="depth-cell">{order.orders}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default MarketDepth;
