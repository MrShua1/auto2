const path = require('path');

function validateMapping(text, assets, segmentId) {
  const rows = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => /^\{\{Mixed \d+\}\}\t/.test(line));
  if (rows.length !== assets.length) throw new Error(`${segmentId}: mapping row count mismatch.`);
  const categories = { character: '人物', location: '场景', prop: '道具', character_voice: '声音参考', environment_audio: '声音参考', sound_effect: '声音参考' };
  const destinations = new Set();
  assets.forEach((asset, index) => {
    const destination = String(asset.destination || '').replace(/\\/g, '/');
    const category = categories[asset.assetType];
    if (!category || !destination.startsWith(`资产/${category}/`) || destination.split('/').some((part) => !part || part === '.' || part === '..') || path.posix.isAbsolute(destination)) throw new Error(`${segmentId}: invalid asset category/path.`);
    if (destinations.has(destination.toLowerCase())) throw new Error(`${segmentId}: duplicate asset destination.`);
    destinations.add(destination.toLowerCase());
    const expected = [`{{Mixed ${index + 1}}}`, 'OK', asset.assetType, asset.role, destination];
    const actual = rows[index].split('\t');
    if (actual.length !== expected.length || actual.some((value, column) => (column === 4 ? value.replace(/\\/g, '/') : value) !== expected[column])) throw new Error(`${segmentId}: mapping row ${index + 1} differs from configured asset ownership/path.`);
  });
}

module.exports = { validateMapping };
