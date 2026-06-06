/**
 * Clamps an integer value between min and max bounds.
 * Parses the value using parseInt if it's a string.
 *
 * @param {any} value - The input value to parse and clamp.
 * @param {number} min - The lower bound.
 * @param {number} max - The upper bound.
 * @param {number} defaultVal - The fallback value if parsing fails.
 * @returns {number} The clamped integer.
 */
const clampInt = (value, min, max, defaultVal) => {
    if (value === undefined || value === null || value === '') {
        return defaultVal;
    }
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
        return defaultVal;
    }
    return Math.max(min, Math.min(max, parsed));
};

const normalizeTextQuery = (value, { maxLength = 50 } = {}) => {
    if (typeof value !== 'string') {
        return { error: 'Query must be text' };
    }

    const query = value.trim();
    if (!query) {
        return { error: 'Search query is required' };
    }
    if (query.length > maxLength) {
        return { error: 'Search query too long' };
    }

    return { value: query };
};

const normalizeSymbolParam = (value) => {
    if (typeof value !== 'string') {
        return { error: 'Invalid symbol format' };
    }

    const symbol = value.trim().toUpperCase();
    if (!/^[A-Z0-9]{1,20}$/.test(symbol)) {
        return { error: 'Invalid symbol format' };
    }

    return { value: symbol };
};

module.exports = {
    clampInt,
    normalizeSymbolParam,
    normalizeTextQuery
};
