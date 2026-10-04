const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

// width, height and colour type from a PNG's IHDR chunk
function pngInfo(file) {
  const buf = fs.readFileSync(file);
  assert.equal(buf.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${file} is not a PNG`);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), colorType: buf[25] };
}

test('every icon in the manifest exists, is a square PNG of the declared size, with an alpha channel', () => {
  assert.ok(manifest.icons, 'manifest has an icons key');
  for (const size of ['16', '32', '48', '96', '128']) {
    assert.ok(manifest.icons[size], `icon for ${size}px is declared`);
    const info = pngInfo(path.join(root, manifest.icons[size]));
    assert.equal(info.width, Number(size), `${manifest.icons[size]} width`);
    assert.equal(info.height, Number(size), `${manifest.icons[size]} height`);
    assert.equal(info.colorType, 6, `${manifest.icons[size]} should be RGBA (transparent background)`);
  }
});

test('every content script listed in the manifest exists', () => {
  for (const cs of manifest.content_scripts) {
    for (const js of cs.js) assert.ok(fs.existsSync(path.join(root, js)), `${js} is missing`);
  }
});

test('store limits: name <= 50 (AMO), description <= 132 (Chrome), version matches package.json', () => {
  assert.ok(manifest.name.length <= 50, `name is ${manifest.name.length} characters`);
  assert.ok(manifest.description.length <= 132, `description is ${manifest.description.length} characters`);
  assert.equal(manifest.version, pkg.version);
});

test('the extension asks for no browser permissions and only runs on Garmin Connect', () => {
  assert.equal(manifest.permissions, undefined);
  assert.equal(manifest.host_permissions, undefined);
  assert.deepEqual(manifest.content_scripts.flatMap((c) => c.matches), ['https://connect.garmin.com/app/*']);
});
