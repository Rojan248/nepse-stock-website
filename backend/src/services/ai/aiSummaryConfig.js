const DEFAULT_DEEPSEEK_PRICES = Object.freeze({
    cacheHitInputPerMillion: 0.0028,
    cacheMissInputPerMillion: 0.14,
    outputPerMillion: 0.28
});

const parseBool = (value, fallback = false) => {
    if (value === undefined) return fallback;
    return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const parseIntEnv = (name, fallback) => {
    const value = parseInt(process.env[name], 10);
    return Number.isFinite(value) && value > 0 ? value : fallback;
};

const parseFloatEnv = (name, fallback) => {
    const value = parseFloat(process.env[name]);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
};

function getAiSummaryConfig() {
    return {
        enabled: parseBool(process.env.AI_SUMMARIES_ENABLED, false),
        provider: process.env.AI_SUMMARIES_PROVIDER || 'disabled',
        model: process.env.AI_SUMMARIES_MODEL || 'deepseek-v4-flash',
        baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
        apiKey: process.env.DEEPSEEK_API_KEY || '',
        stockBatchSize: parseIntEnv('AI_STOCK_BATCH_SIZE', 32),
        maxStockOutputTokens: parseIntEnv('AI_STOCK_MAX_OUTPUT_TOKENS', 2600),
        maxMarketOutputTokens: parseIntEnv('AI_MARKET_MAX_OUTPUT_TOKENS', 1200),
        dailyBudgetUsd: parseFloatEnv('AI_DAILY_BUDGET_USD', 0.50),
        reuseUnchangedSummaries: parseBool(process.env.AI_REUSE_UNCHANGED_SUMMARIES, true),
        prices: DEFAULT_DEEPSEEK_PRICES
    };
}

module.exports = {
    DEFAULT_DEEPSEEK_PRICES,
    getAiSummaryConfig
};
