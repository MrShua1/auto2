// Documentation regression checks, not image-content or model-compliance tests.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('character layout exceptions retain the shared asset requirements', () => {
  const rules = read('references/internal-production-rules.md');
  assert.ok(!rules.includes('Every other newly generated canonical asset prompt'));
  for (const text of ['Only these exceptions', 'item 1', 'item 4', 'item 8',
    'All other requirements remain mandatory', 'per-view camera', 'light/depth', 'material/realism'])
    assert.ok(rules.includes(text), text);
  const standard = read('references/character-asset-standard.md');
  for (const text of ['The layout block is not the whole prompt', 'lens',
    'light direction/softness', 'garment', 'output aspect ratio']) assert.ok(standard.includes(text), text);
});

test('TSC receives an explicit composite-use instruction through its module and gate', () => {
  const standard = read('references/character-asset-standard.md');
  assert.match(standard, /## TSC Reference Instruction/);
  assert.match(standard, /TSC MUST write/);
  assert.match(standard, /once in the actual/);
  const block = standard.slice(standard.indexOf('## TSC Reference Instruction')).match(/```text\n([\s\S]*?)\n```/);
  assert.ok(block);
  for (const text of ['{{Mixed N}}', '\u540c\u4e00\u4e3b\u4f53N', '\u5de6\u683c', '\u53f3\u4e0a\u683c', '\u53f3\u4e0b\u683c',
    '\u5206\u683c', '\u91cd\u590d\u4eba\u7269', '\u5934\u9888\u88c1\u5207', '\u5c55\u793a\u7ad9\u59ff'])
    assert.ok(block[1].includes(text), text);
  const module = read('modules/tsc/MODULE.md');
  assert.ok(module.includes('../../references/character-asset-standard.md'));
  assert.ok(module.includes('A handoff-only note does not satisfy'));
  assert.ok(read('references/quality-gates.md').includes('A handoff-only note does not pass'));
});

test('scope preserves candidate counting and existing deliveries', () => {
  const standard = read('references/character-asset-standard.md');
  for (const text of ['ONE candidate, ONE output and ONE logical image job',
    'no paid generation', 'single-view references', 'already delivered prompts',
    'one Mixed slot per approved character composite']) assert.ok(standard.includes(text), text);
});
