#!/usr/bin/env node
// Usage: npm run bump -- patch|minor|major|x.y.z
// Keeps manifest.json, package.json and package-lock.json on the same version (stores reject a
// repeated version, so every resubmission needs a bump). Edits only the version fields.
const fs = require('node:fs');
const path = require('node:path');

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

function parse(v) {
  const m = SEMVER.exec(v);
  return m ? m.slice(1).map(Number) : null;
}

function isHigher(next, cur) {
  for (let i = 0; i < 3; i++) if (next[i] !== cur[i]) return next[i] > cur[i];
  return false;
}

function nextVersion(current, kind) {
  const cur = parse(current);
  if (!cur) throw new Error(`current version "${current}" is not x.y.z`);
  let next;
  if (kind === 'patch') next = [cur[0], cur[1], cur[2] + 1];
  else if (kind === 'minor') next = [cur[0], cur[1] + 1, 0];
  else if (kind === 'major') next = [cur[0] + 1, 0, 0];
  else {
    next = parse(kind);
    if (!next) {
      throw new Error(/^\d/.test(String(kind)) ? `version must be x.y.z, got "${kind}"` : 'expected patch, minor, major or an x.y.z version');
    }
    if (!isHigher(next, cur)) throw new Error(`new version ${kind} must be higher than ${current}`);
  }
  return next.join('.');
}

function bump(root, kind) {
  const manifestPath = path.join(root, 'manifest.json');
  const packagePath = path.join(root, 'package.json');
  const lockPath = path.join(root, 'package-lock.json');
  const manifestText = fs.readFileSync(manifestPath, 'utf8');
  const packageText = fs.readFileSync(packagePath, 'utf8');
  const current = JSON.parse(manifestText).version;
  const packageVersion = JSON.parse(packageText).version;
  if (current !== packageVersion) {
    throw new Error(`manifest.json (${current}) and package.json (${packageVersion}) disagree on the version`);
  }
  const next = nextVersion(current, kind);
  const setVersion = (text) => text.replace(/("version":\s*")[^"]+(")/, `$1${next}$2`);

  // Compute everything first so a failure above leaves all files untouched.
  const writes = [
    [manifestPath, setVersion(manifestText)],
    [packagePath, setVersion(packageText)],
  ];
  if (fs.existsSync(lockPath)) {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    lock.version = next;
    if (lock.packages && lock.packages['']) lock.packages[''].version = next;
    writes.push([lockPath, JSON.stringify(lock, null, 2) + '\n']);
  }
  for (const [file, content] of writes) fs.writeFileSync(file, content);
  return next;
}

if (require.main === module) {
  try {
    const next = bump(path.resolve(__dirname, '..'), process.argv[2]);
    console.log(`Version is now ${next}. Review with git diff, then run npm test and npm run package.`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

module.exports = { nextVersion, bump };
