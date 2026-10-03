const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { nextVersion, bump } = require('../scripts/bump.js');

test('nextVersion handles patch, minor, major and an explicit version', () => {
  assert.equal(nextVersion('1.0.0', 'patch'), '1.0.1');
  assert.equal(nextVersion('1.4.9', 'minor'), '1.5.0');
  assert.equal(nextVersion('1.4.9', 'major'), '2.0.0');
  assert.equal(nextVersion('1.0.0', '2.3.4'), '2.3.4');
});

test('nextVersion rejects bad input and versions that do not go up', () => {
  assert.throws(() => nextVersion('1.0.0', 'bogus'), /patch|minor|major/);
  assert.throws(() => nextVersion('1.0.0', '1.0'), /x\.y\.z/);
  assert.throws(() => nextVersion('1.0', 'patch'), /current version/);
  assert.throws(() => nextVersion('1.2.3', '1.2.3'), /higher/);
  assert.throws(() => nextVersion('1.2.3', '1.2.2'), /higher/);
  assert.equal(nextVersion('1.2.3', '1.10.0'), '1.10.0'); // numeric, not string, comparison
  assert.throws(() => nextVersion('1.10.0', '1.9.0'), /higher/);
});

function makeProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vo2-bump-test-'));
  const manifest =
    '{\n  "manifest_version": 3,\n  "name": "X",\n  "version": "1.0.0",\n  "content_scripts": [\n    {\n      "js": ["a.js", "b.js"]\n    }\n  ]\n}\n';
  fs.writeFileSync(path.join(root, 'manifest.json'), manifest);
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'x', version: '1.0.0', dependencies: { y: '1.0.0' } }, null, 2) + '\n');
  fs.writeFileSync(
    path.join(root, 'package-lock.json'),
    JSON.stringify({ name: 'x', version: '1.0.0', packages: { '': { name: 'x', version: '1.0.0' }, 'node_modules/y': { version: '1.0.0' } } }, null, 2) + '\n'
  );
  return { root, manifest };
}

test('bump updates manifest, package.json and the lockfile root, touching nothing else', () => {
  const { root, manifest } = makeProject();
  assert.equal(bump(root, 'minor'), '1.1.0');
  const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
  // manifest: only the version line changes, formatting (inline arrays) is preserved
  assert.equal(read('manifest.json'), manifest.replace('"version": "1.0.0"', '"version": "1.1.0"'));
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.version, '1.1.0');
  assert.equal(pkg.dependencies.y, '1.0.0');
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(lock.version, '1.1.0');
  assert.equal(lock.packages[''].version, '1.1.0');
  assert.equal(lock.packages['node_modules/y'].version, '1.0.0');
});

test('bump refuses when manifest and package.json disagree, and changes nothing', () => {
  const { root } = makeProject();
  const pkgPath = path.join(root, 'package.json');
  fs.writeFileSync(pkgPath, JSON.stringify({ name: 'x', version: '0.9.0' }, null, 2) + '\n');
  assert.throws(() => bump(root, 'patch'), /disagree/);
  assert.match(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'), /"version": "1\.0\.0"/);
});
