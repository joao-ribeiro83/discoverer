// Pack the committed discoverer-neo/ tree into <repo root>/discoverer-neo.zip.
// Only tracked files go in, so node_modules, .env and credentials stay out.
// Paths marked export-ignore in discoverer-neo/.gitattributes stay out too.
// Run by hand before a deploy (npm run package) and by the post-commit and
// post-merge git hooks whenever the version in package.json changes.
import { execFileSync } from 'node:child_process';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

const root = git('rev-parse', '--show-toplevel');
const { version } = JSON.parse(git('-C', root, 'show', 'HEAD:discoverer-neo/package.json'));
git('-C', root, 'archive', '--format=zip', '--prefix=discoverer-neo/', '-o', `${root}/discoverer-neo.zip`, 'HEAD:discoverer-neo');
console.log(`discoverer-neo.zip updated: version ${version}, commit ${git('-C', root, 'rev-parse', '--short', 'HEAD')}`);
