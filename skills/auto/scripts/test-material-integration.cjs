const { validate } = require('./validate-material-integration.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-materials-'));
try {
  fs.writeFileSync(path.join(root, 'source.txt'), 'original exact notice');
  fs.writeFileSync(path.join(root, 'target.txt'), 'integrated fixture');
  const sha = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
  const m = { applicable: true, sources: [{ sourceId: 'A', sourcePath: 'source.txt', sourceSha256: sha('source.txt'), exactTextAuthority: 'source pixels' }], bindings: [{ segmentId: 'SEG001', shotIds: ['SHOT001'], sourceIds: ['A'], referenceRoles: { A: 'notice content' }, placement: 'courtyard wall', readableContent: 'original exact notice', targetAssetId: 'L01', integrationMethod: 'reference_image_edit', targetPath: 'target.txt', targetSha256: sha('target.txt'), humanReview: 'pending' }] };
  assert.equal(validate(root, m, false).passed, true);
  assert.equal(validate(root, m).passed, false);
  m.bindings[0].humanReview = 'approved';
  assert.equal(validate(root, m).passed, true);
  m.bindings[0].integrationMethod = 'archive';
  assert.equal(validate(root, m).passed, false);
  m.bindings = [];
  assert.equal(validate(root, m).passed, false);
  assert.equal(validate(root, { applicable: false, reason: 'No supplied material', sources: [] }).passed, true);
  console.log('6 material integration gate tests passed.');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
