const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function sentimentFromChange(changePercent) {
    if ((changePercent || 0) > 0.5) return 'bullish';
    if ((changePercent || 0) < -0.5) return 'bearish';
    return 'neutral';
}

function buildStockSummary(stock) {
    const change = stock.changePercent ?? 0;
    const volumeText = stock.volumeRatio && stock.volumeRatio > 1.5 ? ' with elevated relative volume' : '';
    return `${stock.symbol} is ${sentimentFromChange(change)} for the period, moving ${change.toFixed(2)}%${volumeText}.`;
}

const emptyUsage = () => ({ promptTokens: 0, completionTokens: 0, promptCacheHitTokens: 0, promptCacheMissTokens: 0 });
const fallbackArray = (value) => Array.isArray(value) ? value : [];
const breadthFromMarket = (market) => ({
    advances: market.advancedCompanies || 0,
    declines: market.declinedCompanies || 0,
    unchanged: market.unchangedCompanies || 0
});

function buildMarketMockData(payload) {
    const market = payload.market || {};
    const change = market.indexChangePercent ?? 0;
    return {
        summary: `The market closed ${sentimentFromChange(change)} with the NEPSE index moving ${change.toFixed(2)}%. Breadth and turnover should be read together with sector participation.`,
        sentiment: sentimentFromChange(change),
        confidence: 0.65,
        breadth: breadthFromMarket(market),
        topMovers: {
            gainers: fallbackArray(payload.topGainers),
            losers: fallbackArray(payload.topLosers),
            turnover: fallbackArray(payload.mostTraded)
        },
        sectors: fallbackArray(payload.sectorBreadth)
    };
}

function createMockProvider(config) {
    return {
        name: 'mock',
        model: 'mock-low-cost-summary',
        async generateStockSummaries(payload) {
            const items = payload.stocks.map((stock) => ({
                symbol: stock.symbol,
                summary: buildStockSummary(stock),
                sentiment: sentimentFromChange(stock.changePercent),
                confidence: clamp(0.6 + Math.abs(stock.changePercent || 0) / 20, 0.55, 0.9),
                drivers: ['price change', 'volume and turnover snapshot'],
                risks: ['summary is generated from market data only']
            }));

            return {
                data: { items },
                usage: emptyUsage(),
                estimatedCostUsd: 0
            };
        },
        async generateMarketSummary(payload) {
            return {
                data: buildMarketMockData(payload),
                usage: emptyUsage(),
                estimatedCostUsd: 0
            };
        }
    };
}

module.exports = {
    createMockProvider,
    buildMarketMockData
};
