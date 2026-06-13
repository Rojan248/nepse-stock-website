const MAX_NAME_LENGTH = 80;
const MAX_NOTE_LENGTH = 500;
const MAX_IMPORT_SYMBOLS = 200;
const MAX_SQLITE_INT = 2147483647;
const MAX_MONEY_VALUE = 1000000000000;
const SYMBOL_PATTERN = /^[A-Z0-9]{1,20}$/;
const NUMERIC_STRING_PATTERN = /^(?:\d+|\d*\.\d+)$/;
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const sendValidationError = (res, message) => {
    return res.status(400).json({
        success: false,
        error: { message }
    });
};

const trimString = (value) => {
    return typeof value === 'string' ? value.trim() : '';
};

const validateName = (value, label) => {
    const name = trimString(value);
    if (!name) {
        return { error: `${label} is required` };
    }
    if (name.length > MAX_NAME_LENGTH) {
        return { error: `${label} must be ${MAX_NAME_LENGTH} characters or less` };
    }
    return { value: name };
};

const normalizeSymbol = (value) => {
    const symbol = trimString(value).toUpperCase();
    if (!symbol) {
        return { error: 'Symbol is required' };
    }
    if (!SYMBOL_PATTERN.test(symbol)) {
        return { error: 'Symbol must be 1-20 uppercase letters or numbers' };
    }
    return { value: symbol };
};

const normalizeSymbolList = (symbols) => {
    if (!Array.isArray(symbols) || symbols.length === 0) {
        return { error: 'symbols array is required' };
    }
    if (symbols.length > MAX_IMPORT_SYMBOLS) {
        return { error: `symbols array must contain ${MAX_IMPORT_SYMBOLS} items or less` };
    }

    const normalized = [];
    const seen = new Set();
    for (const symbolInput of symbols) {
        const result = normalizeSymbol(symbolInput);
        if (result.error) {
            return { error: result.error };
        }
        if (!seen.has(result.value)) {
            seen.add(result.value);
            normalized.push(result.value);
        }
    }

    return { value: normalized };
};

const parseNumericInput = (value, label) => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? { value } : { error: `${label} must be a finite number` };
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (NUMERIC_STRING_PATTERN.test(trimmed)) {
            return { value: Number(trimmed) };
        }
    }
    return { error: `${label} must be a positive number` };
};

const parsePositiveInteger = (value, label, { max = MAX_SQLITE_INT } = {}) => {
    const parsed = parseNumericInput(value, label);
    if (parsed.error) {
        return parsed;
    }
    const number = parsed.value;
    if (!Number.isInteger(number) || number <= 0 || number > max) {
        return { error: `${label} must be a positive integer up to ${max}` };
    }
    return { value: number };
};

const parsePositiveNumber = (value, label, { max = MAX_MONEY_VALUE } = {}) => {
    const parsed = parseNumericInput(value, label);
    if (parsed.error) {
        return parsed;
    }
    const number = parsed.value;
    if (number <= 0 || number > max) {
        return { error: `${label} must be a positive number up to ${max}` };
    }
    return { value: number };
};

const parseRequiredDate = (value, label) => {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime())
            ? { error: `${label} must be a valid date` }
            : { value };
    }

    if (typeof value !== 'string') {
        return { error: `${label} must be a valid date` };
    }

    const dateText = value.trim();
    if (!DATE_ONLY_PATTERN.test(dateText)) {
        return { error: `${label} must be a valid date in YYYY-MM-DD format` };
    }

    const date = new Date(`${dateText}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dateText) {
        return { error: `${label} must be a valid date` };
    }
    return { value: date };
};

const parseBoolean = (value, label) => {
    if (typeof value !== 'boolean') {
        return { error: `${label} must be a boolean` };
    }
    return { value };
};

const validateOptionalNote = (value) => {
    if (value === undefined || value === null || value === '') {
        return { value: null };
    }
    if (typeof value !== 'string') {
        return { error: 'Note must be text' };
    }

    const note = value.trim();
    if (note.length > MAX_NOTE_LENGTH) {
        return { error: `Note must be ${MAX_NOTE_LENGTH} characters or less` };
    }
    return { value: note || null };
};

module.exports = {
    MAX_SQLITE_INT,
    MAX_IMPORT_SYMBOLS,
    normalizeSymbol,
    normalizeSymbolList,
    parseBoolean,
    parsePositiveInteger,
    parsePositiveNumber,
    parseRequiredDate,
    sendValidationError,
    validateName,
    validateOptionalNote
};
