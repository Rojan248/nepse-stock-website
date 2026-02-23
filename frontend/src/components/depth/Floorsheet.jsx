/**
 * Floorsheet Component
 * Displays recent trades with buyer/seller broker information
 */

import { formatPrice, formatNumber } from '../../utils/formatting';
import './Floorsheet.css';

function Floorsheet({ symbol, data, loading }) {
    if (loading) {
        return (
            <div className="floorsheet-loading">
                <div className="floorsheet-spinner"></div>
                <span>Loading floorsheet...</span>
            </div>
        );
    }

    if (!data || !data.floorsheet || data.floorsheet.length === 0) {
        return (
            <div className="floorsheet-empty">
                <span>No recent trades available (Market may be closed)</span>
            </div>
        );
    }

    const { floorsheet } = data;

    return (
        <div className="floorsheet">
            <div className="floorsheet-header">
                <span className="floorsheet-title">Recent Trades</span>
                <span className="floorsheet-source">{data?.source === 'mock' ? '(Demo Data)' : '(Live)'}</span>
            </div>

            <div className="floorsheet-table-wrapper">
                <table className="floorsheet-table">
                    <thead>
                        <tr>
                            <th>Trans ID</th>
                            <th>Buyer</th>
                            <th>Seller</th>
                            <th className="text-right">Qty</th>
                            <th className="text-right">Rate</th>
                            <th className="text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {floorsheet.map((trade, idx) => (
                            <tr key={trade.transId || idx}>
                                <td className="trans-id">{trade.transId}</td>
                                <td>
                                    <span className="broker-badge broker-buyer">{trade.buyerBroker}</span>
                                </td>
                                <td>
                                    <span className="broker-badge broker-seller">{trade.sellerBroker}</span>
                                </td>
                                <td className="text-right mono">{formatNumber(trade.quantity)}</td>
                                <td className="text-right mono">{formatPrice(trade.rate)}</td>
                                <td className="text-right mono amount">{formatPrice(trade.amount)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default Floorsheet;
