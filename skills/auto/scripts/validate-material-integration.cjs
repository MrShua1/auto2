const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
function validate(root, manifest, final = true) {
  const errors = [];
  const check = (file, sha, label) => {
    if (!file || !/^[a-f0-9]{64}$/i.test(sha || '')) { errors.push(`${label}: missing path/hash`); return; }
    try {
      const actual = crypto.createHash('sha256').update(fs.readFileSync(path.resolve(root, file))).digest('hex');
      if (actual !== sha) errors.push(`${label}: changed file`);
    } catch { errors.push(`${label}: missing file`); }
  };
  if (manifest.applicable === false) {
    if (!manifest.reason || (manifest.sources || []).length) errors.push('Not-applicable requires a reason and zero sources');
    return { passed: errors.length === 0, errors };
  }
  if (!Array.isArray(manifest.sources) || !manifest.sources.length) errors.push('Missing source inventory');
  if (!Array.isArray(manifest.bindings)) errors.push('Missing visible material bindings');
  const ids = new Set();
  for (const source of manifest.sources || []) {
    if (!source.sourceId || ids.has(source.sourceId)) errors.push('Duplicate/missing source ID');
    ids.add(source.sourceId);
    check(source.sourcePath, source.sourceSha256, source.sourceId);
    if (!source.exactTextAuthority) errors.push(`${source.sourceId}: missing text authority`);
    if (source.excluded && !source.exclusionReason) errors.push(`${source.sourceId}: missing exclusion reason`);
    if (!source.excluded && !(manifest.bindings || []).some(b => (b.sourceIds || []).includes(source.sourceId))) errors.push(`${source.sourceId}: archive-only source`);
  }
  for (const binding of manifest.bindings || []) {
    if (!binding.segmentId || !binding.shotIds?.length || !binding.sourceIds?.length || !binding.referenceRoles || !binding.placement || !binding.readableContent) errors.push('Incomplete material binding');
    if (!['reference_image_edit', 'deterministic_composite'].includes(binding.integrationMethod)) errors.push('Archive/blank surface is not visible integration');
    for (const id of binding.sourceIds || []) if (!ids.has(id)) errors.push(`Unknown source ${id}`);
    check(binding.targetPath, binding.targetSha256, binding.targetAssetId);
    if (final && binding.humanReview !== 'approved') errors.push(`${binding.targetAssetId}: placement/text review pending`);
  }
  return { passed: errors.length === 0, errors };
}
module.exports = { validate };
if (require.main === module) {
  try {
    const root = path.resolve(process.argv[2] || '.');
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'material-integration.json'), 'utf8'));
    const result = validate(root, manifest, !process.argv.includes('--draft'));
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.passed ? 0 : 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
