#!/usr/bin/env node
// Builds the store upload zips: dist/vo2-max-precise-extended-<version>-chrome.zip and -firefox.zip.
// Needs the `zip` command (preinstalled on macOS and most Linux).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const NAME = 'vo2-max-precise-extended';
const ROOT_FILES = ['manifest.json', 'LICENSE'];
const DIRS = ['src', 'icons'];

// Chrome ignores browser_specific_settings but warns about it, so the Chrome zip omits it.
function chromeManifest(manifest) {
  const { browser_specific_settings, ...rest } = manifest;
  return rest;
}

function listFiles(root) {
  const out = ROOT_FILES.filter((f) => fs.existsSync(path.join(root, f)));
  const walk = (rel) => {
    for (const entry of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const p = path.posix.join(rel, entry.name);
      if (entry.isDirectory()) walk(p);
      else out.push(p);
    }
  };
  for (const dir of DIRS) if (fs.existsSync(path.join(root, dir))) walk(dir);
  return out.sort();
}

function build(root, outDir) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  const files = listFiles(root);
  fs.mkdirSync(outDir, { recursive: true });
  const zips = [];
  for (const target of ['chrome', 'firefox']) {
    const stage = fs.mkdtempSync(path.join(os.tmpdir(), `${NAME}-${target}-`));
    try {
      for (const f of files) {
        const dest = path.join(stage, f);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        if (f === 'manifest.json' && target === 'chrome') {
          fs.writeFileSync(dest, JSON.stringify(chromeManifest(manifest), null, 2) + '\n');
        } else {
          fs.copyFileSync(path.join(root, f), dest);
        }
      }
      const zip = path.join(outDir, `${NAME}-${manifest.version}-${target}.zip`);
      fs.rmSync(zip, { force: true });
      execFileSync('zip', ['-q', '-r', '-X', zip, ...files], { cwd: stage });
      zips.push(zip);
    } finally {
      fs.rmSync(stage, { recursive: true, force: true });
    }
  }
  return zips;
}

if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  for (const zip of build(root, path.join(root, 'dist'))) console.log(zip);
}

module.exports = { chromeManifest, listFiles, build };
