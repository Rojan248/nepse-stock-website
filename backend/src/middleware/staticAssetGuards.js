const path = require('path');

const BLOCKED_EXACT_NAMES = new Set([
    '.env',
    '.env.local',
    'package.json',
    'package-lock.json',
    'npm-shrinkwrap.json',
    'pnpm-lock.yaml',
    'yarn.lock',
    'vite.config.js'
]);

const normalizeRequestPath = (value = '') => {
    try {
        return decodeURIComponent(String(value).split('?')[0]);
    } catch {
        return String(value).split('?')[0];
    }
};

const isBlockedFrontendAssetPath = (requestPath = '') => {
    const normalized = normalizeRequestPath(requestPath).replace(/\\/g, '/').toLowerCase();
    const segments = normalized.split('/').filter(Boolean);
    const basename = path.posix.basename(normalized);

    return (
        normalized.includes('..') ||
        segments.some(segment => segment.startsWith('.')) ||
        BLOCKED_EXACT_NAMES.has(basename) ||
        basename.endsWith('.map')
    );
};

const frontendStaticSafetyGuard = (req, res, next) => {
    if (isBlockedFrontendAssetPath(req.path || req.url || '')) {
        return res.status(404).type('text/plain').send('Not Found');
    }

    return next();
};

module.exports = {
    frontendStaticSafetyGuard,
    isBlockedFrontendAssetPath
};
