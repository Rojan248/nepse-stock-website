const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../../..');
const readRepoFile = (relativePath) =>
    fs.readFileSync(path.join(repoRoot, relativePath), 'utf8').replace(/\r\n/g, '\n');

describe('container deployment packaging', () => {
    it('does not copy the whole backend tree into the runtime image', () => {
        const dockerfile = readRepoFile('Dockerfile');
        const runnerStage = dockerfile.split('FROM node:18-alpine AS runner')[1];

        expect(dockerfile).not.toMatch(/RUN\s+(?:cd\s+\S+\s+&&\s+)?npm install\b/);
        expect(dockerfile).toContain('RUN npm ci --include=dev');
        expect(dockerfile).toContain('RUN cd backend && npm ci');
        expect(dockerfile).toContain('RUN cd frontend && npm ci');
        expect(runnerStage).not.toMatch(/COPY\s+--from=builder\s+\/app\/backend\s+\/app\/backend/);
        expect(runnerStage).toContain('COPY --from=builder /app/backend/src /app/backend/src');
        expect(runnerStage).toContain('COPY --from=builder /app/backend/prisma /app/backend/prisma');
        expect(runnerStage).toContain('npm prune --omit=dev');
    });

    it('keeps the Prisma CLI available for runtime migrations', () => {
        const pkg = require('../../package.json');

        expect(pkg.dependencies.prisma).toBeDefined();
        expect(pkg.devDependencies?.prisma).toBeUndefined();
    });

    it('runs PM2 from the locked backend dependency set', () => {
        const dockerfile = readRepoFile('Dockerfile');
        const pkg = require('../../package.json');

        expect(dockerfile).not.toMatch(/npm\s+install\s+-g\s+pm2\b/);
        expect(dockerfile).toContain('./node_modules/.bin/pm2-runtime start ecosystem.config.js --env production');
        expect(pkg.dependencies.pm2).toBeDefined();
        expect(pkg.devDependencies?.pm2).toBeUndefined();
    });

    it('excludes nested secrets, tests, and runtime data from the Docker build context', () => {
        const dockerignore = readRepoFile('.dockerignore');

        [
            '**/.env',
            '**/.env.*',
            'backend/tests',
            'backend/prisma/backups',
            'backend/prisma/**/*.db',
            'backend/data/*.json'
        ].forEach((pattern) => {
            expect(dockerignore).toContain(pattern);
        });
    });
});
