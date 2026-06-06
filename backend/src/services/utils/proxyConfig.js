const TRUST_PROXY_PRESETS = new Set(['loopback', 'linklocal', 'uniquelocal']);

const parseTrustProxy = (value) => {
    if (value === undefined || value === null || value === '') return false;

    const raw = String(value).trim().toLowerCase();
    if (['false', '0', 'no', 'off'].includes(raw)) return false;
    if (['true', '1', 'yes', 'on'].includes(raw)) return 1;

    const numeric = Number(raw);
    if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 5) {
        return numeric;
    }

    if (TRUST_PROXY_PRESETS.has(raw)) {
        return raw;
    }

    throw new Error('TRUST_PROXY must be false, true, 1-5, loopback, linklocal, or uniquelocal');
};

module.exports = {
    parseTrustProxy
};
