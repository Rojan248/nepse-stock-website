import React, { useMemo } from 'react';
import './SectorChart.css';

const EXCLUDED_SECTORS = new Set(['Promoter Share', 'Corporate Debenture', 'Trading']);

const SECTOR_NAME_MAP = {
    'Manufacturing And Processing': 'Manufacturing',
    'Hydropower': 'Hydro Power',
    'Hydro Power': 'Hydro Power',
};

/** Shorten verbose sector names for display */
const formatSector = (name) => SECTOR_NAME_MAP[name] || name;

/** Calculate percentage with safe division */
const calcPercentage = (count, total) =>
    total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';

/**
 * Custom hook: aggregate stocks into sorted sector stats
 */
const useSectorData = (stocks) => {
    return useMemo(() => {
        if (!stocks || stocks.length === 0) return { data: [], totalCount: 0 };

        const sectorStats = {};

        for (const stock of stocks) {
            const sector = stock.sector || 'Others';
            if (EXCLUDED_SECTORS.has(sector)) continue;

            if (!sectorStats[sector]) {
                sectorStats[sector] = { name: sector, count: 0, turnover: 0 };
            }
            sectorStats[sector].count += 1;
            sectorStats[sector].turnover += parseFloat(stock.turnover || 0);
        }

        const sectorArray = Object.values(sectorStats).sort((a, b) => b.count - a.count);
        const total = sectorArray.reduce((sum, s) => sum + s.count, 0);

        return { data: sectorArray, totalCount: total };
    }, [stocks]);
};

/** Loading skeleton shown while stocks are being fetched */
function SectorChartSkeleton() {
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

/** Single horizontal bar row for a sector */
function SectorBar({ sector, totalCount }) {
    const percentage = calcPercentage(sector.count, totalCount);
    return (
        <div className="chart-row">
            <div className="label">{formatSector(sector.name)}</div>
            <div className="bar-area" style={{ '--target-width': `${percentage}%` }}>
                <div className="bar"></div>
                <div className="values">
                    <strong>{percentage}%</strong>
                    <span>({sector.count})</span>
                </div>
            </div>
        </div>
    );
}

const SectorChart = ({ stocks }) => {
    const { data, totalCount } = useSectorData(stocks);

    if (!stocks || stocks.length === 0) {
        return <SectorChartSkeleton />;
    }

    if (data.length === 0) return null;

    return (
        <div className="market-box">
            <div className="market-header">
                <div>
                    <h3>Market Structure</h3>
                    <p>Distribution of stocks per sector · Total {totalCount} stocks</p>
                </div>
                <div className="legend">
                    <span className="dot"></span> Sector Weight
                </div>
            </div>

            <div className="chart-container">
                {data.map((sector) => (
                    <SectorBar key={sector.name} sector={sector} totalCount={totalCount} />
                ))}
            </div>
        </div>
    );
};

export default SectorChart;

