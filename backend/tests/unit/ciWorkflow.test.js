const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../../..');
const workflowsDir = path.join(repoRoot, '.github', 'workflows');
const readRepoFile = (relativePath) =>
    fs.readFileSync(path.join(repoRoot, relativePath), 'utf8').replace(/\r\n/g, '\n');

const readWorkflowFiles = () =>
    fs.readdirSync(workflowsDir)
        .filter((fileName) => /\.ya?ml$/i.test(fileName))
        .map((fileName) => ({
            fileName,
            content: readRepoFile(path.join('.github', 'workflows', fileName))
        }));

describe('GitHub Actions workflow hardening', () => {
    it('pins external actions to immutable commit SHAs', () => {
        const actionRefs = readWorkflowFiles()
            .flatMap(({ fileName, content }) =>
                Array.from(content.matchAll(/^\s*(?:-\s*)?uses:\s*([^\s#]+)/gm), (match) => ({
                    fileName,
                    ref: match[1]
                }))
            )
            .filter(({ ref }) => !ref.startsWith('./'));

        const mutableRefs = actionRefs.filter(({ ref }) => !/@[a-f0-9]{40}$/i.test(ref));

        expect(mutableRefs).toEqual([]);
    });

    it('keeps the CI token least-privileged and installs from lockfiles', () => {
        const workflow = readRepoFile('.github/workflows/ci.yml');

        expect(workflow).toMatch(/\npermissions:\n\s+contents:\s+read\n/);
        expect(workflow).not.toMatch(/\bpull_request_target\b/);
        expect(workflow).not.toMatch(/run:\s*npm install\b/);
        expect(workflow).toMatch(/run:\s*npm ci\b/);
        expect(workflow).toContain('persist-credentials: false');
    });
});
