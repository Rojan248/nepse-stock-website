import { TrendingUp, TrendingDown, BarChart2, Layers } from 'lucide-react';

// ==================== Shared Helpers ====================

function MetricItem({ label, value, sub, cls }) {
    return (
        <div className={`metrics-panel__item ${cls || ''}`}>
            <span className="metrics-panel__item-label">{label}</span>
            <span className="metrics-panel__item-value">{value}</span>
            {sub && <span className="metrics-panel__item-sub">{sub}</span>}
        </div>
    );
}

export function fmt(n) {
    if (n == null) return '—';
    if (typeof n === 'number') return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    return n;
}

export function formatLargeNumber(n) {
    if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
    return Math.round(n).toLocaleString();
}

export const formatSignedPercent = (v, decimals = 2) =>
    v == null ? null : `${v > 0 ? '+' : ''}${v.toFixed(decimals)}%`;

const trendClass = (v) => v > 0 ? 'trend-bullish' : v < 0 ? 'trend-bearish' : '';
const maSubLabel = (pctValue) => formatSignedPercent(pctValue, 1);

function rsiZoneClass(zone) {
    if (zone === 'overbought') return 'overbought';
    if (zone === 'oversold') return 'oversold';
    return '';
}

// ==================== Extracted Item Renderers ====================

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

function VolRatioItem({ lm, show }) {
    if (!show) return null;
    if (lm.volumeRatio == null) return null;
    return <MetricItem label="Vol Ratio" value={`${lm.volumeRatio.toFixed(2)}x`} cls={lm.isVolumeSpike ? 'spike' : ''} />;
}

function TrendItem({ tm }) {
    const show = tm.trend && tm.trend !== 'neutral';
    if (!show) return null;
    return <MetricItem label="Trend" value={tm.trend} cls={`trend-${tm.trend}`} />;
}

function AvgVolItem({ lm }) {
    if (lm.avgVolume20d == null) return null;
    return <MetricItem label="Avg Vol" value={formatLargeNumber(lm.avgVolume20d)} />;
}

function TradingDaysItem({ lm }) {
    if (!lm.tradingDays || lm.tradingDays <= 0) return null;
    return <MetricItem label="Trading Days" value={lm.tradingDays} />;
}

// ==================== Section Components ====================

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

export function LiquiditySection({ lm, hasEnoughForLiquidity }) {
    if (!lm) return null;
    if (lm.liquidityScore == null || lm.liquidityScore <= 0) return null;
    const scoreLabel = hasEnoughForLiquidity
        ? <MetricItem label="Liquidity Score" value={`${lm.liquidityScore}/100`} />
        : <MetricItem label="Liquidity Score" value="N/A" sub="accumulating data" />;
    return (
        <div className="metrics-panel__section">
            <h4 className="metrics-panel__section-title">
                <BarChart2 size={14} /> Liquidity
            </h4>
            <div className="metrics-panel__grid">
                {scoreLabel}
                <VolRatioItem lm={lm} show={hasEnoughForLiquidity} />
                <AvgVolItem lm={lm} />
                <TradingDaysItem lm={lm} />
            </div>
        </div>
    );
}

export function MovingAveragesSection({ tm }) {
    if (!tm) return null;
    const hasAny = tm.ma20 || tm.ma50 || tm.ma180;
    if (!hasAny) return null;
    return (
        <div className="metrics-panel__section">
            <h4 className="metrics-panel__section-title">
                <TrendingUp size={14} /> Moving Averages
            </h4>
            <div className="metrics-panel__grid">
                {tm.ma20 && <MetricItem label="MA 20" value={fmt(tm.ma20)} sub={maSubLabel(tm.priceVsMa20)} />}
                {tm.ma50 && <MetricItem label="MA 50" value={fmt(tm.ma50)} sub={maSubLabel(tm.priceVsMa50)} />}
                {tm.ma180 && <MetricItem label="MA 180" value={fmt(tm.ma180)} sub={maSubLabel(tm.priceVsMa180)} />}
                <TrendItem tm={tm} />
            </div>
        </div>
    );
}

export function MomentumSection({ mm }) {
    if (!mm) return null;
    const hasAny = mm.rsi14 != null || mm.roc10d != null;
    if (!hasAny) return null;
    return (
        <div className="metrics-panel__section">
            <h4 className="metrics-panel__section-title">
                <TrendingDown size={14} /> Momentum
            </h4>
            <div className="metrics-panel__grid">
                {mm.rsi14 != null && <MetricItem label="RSI (14)" value={mm.rsi14.toFixed(1)} cls={rsiZoneClass(mm.rsiZone)} />}
                {mm.rsi7 != null && <MetricItem label="RSI (7)" value={mm.rsi7.toFixed(1)} />}
                {mm.roc10d != null && <MetricItem label="ROC 10d" value={formatSignedPercent(mm.roc10d)} />}
                {mm.roc30d != null && <MetricItem label="ROC 30d" value={formatSignedPercent(mm.roc30d)} />}
            </div>
        </div>
    );
}

export function WeekRangeSection({ pm }) {
    if (!pm) return null;
    const hasAny = pm.high52w || pm.low52w;
    if (!hasAny) return null;
    return (
        <div className="metrics-panel__section">
            <h4 className="metrics-panel__section-title">52-Week Range</h4>
            <div className="metrics-panel__grid">
                {pm.high52w && <MetricItem label="52W High" value={fmt(pm.high52w)} cls="high" />}
                {pm.low52w && <MetricItem label="52W Low" value={fmt(pm.low52w)} cls="low" />}
                {pm.weeklyChange != null && <MetricItem label="Week Δ" value={formatSignedPercent(pm.weeklyChange)} />}
                {pm.monthlyChange != null && <MetricItem label="Month Δ" value={formatSignedPercent(pm.monthlyChange)} />}
            </div>
        </div>
    );
}
