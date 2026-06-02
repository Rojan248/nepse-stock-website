const { DEFAULT_DEEPSEEK_PRICES } = require('./aiSummaryConfig');

const perMillion = (tokens, price) => ((tokens || 0) / 1_000_000) * price;
const firstUsageValue = (usage, keys, fallback = 0) => {
    const key = keys.find((candidate) => usage[candidate] !== undefined);
    return key ? usage[key] : fallback;
};

function estimateDeepSeekCost(usage = {}, prices = DEFAULT_DEEPSEEK_PRICES) {
    const cacheHitInput = firstUsageValue(usage, ['prompt_cache_hit_tokens', 'promptCacheHitTokens']);
    const cacheMissInput = firstUsageValue(usage, ['prompt_cache_miss_tokens', 'promptCacheMissTokens', 'prompt_tokens']);
    const output = firstUsageValue(usage, ['completion_tokens', 'completionTokens']);

    const cost = perMillion(cacheHitInput, prices.cacheHitInputPerMillion)
        + perMillion(cacheMissInput, prices.cacheMissInputPerMillion)
        + perMillion(output, prices.outputPerMillion);

    return Number(cost.toFixed(8));
}

function normalizeUsage(usage = {}) {
    const promptCacheHitTokens = firstUsageValue(usage, ['prompt_cache_hit_tokens', 'promptCacheHitTokens']);
    const promptCacheMissTokens = firstUsageValue(usage, ['prompt_cache_miss_tokens', 'promptCacheMissTokens']);
    const promptTokens = firstUsageValue(usage, ['prompt_tokens', 'promptTokens'], promptCacheHitTokens + promptCacheMissTokens);
    const completionTokens = firstUsageValue(usage, ['completion_tokens', 'completionTokens']);

    return {
        promptTokens,
        completionTokens,
        promptCacheHitTokens,
        promptCacheMissTokens
    };
}

module.exports = {
    estimateDeepSeekCost,
    normalizeUsage
};
