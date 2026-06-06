const { parseTrustProxy } = require('../../src/services/utils/proxyConfig');

describe('proxyConfig', () => {
    it('defaults to not trusting forwarded client IP headers', () => {
        expect(parseTrustProxy(undefined)).toBe(false);
        expect(parseTrustProxy('')).toBe(false);
        expect(parseTrustProxy('false')).toBe(false);
    });

    it('allows explicit bounded proxy trust settings', () => {
        expect(parseTrustProxy('true')).toBe(1);
        expect(parseTrustProxy('2')).toBe(2);
        expect(parseTrustProxy('loopback')).toBe('loopback');
    });

    it('rejects broad or malformed proxy trust values', () => {
        expect(() => parseTrustProxy('8')).toThrow('TRUST_PROXY');
        expect(() => parseTrustProxy('attacker-controlled')).toThrow('TRUST_PROXY');
    });
});
