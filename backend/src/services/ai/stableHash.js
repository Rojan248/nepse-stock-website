const crypto = require('crypto');

function stableJson(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;

    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
}

function createInputHash(value) {
    return crypto.createHash('sha256').update(stableJson(value)).digest('hex');
}

module.exports = {
    stableJson,
    createInputHash
};
