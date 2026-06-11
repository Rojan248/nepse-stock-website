const {
    isBlockedFrontendAssetPath
} = require('../../src/middleware/staticAssetGuards');

describe('static asset guards', () => {
    it.each([
        '/.env',
        '/.env.local',
        '/%2eenv',
        '/assets/app.js.map',
        '/package.json',
        '/nested/package-lock.json',
        '/..%2fbackend/.env',
        '/assets/../package.json'
    ])('blocks sensitive frontend asset probe %s', (requestPath) => {
        expect(isBlockedFrontendAssetPath(requestPath)).toBe(true);
    });

    it.each([
        '/',
        '/stock/NABIL',
        '/assets/index-abc123.js',
        '/assets/logo-primary.jpg',
        '/watchlists/shared/abc12345'
    ])('allows normal frontend route or asset %s', (requestPath) => {
        expect(isBlockedFrontendAssetPath(requestPath)).toBe(false);
    });
});
