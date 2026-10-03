const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromeManifest, listFiles, build } = require('../scripts/package.js');

const hasZip = (() => {
  try {
    execFileSync('zip', ['-v'], { stdio: 'ignore' });
    execFileSync('unzip', ['-v'], { stdio: 'ignore' });
    return true;
  } catch (_) {
    return false;
  }
})();

function makeProject(extra = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vo2-pkg-test-'));
  const write = (rel, content) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), content);
  };
  write(
    'manifest.json',
    JSON.stringify({ manifest_version: 3, name: 'X', version: '1.2.3', browser_specific_settings: { gecko: { id: 'x@y' } } })
  );
  write('LICENSE', 'MIT');
  write('README.md', 'readme');
  write('src/a.js', 'a');
  write('src/sub/b.js', 'b');
  write('src/.DS_Store', 'junk');
  write('test/a.test.js', 'test');
  write('docs/plan.md', 'plan');
  write('node_modules/dep/index.js', 'dep');
  for (const [rel, content] of Object.entries(extra)) write(rel, content);
  return root;
}

test('chromeManifest drops browser_specific_settings and does not mutate its input', () => {
  const input = { name: 'X', browser_specific_settings: { gecko: { id: 'x@y' } }, version: '1.0.0' };
  const out = chromeManifest(input);
  assert.deepEqual(out, { name: 'X', version: '1.0.0' });
  assert.ok(input.browser_specific_settings);
});

test('listFiles includes the manifest, license, src and icons only, sorted, without dotfiles', () => {
  const root = makeProject({ 'icons/icon128.png': 'png', 'icons/icon16.png': 'png' });
  assert.deepEqual(listFiles(root), ['LICENSE', 'icons/icon128.png', 'icons/icon16.png', 'manifest.json', 'src/a.js', 'src/sub/b.js']);
});

test('listFiles copes with a project that has no icons yet and no license', () => {
  const root = makeProject();
  fs.rmSync(path.join(root, 'LICENSE'));
  assert.deepEqual(listFiles(root), ['manifest.json', 'src/a.js', 'src/sub/b.js']);
});

test('build makes a chrome zip without gecko settings and a firefox zip with them', { skip: !hasZip }, () => {
  const root = makeProject();
  const out = path.join(root, 'dist');
  const zips = build(root, out);
  assert.deepEqual(
    zips.map((z) => path.basename(z)),
    ['vo2-max-precise-extended-1.2.3-chrome.zip', 'vo2-max-precise-extended-1.2.3-firefox.zip']
  );
  const names = (z) => execFileSync('unzip', ['-Z1', z]).toString().trim().split('\n').sort();
  const expected = ['LICENSE', 'manifest.json', 'src/a.js', 'src/sub/b.js'];
  assert.deepEqual(names(zips[0]), expected);
  assert.deepEqual(names(zips[1]), expected);
  const manifestIn = (z) => JSON.parse(execFileSync('unzip', ['-p', z, 'manifest.json']).toString());
  assert.equal('browser_specific_settings' in manifestIn(zips[0]), false);
  assert.equal(manifestIn(zips[0]).version, '1.2.3');
  assert.equal(manifestIn(zips[1]).browser_specific_settings.gecko.id, 'x@y');
});

test('build never ships tests, docs, node_modules or the readme', { skip: !hasZip }, () => {
  const root = makeProject();
  const zips = build(root, path.join(root, 'dist'));
  const listing = execFileSync('unzip', ['-Z1', zips[0]]).toString();
  assert.doesNotMatch(listing, /test\/|docs\/|node_modules|README|\.DS_Store/);
});
