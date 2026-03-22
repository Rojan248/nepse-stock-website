import React from 'react';
import { Layers } from 'lucide-react';
import { MetricItem, formatSignedPercent, trendClass } from './MetricsUtils';

function SectorRankItem({ rm }) {
    if (rm.sectorRank == null) return null;
    return <MetricItem label="Sector Rank" value={`#${rm.sectorRank}`} sub={rm.sectorTotal ? `of ${rm.sectorTotal}` : null} />;
}

function MarketRankItem({ rm }) {
    if (rm.marketRank == null) return null;
    return <MetricItem label="Market Rank" value={`#${rm.marketRank}`} sub={rm.marketTotal ? `of ${rm.marketTotal}` : null} />;
}

function VsSectorItem({ rm }) {
    if (rm.vsSectorAvg == null) return null;
    return <MetricItem label="vs Sector Avg" value={formatSignedPercent(rm.vsSectorAvg)} cls={trendClass(rm.vsSectorAvg)} />;
}

export function SectorRankingSection({ rm, sector }) {
    if (!rm) return null;
    const hasRanks = rm.sectorRank != null || rm.marketRank != null;
    if (!hasRanks) return null;
    return (
        <div className="metrics-panel__section">
            <h4 className="metrics-panel__section-title">
                <Layers size={14} /> Sector & Ranking
            </h4>
            <div className="metrics-panel__grid">
                {sector && <MetricItem label="Sector" value={sector} />}
                <SectorRankItem rm={rm} />
                <MarketRankItem rm={rm} />
                <VsSectorItem rm={rm} />
            </div>
        </div>
    );
}
