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
const INTEGER_QUERY_PATTERN = /^\d+$/;
const BOOLEAN_QUERY_VALUES = new Map([
    ['true', true],
    ['false', false]
]);

const parseBoundedIntQuery = (value, {
    min,
    max,
    defaultValue,
    label = 'value'
}) => {
    if (value === undefined || value === null || value === '') {
        return { value: defaultValue };
    }

    if (Array.isArray(value)) {
        return { error: `${label} must be a single integer` };
    }

    let parsed;
    if (typeof value === 'number') {
        parsed = value;
    } else if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!INTEGER_QUERY_PATTERN.test(trimmed)) {
            return { error: `${label} must be an integer` };
        }
        parsed = Number(trimmed);
    } else {
        return { error: `${label} must be an integer` };
    }

    if (!Number.isSafeInteger(parsed)) {
        return { error: `${label} must be a safe integer` };
    }

    return { value: Math.max(min, Math.min(max, parsed)) };
};

const clampInt = (value, min, max, defaultVal) => {
    const result = parseBoundedIntQuery(value, { min, max, defaultValue: defaultVal });
    return result.error ? defaultVal : result.value;
};

const sendQueryValidationError = (res, message) => res.status(400).json({
    success: false,
    error: { message }
});

const getBoundedIntQuery = (res, value, options) => {
    const result = parseBoundedIntQuery(value, options);
    if (result.error) {
        sendQueryValidationError(res, result.error);
        return null;
    }
    return result.value;
};

const parseBooleanQuery = (value, { defaultValue, label = 'value' } = {}) => {
    if (value === undefined || value === null || value === '') {
        return { value: defaultValue };
    }

    if (Array.isArray(value)) {
        return { error: `${label} must be a single boolean` };
    }

    if (typeof value === 'boolean') {
        return { value };
    }

    if (typeof value !== 'string') {
        return { error: `${label} must be a boolean` };
    }

    const normalized = value.trim().toLowerCase();
    if (!BOOLEAN_QUERY_VALUES.has(normalized)) {
        return { error: `${label} must be true or false` };
    }

    return { value: BOOLEAN_QUERY_VALUES.get(normalized) };
};

const getBooleanQuery = (res, value, options) => {
    const result = parseBooleanQuery(value, options);
    if (result.error) {
        sendQueryValidationError(res, result.error);
        return null;
    }
    return result.value;
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
    getBooleanQuery,
    getBoundedIntQuery,
    parseBooleanQuery,
    parseBoundedIntQuery,
    normalizeSymbolParam,
    normalizeTextQuery,
    sendQueryValidationError
};
