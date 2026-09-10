const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { inventory, verifyIntegrity } = require('./check-auto-d.cjs');
const { installTransaction } = require('./install-auto-d.cjs');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-g-safety-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true })); return root;
}
test('integrity rejects extra, missing, changed, duplicate and escaping files', t => {
  const root = fixture(t); const file = path.join(root, 'data.txt'); fs.writeFileSync(file, 'original');
  const manifest = { schema: 'auto-d-bundle/1', files: inventory(root) };
  const save = m => fs.writeFileSync(path.join(root, 'bundle-manifest.json'), JSON.stringify(m));
  save(manifest); assert.equal(verifyIntegrity(root), 1);
  fs.writeFileSync(path.join(root, 'extra.ts'), 'unlisted'); assert.throws(() => verifyIntegrity(root), /Unlisted/); fs.unlinkSync(path.join(root, 'extra.ts'));
  fs.writeFileSync(file, 'changed'); assert.throws(() => verifyIntegrity(root), /Changed/); fs.unlinkSync(file); assert.throws(() => verifyIntegrity(root), /Missing/);
  save({ ...manifest, files: [...manifest.files, ...manifest.files] }); assert.throws(() => verifyIntegrity(root), /Duplicate/);
  save({ ...manifest, files: [{ ...manifest.files[0], path: '../escape' }] }); assert.throws(() => verifyIntegrity(root), /Unsafe/);
});
for (const failure of ['missing_staged_file', 'verification', 'none']) test('transaction ' + failure, t => {
  const root = fixture(t); const target = path.join(root, 'target'); const staging = path.join(root, 'staging'); const backup = path.join(root, 'backup');
  fs.mkdirSync(path.join(target, 'skills/auto'), { recursive: true }); fs.mkdirSync(staging);
  fs.writeFileSync(path.join(target, 'skills/auto/old.txt'), 'old'); fs.writeFileSync(path.join(target, 'AGENTS.md'), 'original preferences'); fs.writeFileSync(path.join(target, 'unrelated.txt'), 'preserve');
  fs.mkdirSync(path.join(staging, 'auto')); fs.writeFileSync(path.join(staging, 'auto/new.txt'), 'new'); fs.writeFileSync(path.join(staging, 'AGENTS.md'), 'updated'); fs.writeFileSync(path.join(staging, 'plugin.ts'), 'new plugin');
  const before = inventory(target);
  const entries = [{ rel: 'skills/auto', source: path.join(staging, 'auto') }, { rel: 'AGENTS.md', source: path.join(staging, 'AGENTS.md') }, { rel: 'plugins/fast-image.ts', source: path.join(staging, 'plugin.ts') }];
  if (failure === 'missing_staged_file') entries.push({ rel: 'last.txt', source: path.join(staging, 'missing') });
  const run = () => installTransaction(entries, target, backup, () => { if (failure === 'verification') throw Error('probe failed'); return 'passed'; });
  if (failure === 'none') { assert.equal(run(), 'passed'); assert.equal(fs.readFileSync(path.join(backup, 'originals/AGENTS.md'), 'utf8'), 'original preferences'); }
  else { assert.throws(run, /previous installation restored/); assert.deepEqual(inventory(target), before); assert.equal(JSON.parse(fs.readFileSync(path.join(backup, 'transaction.json'))).status, 'rolled_back'); }
  assert.equal(fs.readFileSync(path.join(target, 'unrelated.txt'), 'utf8'), 'preserve');
});
