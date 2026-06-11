const SAFE_SENTIMENTS = new Set(['bullish', 'bearish', 'neutral']);
const INVESTMENT_ADVICE_PATTERN = /\b(buy|sell|hold|accumulate|exit|target\s+price|stop\s+loss|recommend(?:ation|ed)?)\b/i;

function compactText(value, maxLength) {
    if (typeof value !== 'string') return null;
    const compacted = value
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!compacted) return null;
    return compacted.slice(0, maxLength);
}

function sanitizeGeneratedText(value, fallback, maxLength = 600) {
    const text = compactText(value, maxLength);
    if (!text || INVESTMENT_ADVICE_PATTERN.test(text)) return fallback;
    return text;
}

function sanitizeGeneratedList(value, { maxItems = 5, maxLength = 120 } = {}) {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => sanitizeGeneratedText(item, null, maxLength))
        .filter(Boolean)
        .slice(0, maxItems);
}

function normalizeSentiment(value) {
    const sentiment = typeof value === 'string' ? value.toLowerCase().trim() : '';
    return SAFE_SENTIMENTS.has(sentiment) ? sentiment : 'neutral';
}

function normalizeConfidence(value) {
    if (value === null || value === undefined) return null;
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) return null;
    return Math.min(1, Math.max(0, numberValue));
}

module.exports = {
    sanitizeGeneratedText,
    sanitizeGeneratedList,
    normalizeSentiment,
    normalizeConfidence
};
