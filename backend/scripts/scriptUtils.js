function toNumber(value, fallback = 0) {
    if (value == null) return fallback;
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
}

function jsonReplacer(key, value) {
    if (typeof value === 'bigint') return Number(value);
    if (value && typeof value.toNumber === 'function') return value.toNumber();
    if (value instanceof Date) return value.toISOString();
    return value;
}

function toJson(value, spaces) {
    return JSON.stringify(value, jsonReplacer, spaces);
}

function printJson(value) {
    console.log(toJson(value, 2));
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function timestamp() {
    return new Date().toISOString();
}

function log(message) {
    console.log(`[${timestamp()}] ${message}`);
}

function warn(message) {
    console.warn(`[${timestamp()}] WARN: ${message}`);
}

function error(message) {
    console.error(`[${timestamp()}] ERROR: ${message}`);
}

module.exports = {
    toNumber,
    jsonReplacer,
    toJson,
    printJson,
    sleep,
    log,
    warn,
    error
};
