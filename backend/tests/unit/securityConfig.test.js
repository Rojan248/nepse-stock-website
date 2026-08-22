const { getSecretIssue, validateRuntimeSecrets } = require('../../src/services/utils/securityConfig');

describe('securityConfig', () => {
    it('rejects known weak secrets when provided', () => {
        expect(getSecretIssue('ADMIN_API_KEY', 'short-weak-value')).toContain('at least 32');
        expect(getSecretIssue('ADMIN_API_KEY', 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')).toContain('compromised');
        expect(getSecretIssue('JWT_SECRET', 'change-this-to-a-secure-random-string')).toContain('weak');
    });

    it('requires production secrets', () => {
        expect(() => validateRuntimeSecrets({ NODE_ENV: 'production' })).toThrow('JWT_SECRET');
    });

    it('allows missing development secrets but rejects weak provided values', () => {
        expect(() => validateRuntimeSecrets({ NODE_ENV: 'development' })).not.toThrow();
        expect(() => validateRuntimeSecrets({
            NODE_ENV: 'development',
            JWT_SECRET: 'admin-default-secret-value-that-is-long'
        })).toThrow('JWT_SECRET');
    });

    it('accepts strong configured production secrets', () => {
        expect(() => validateRuntimeSecrets({
            NODE_ENV: 'production',
            JWT_SECRET: '0123456789abcdef0123456789abcdef',
            ADMIN_API_KEY: 'fedcba9876543210fedcba9876543210'
        })).not.toThrow();
    });

    it('rejects mock data mode in production', () => {
        expect(() => validateRuntimeSecrets({
            NODE_ENV: 'production',
            JWT_SECRET: '0123456789abcdef0123456789abcdef',
            ADMIN_API_KEY: 'fedcba9876543210fedcba9876543210',
            USE_MOCK_DATA: 'true'
        })).toThrow(/USE_MOCK_DATA/);
    });

    it('allows mock data mode outside production', () => {
        expect(() => validateRuntimeSecrets({
            NODE_ENV: 'development',
            USE_MOCK_DATA: 'true'
        })).not.toThrow();
    });
});
