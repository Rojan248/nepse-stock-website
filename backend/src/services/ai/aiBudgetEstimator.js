const { estimateDeepSeekCost } = require('./costEstimator');
const {
    STOCK_SUMMARY_SYSTEM_PROMPT,
    MARKET_SUMMARY_SYSTEM_PROMPT,
    buildStockBatchUserPrompt,
    buildMarketUserPrompt
} = require('./summaryPrompts');

const ESTIMATED_CHARS_PER_TOKEN = 4;

function estimateTextTokens(...parts) {
    const text = parts.filter(Boolean).join('\n');
    if (!text) return 0;
    return Math.ceil(Buffer.byteLength(text, 'utf8') / ESTIMATED_CHARS_PER_TOKEN);
}

function isPaidProvider(provider) {
    return provider && provider.name !== 'mock';
}

function estimateCallCostUsd({ systemPrompt, userPrompt, maxOutputTokens, prices }) {
    const promptCacheMissTokens = estimateTextTokens(systemPrompt, userPrompt);
    const completionTokens = Math.max(0, Number(maxOutputTokens) || 0);
    return estimateDeepSeekCost({
        promptCacheMissTokens,
        completionTokens
    }, prices);
}

function estimateStockBatchCostUsd(context, payload, batch) {
    if (!isPaidProvider(context.provider)) return 0;
    const providerPayload = {
        periodType: context.periodType,
        periodStart: context.periodStart,
        periodEnd: context.periodEnd,
        market: payload.market,
        stocks: batch
    };
    return estimateCallCostUsd({
        systemPrompt: STOCK_SUMMARY_SYSTEM_PROMPT,
        userPrompt: buildStockBatchUserPrompt(providerPayload),
        maxOutputTokens: context.config.maxStockOutputTokens,
        prices: context.config.prices
    });
}

function estimateMarketCallCostUsd(context, payload) {
    if (!isPaidProvider(context.provider)) return 0;
    return estimateCallCostUsd({
        systemPrompt: MARKET_SUMMARY_SYSTEM_PROMPT,
        userPrompt: buildMarketUserPrompt(payload),
        maxOutputTokens: context.config.maxMarketOutputTokens,
        prices: context.config.prices
    });
}

module.exports = {
    estimateTextTokens,
    estimateCallCostUsd,
    estimateStockBatchCostUsd,
    estimateMarketCallCostUsd
};
