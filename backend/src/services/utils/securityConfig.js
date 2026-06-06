const MIN_SECRET_LENGTH = 32;
const COMMON_WEAK_SECRET_RE = /^(default|secret|temp|password|admin|changeme|change-this|12345)/i;
const BLOCKED_SECRET_VALUES = new Set([
    '13100896wW@',
    'a4e31027b3c62345024e8b3802b37f0ffb1de8472a3684cba907f0de5157375d',
    'd26b5130ccfc57ac5b09ab9d355999e7ad2c11ec1f8c12bfa9cb915d248d2a5d'
]);

const getSecretIssue = (name, value, { required = true } = {}) => {
    if (typeof value !== 'string' || value.trim() === '') {
        return required ? `${name} environment variable is not defined` : null;
    }

    const secret = value.trim();
    if (secret.length < MIN_SECRET_LENGTH) {
        return `${name} must be at least ${MIN_SECRET_LENGTH} characters long`;
    }
    if (BLOCKED_SECRET_VALUES.has(secret) || COMMON_WEAK_SECRET_RE.test(secret)) {
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

    if (issues.length > 0) {
        throw new Error(`Security configuration error: ${issues.join('; ')}`);
    }
};

module.exports = {
    getSecretIssue,
    validateRuntimeSecrets
};
