const { createDeepSeekProvider } = require('./deepseekProvider');
const { createMockProvider } = require('./mockProvider');

function createAiProvider(config) {
    if (!config.enabled) return null;
    if (config.provider === 'mock') return createMockProvider(config);
    if (config.provider === 'deepseek') return createDeepSeekProvider(config);
    return null;
}

module.exports = {
    createAiProvider
};
