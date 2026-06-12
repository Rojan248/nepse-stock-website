const { URL } = require('url');

const HOST_OVERRIDE_HEADERS = [
    'x-forwarded-host',
    'x-host',
    'x-http-host-override',
    'forwarded'
];

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const INVALID_HOST_CHARS = /[\\/@\s]/;
const HOST_WITH_OPTIONAL_PORT = /^(?:[a-z0-9.-]+|\[[0-9a-f:.]+\])(?::\d{1,5})?$/i;

const splitCsv = (value) => String(value || '')
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);

const normalizeAllowedHost = (value) => {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return null;

    if (!raw.includes('://')) {
        return raw.replace(/^\/+|\/+$/g, '');
    }

    try {
        return new URL(raw).host;
    } catch {
        return raw.replace(/^\/+|\/+$/g, '');
    }
};

const getAllowedHosts = () => splitCsv(process.env.ALLOWED_HOSTS)
    .map(normalizeAllowedHost)
    .filter(Boolean);

const normalizeHost = (host) => String(host || '').trim().toLowerCase();

const isSafeHostHeader = (host) => {
    if (!host) return true;
    if (host.length > 253) return false;
    if (CONTROL_CHARS.test(host) || INVALID_HOST_CHARS.test(host)) return false;
    if (!HOST_WITH_OPTIONAL_PORT.test(host)) return false;

    const port = host.match(/:(\d{1,5})$/)?.[1];
    if (port !== undefined) {
        const portNumber = Number(port);
        if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) {
            return false;
        }
    }

    return true;
};

const hostMatchesAllowed = (host, allowedHosts) => {
    if (allowedHosts.length === 0 || !host) return true;
    return allowedHosts.includes(normalizeHost(host));
};

const hasHostOverrideHeader = (headers = {}) => HOST_OVERRIDE_HEADERS
    .some(header => headers[header] !== undefined && String(headers[header]).trim() !== '');

const reject = (res, message) => res.status(400).json({
    success: false,
    error: { message }
});

const hostHeaderGuard = (req, res, next) => {
    if (hasHostOverrideHeader(req.headers)) {
        return reject(res, 'Host override headers are not accepted');
    }

    const host = normalizeHost(req.headers.host);
    if (!isSafeHostHeader(host)) {
        return reject(res, 'Invalid Host header');
    }

    if (!hostMatchesAllowed(host, getAllowedHosts())) {
        return reject(res, 'Host is not allowed');
    }

    return next();
};

module.exports = {
    getAllowedHosts,
    hasHostOverrideHeader,
    hostHeaderGuard,
    hostMatchesAllowed,
    isSafeHostHeader,
    normalizeAllowedHost
};
