const dns = require('dns');
const https = require('https');
const net = require('net');

const LOCAL_HOSTNAMES = new Set([
    'localhost',
    'localhost.localdomain'
]);

function normalizeHost(hostname) {
    return String(hostname || '')
        .trim()
        .replace(/^\[/, '')
        .replace(/\]$/, '')
        .replace(/\.$/, '')
        .toLowerCase();
}

function normalizeIp(address) {
    const value = normalizeHost(address);
    if (value.startsWith('::ffff:')) {
        const mapped = value.slice('::ffff:'.length);
        if (net.isIP(mapped) === 4) return mapped;
    }
    return value;
}

function isPrivateIPv4(address) {
    const parts = address.split('.').map(part => Number(part));
    if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) {
        return false;
    }

    const [a, b] = parts;
    return (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && (b === 0 || b === 168)) ||
        (a === 198 && (b === 18 || b === 19)) ||
        a >= 224
    );
}

function isPrivateIPv6(address) {
    const value = normalizeHost(address).split('%')[0];
    if (value === '::' || value === '::1') return true;

    const firstHextet = parseInt(value.split(':')[0] || '0', 16);
    if (!Number.isFinite(firstHextet)) return false;

    return (
        (firstHextet & 0xfe00) === 0xfc00 ||
        (firstHextet & 0xffc0) === 0xfe80 ||
        (firstHextet & 0xff00) === 0xff00 ||
        value.startsWith('2001:db8:')
    );
}

function isPrivateIp(address) {
    const ip = normalizeIp(address);
    const family = net.isIP(ip);
    if (family === 4) return isPrivateIPv4(ip);
    if (family === 6) return isPrivateIPv6(ip);
    return false;
}

function assertPublicHttpsUrl(rawUrl, options = {}) {
    const label = options.label || 'outbound URL';
    const value = String(rawUrl || '').trim();
    let parsed;

    try {
        parsed = new URL(value);
    } catch (_) {
        throw new Error(`${label} must be a valid URL`);
    }

    if (parsed.protocol !== 'https:') {
        throw new Error(`${label} must use https`);
    }

    if (parsed.username || parsed.password) {
        throw new Error(`${label} must not include credentials`);
    }

    const hostname = normalizeHost(parsed.hostname);
    if (!hostname) {
        throw new Error(`${label} must include a hostname`);
    }

    if (LOCAL_HOSTNAMES.has(hostname) || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
        throw new Error(`${label} must not target local hostnames`);
    }

    if (net.isIP(hostname) && isPrivateIp(hostname)) {
        throw new Error(`${label} must not target private or reserved IP ranges`);
    }

    return value;
}

function createSafeLookup(label) {
    return (hostname, options, callback) => {
        let lookupOptions = options;
        let done = callback;

        if (typeof lookupOptions === 'function') {
            done = lookupOptions;
            lookupOptions = {};
        }

        dns.lookup(hostname, { ...lookupOptions, all: true }, (error, addresses) => {
            if (error) return done(error);

            const blocked = addresses.find(record => isPrivateIp(record.address));
            if (blocked) {
                return done(new Error(`${label} resolved to a private or reserved IP range`));
            }

            if (lookupOptions && lookupOptions.all) {
                return done(null, addresses);
            }

            const first = addresses[0];
            return done(null, first.address, first.family);
        });
    };
}

function createPublicHttpsAgent(rawUrl, options = {}) {
    const label = options.label || 'outbound URL';
    assertPublicHttpsUrl(rawUrl, { label });
    return new https.Agent({
        lookup: createSafeLookup(label)
    });
}

module.exports = {
    assertPublicHttpsUrl,
    createPublicHttpsAgent,
    isPrivateIp
};
