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

function ipv4PartsToHextets(address) {
    const parts = address.split('.').map(part => Number(part));
    if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) {
        return null;
    }
    return [(parts[0] << 8) + parts[1], (parts[2] << 8) + parts[3]];
}

function parseHextet(value) {
    if (!/^[0-9a-f]{1,4}$/i.test(value)) return null;
    return parseInt(value, 16);
}

function parseIpv6Hextets(address) {
    const value = normalizeHost(address).split('%')[0];
    if (!value.includes(':')) return null;

    const doubleColonParts = value.split('::');
    if (doubleColonParts.length > 2) return null;

    const parseSide = (side) => {
        if (!side) return [];
        const rawParts = side.split(':');
        const parts = [];
        for (const [index, part] of rawParts.entries()) {
            if (part.includes('.')) {
                if (index !== rawParts.length - 1) return null;
                const ipv4Hextets = ipv4PartsToHextets(part);
                if (!ipv4Hextets) return null;
                parts.push(...ipv4Hextets);
                continue;
            }
            const hextet = parseHextet(part);
            if (hextet === null) return null;
            parts.push(hextet);
        }
        return parts;
    };

    const left = parseSide(doubleColonParts[0]);
    const right = parseSide(doubleColonParts[1] || '');
    if (!left || !right) return null;

    const total = left.length + right.length;
    if (doubleColonParts.length === 1) {
        return total === 8 ? left : null;
    }

    if (total >= 8) return null;
    return [...left, ...Array(8 - total).fill(0), ...right];
}

function hextetsToIPv4(high, low) {
    return [
        (high >> 8) & 0xff,
        high & 0xff,
        (low >> 8) & 0xff,
        low & 0xff
    ].join('.');
}

function hasEmbeddedPrivateIPv4(hextets) {
    if (!hextets || hextets.length !== 8) return false;

    const firstFiveZero = hextets.slice(0, 5).every(part => part === 0);
    const firstSixZero = firstFiveZero && hextets[5] === 0;
    const isIpv4Mapped = firstFiveZero && hextets[5] === 0xffff;
    const isIpv4Compatible = firstSixZero;

    if (!isIpv4Mapped && !isIpv4Compatible) return false;
    return isPrivateIPv4(hextetsToIPv4(hextets[6], hextets[7]));
}

function isPrivateIPv6(address) {
    const value = normalizeHost(address).split('%')[0];
    const hextets = parseIpv6Hextets(value);
    if (!hextets) return false;

    const firstHextet = hextets[0];
    const isUnspecified = hextets.every(part => part === 0);
    const isLoopback = hextets.slice(0, 7).every(part => part === 0) && hextets[7] === 1;

    return (
        isUnspecified ||
        isLoopback ||
        hasEmbeddedPrivateIPv4(hextets) ||
        (firstHextet & 0xfe00) === 0xfc00 ||
        (firstHextet & 0xffc0) === 0xfe80 ||
        (firstHextet & 0xff00) === 0xff00 ||
        (hextets[0] === 0x2001 && hextets[1] === 0x0db8)
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
