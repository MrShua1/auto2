const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = __dirname;
const excluded = new Set(['bundle-manifest.json', 'readiness-result.json']);
function inventory(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    if (e.isSymbolicLink()) throw Error('Bundle links are not allowed: ' + p);
    if (e.isDirectory()) return inventory(p, base);
    if (!e.isFile()) throw Error('Unsupported bundle entry: ' + p);
    return [{ path: path.relative(base, p).replaceAll('\\', '/'), sha256: crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') }];
  });
}
function verifyIntegrity(base = root) {
  const m = JSON.parse(fs.readFileSync(path.join(base, 'bundle-manifest.json')));
  if (m.schema !== 'auto-d-bundle/1' || !Array.isArray(m.files) || !m.files.length) throw Error('Invalid bundle manifest');
  const expected = new Map();
  for (const f of m.files) {
    if (typeof f.path !== 'string' || f.path.includes('\\') || f.path.includes(':') || path.posix.isAbsolute(f.path) || f.path.split('/').some(p => !p || p === '.' || p === '..') || excluded.has(f.path) || !/^[a-f0-9]{64}$/.test(f.sha256)) throw Error('Unsafe/invalid manifest entry');
    const key = f.path.toLowerCase();
    if (expected.has(key)) throw Error('Duplicate manifest path: ' + f.path);
    expected.set(key, f);
  }
  for (const f of inventory(base)) {
    if (excluded.has(f.path)) continue;
    const key = f.path.toLowerCase(); const entry = expected.get(key);
    if (!entry) throw Error('Unlisted bundle file: ' + f.path);
    if (f.sha256 !== entry.sha256) throw Error('Changed bundle file: ' + f.path);
    expected.delete(key);
  }
  if (expected.size) throw Error('Missing bundle file: ' + expected.values().next().value.path);
  return m.files.length;
}
function check() {
  const count = verifyIntegrity();
  const modules = ['cinematic-director', 'cinematic-prompt', 'image-execution', 'keyframe-storyboard', 'libtv-cli', 'story-director', 'storyboard-director', 'tsc'];
  for (const module of modules) if (!fs.existsSync(path.join(root, 'skills/auto/modules', module, 'MODULE.md'))) throw Error('Missing module ' + module);
  const node = path.join(root, 'runtimes/node.exe'); const bun = path.join(root, 'runtimes/bun.exe');
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-g-check-'));
  fs.mkdirSync(path.join(temporary, 'opencode'));
  const env = { ...process.env, TEMP: temporary, TMP: temporary, AUTO_TEST_TMP: path.join(temporary, 'opencode'), PATH: path.join(root, 'runtimes') + path.delimiter + process.env.PATH };
  const run = (exe, args, cwd) => {
    const r = spawnSync(exe, args, { cwd, env, encoding: 'utf8', windowsHide: true, timeout: 180000, maxBuffer: 16 * 1024 * 1024 });
    if (r.error || r.status !== 0) throw Error(`${args.join(' ')}\n${r.error?.message || ''}\n${r.stdout}\n${r.stderr}`);
  };
  try {
    run(node, ['test-host-config-evidence.cjs'], root);
    run(node, ['--test', 'test-bundle-safety.cjs'], root);
    run(bun, ['test', './fast-image.test.ts'], path.join(root, 'image-runtime'));
    run(node, ['--test', 'test-character-asset-standard.cjs'], path.join(root, 'skills/auto/scripts'));
    for (const file of ['test-material-integration.cjs', 'test-image-attempts.cjs', 'test-content-review.cjs', 'test-numbered-shots.cjs', 'test-package-mapping.cjs', 'test-production-safety.cjs']) run(node, [file], path.join(root, 'skills/auto/scripts'));
    for (const file of ['project-intake-smoke.cjs', 'production-profile-smoke.cjs']) run(node, [path.join(root, 'skills/auto/scripts/tests', file)], temporary);
    for (const name of ['yaml', 'sharp', 'exceljs']) require(path.join(root, 'skills/auto/node_modules', name));
    verifyIntegrity();
    return { bundleIntegrity: true, files: count, internalModules: modules.length, imageTests: true, autoTests: true, characterStandardTests: true, integrationTests: true, bundleSafetyTests: true, liveApi: 'NOT_TESTED', credentials: 'NOT_BUNDLED', currentHostToolRegistration: 'UNKNOWN_NOT_MEASURED', hostRegistrationChecked: false, platform: 'win32-x64' };
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
}
module.exports = { check, inventory, verifyIntegrity };
if (require.main === module) {
  try {
    if (process.argv.includes('--seal')) {
      const files = inventory(root).filter(f => !excluded.has(f.path));
      fs.writeFileSync(path.join(root, 'bundle-manifest.json'), JSON.stringify({ schema: 'auto-d-bundle/1', files }, null, 2));
    } else console.log(JSON.stringify(check(), null, 2));
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
