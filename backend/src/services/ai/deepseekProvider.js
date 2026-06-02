const axios = require('axios');
const { estimateDeepSeekCost, normalizeUsage } = require('./costEstimator');
const {
    STOCK_SUMMARY_SYSTEM_PROMPT,
    MARKET_SUMMARY_SYSTEM_PROMPT,
    buildStockBatchUserPrompt,
    buildMarketUserPrompt
} = require('./summaryPrompts');

function parseJsonContent(response) {
    const content = response?.data?.choices?.[0]?.message?.content;
    if (!content) throw new Error('DeepSeek returned empty content');
    return JSON.parse(content);
}

function createDeepSeekProvider(config) {
    if (!config.apiKey) {
        throw new Error('DEEPSEEK_API_KEY is required when AI_SUMMARIES_PROVIDER=deepseek');
    }

    const client = axios.create({
        baseURL: config.baseUrl,
        timeout: 30000,
        headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json'
        }
    });

    const postChat = async ({ systemPrompt, userPrompt, maxTokens }) => {
        const response = await client.post('/chat/completions', {
            model: config.model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.2,
            max_tokens: maxTokens
        });

        const usage = normalizeUsage(response.data?.usage || {});
        return {
            data: parseJsonContent(response),
            usage,
            estimatedCostUsd: estimateDeepSeekCost(usage, config.prices)
        };
    };

    return {
        name: 'deepseek',
        model: config.model,
        generateStockSummaries: (payload) => postChat({
            systemPrompt: STOCK_SUMMARY_SYSTEM_PROMPT,
            userPrompt: buildStockBatchUserPrompt(payload),
            maxTokens: config.maxStockOutputTokens
        }),
        generateMarketSummary: (payload) => postChat({
            systemPrompt: MARKET_SUMMARY_SYSTEM_PROMPT,
            userPrompt: buildMarketUserPrompt(payload),
            maxTokens: config.maxMarketOutputTokens
        })
    };
}

module.exports = {
    createDeepSeekProvider
};
