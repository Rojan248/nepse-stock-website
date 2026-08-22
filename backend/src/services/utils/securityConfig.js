const crypto = require('crypto');

const MIN_SECRET_LENGTH = 32;
const COMMON_WEAK_SECRET_RE = /^(default|secret|temp|password|admin|changeme|change-this|12345)/i;
const BLOCKED_SECRET_HASHES = new Set([
    // Known exposed or intentionally weak values are stored only as SHA-256 hashes.
    '9ad830e213118772cce5f1e3f79ea0864962b7347a4ce3ed66d4aa6cdc637e4e',
    '950a09c57ecff6f0f7a6f88135aa15cd6cfbe17446285bfadfd22dc1b3d1bbea',
    'e522c695e2e28de952cffad84cfc9d101960eaa325e1488fd3c796316a3f537a',
    'c62e4615bd39e222572f3a1bf7c2132ea1e65b17ec805047bd6b2842c593493f'
]);

const hashSecret = (value) => crypto.createHash('sha256').update(value).digest('hex');

const getSecretIssue = (name, value, { required = true } = {}) => {
    if (typeof value !== 'string' || value.trim() === '') {
        return required ? `${name} environment variable is not defined` : null;
    }

    const secret = value.trim();
    if (secret.length < MIN_SECRET_LENGTH) {
        return `${name} must be at least ${MIN_SECRET_LENGTH} characters long`;
    }
    if (BLOCKED_SECRET_HASHES.has(hashSecret(secret)) || COMMON_WEAK_SECRET_RE.test(secret)) {
        return `${name} is using a weak, default, or compromised value`;
    }

    return null;
};

const validateRuntimeSecrets = (env = process.env) => {
    const nodeEnv = env.NODE_ENV || 'development';
    const requireConfiguredSecrets = nodeEnv === 'production' || env.ENFORCE_STRONG_SECRETS === 'true';
    const secretNames = ['JWT_SECRET', 'ADMIN_API_KEY'];
    const issues = [];

    for (const name of secretNames) {
        const issue = getSecretIssue(name, env[name], { required: requireConfiguredSecrets });
        if (issue) issues.push(issue);
    }

    if (nodeEnv === 'production' && env.USE_MOCK_DATA === 'true') {
        issues.push('USE_MOCK_DATA is enabled in production; it would write simulated prices into the live database');
    }

    if (issues.length > 0) {
        throw new Error(`Security configuration error: ${issues.join('; ')}`);
    }
};

module.exports = {
    getSecretIssue,
    validateRuntimeSecrets
};
