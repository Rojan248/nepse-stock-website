import React, { useMemo } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts';

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

    if (data.length === 0) return null;

    // Helper to clean names
    const formatSector = (name) => {
        if (name.includes("Manufacturing")) return "MANUFACTURING";
        if (name.includes("Hydro")) return "HYDRO POWER";
        return name.toUpperCase();
    };

    return (
        <div className="sector-chart-container" style={{
            background: 'var(--bg-card)',
            padding: '1.5rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            marginTop: '2rem'
        }}>
            <h3 style={{
                fontSize: '0.875rem',
                fontWeight: '700',
                marginBottom: '1.5rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--text-secondary)'
            }}>
                Market Structure (Stocks per Sector)
            </h3>

            <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                    <BarChart
                        data={data}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--border-subtle)" />
                        <XAxis type="number" hide />
                        <YAxis
                            dataKey="name"
                            type="category"
                            width={160} /* FIXED WIDTH TO PREVENT WRAP */
                            tickFormatter={formatSector}
                            axisLine={false}
                            tickLine={false}
                            interval={0}
                            tick={{
                                fill: '#57534E',
                                fontSize: 10,
                                fontFamily: 'var(--font-mono)',
                                fontWeight: 500
                            }}
                        />
                        <Tooltip
                            cursor={{ fill: 'var(--bg-secondary)', opacity: 0.4 }}
                            contentStyle={{
                                backgroundColor: 'var(--bg-card)',
                                border: '1px solid var(--border-main)',
                                borderRadius: '8px',
                                color: 'var(--text-primary)',
                                fontSize: '12px',
                                boxShadow: 'var(--shadow-lg)'
                            }}
                            labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
                        />
                        <Bar
                            dataKey="count"
                            fill="#44403C" /* Warm Charcoal */
                            radius={[0, 4, 4, 0]} /* Soft rounded tips */
                            barSize={12}
                            animationDuration={1000}
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill="#44403C" />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default SectorChart;
