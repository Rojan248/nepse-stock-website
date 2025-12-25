import React, { useMemo } from 'react';
import './SectorChart.css';

const SectorChart = ({ stocks }) => {
    const data = useMemo(() => {
        if (!stocks || stocks.length === 0) return [];

        const sectorStats = {};

        stocks.forEach(stock => {
            const sector = stock.sector || 'Others';
            if (!sectorStats[sector]) {
                sectorStats[sector] = { name: sector, count: 0, turnover: 0 };
            }
            sectorStats[sector].count += 1;
            sectorStats[sector].turnover += parseFloat(stock.turnover || 0);
        });

        // Convert to array and sort by count descending
        return Object.values(sectorStats)
            .sort((a, b) => b.count - a.count)
            .slice(0, 10); // Show top 10 sectors
    }, [stocks]);

    // Show loading skeleton if no data
    if (!stocks || stocks.length === 0) {
        return (
            <div className="market-box-skeleton">
                <div className="skeleton-header">
                    <div className="skeleton-title"></div>
                    <div className="skeleton-legend"></div>
                </div>
                <div className="skeleton-rows">
                    {[...Array(8)].map((_, i) => (
                        <div className="skeleton-row" key={i}>
                            <div className="skeleton-label"></div>
                            <div className="skeleton-bar"></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (data.length === 0) return null;

    // Helper to clean names
    const formatSector = (name) => {
        if (name.includes("Manufacturing")) return "Manufacturing";
        if (name.includes("Hydro")) return "Hydro Power";
        return name;
    };

    // Calculate max count for percentage calculation
    const maxCount = Math.max(...data.map(d => d.count));

    return (
        <div className="market-box">
            <div className="market-header">
                <div>
                    <h3>Market Structure</h3>
                    <p>Distribution of stocks per sector</p>
                </div>
                <div className="legend">
                    <span className="dot"></span> Sector Weight
                </div>
            </div>

            <div className="chart-container">
                {data.map((sector, index) => {
                    const percentage = ((sector.count / maxCount) * 100).toFixed(0);

                    return (
                        <div className="chart-row" key={sector.name}>
                            <div className="label">{formatSector(sector.name)}</div>
                            <div className="bar-area">
                                <div className="bar" style={{ '--target-width': `${percentage}%` }}></div>
                                <div className="values">
                                    <strong>{percentage}%</strong>
                                    <span>({sector.count})</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default SectorChart;
