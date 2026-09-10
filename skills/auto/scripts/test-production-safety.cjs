const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { reserveVideo } = require('./lib/video-budget.cjs');
const { build, validate } = require('./workbook-openxml.cjs');
const { sourceDialogue, sourceEvents, performedDialogue } = require('./lib/dialogue.cjs');
function rootFor(t) { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opencode', 'production-safety-')); t.after(() => fs.rmSync(root, { recursive: true, force: true })); return root; }
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function budget(t) { const file = path.join(rootFor(t), 'auto-state.json'); fs.writeFileSync(file, JSON.stringify({ control: { mode: 'video', videoSideEffectsAllowed: true }, video: { authorization: { status: 'authorized', explicitCommand: 'auto video', authorizedAt: '2026-09-05T00:00:00Z' } }, preVideoDelivery: { status: 'complete' }, budget: { videoLimit: 3, videoUsed: 0 } })); return file; }
test('budget reserves output count durably before execution', (t) => { const file = budget(t); reserveVideo(file, 2, 'job1'); assert.equal(JSON.parse(fs.readFileSync(file)).budget.videoUsed, 2); assert.throws(() => reserveVideo(file, 2, 'job2'), /exceeds/); });
test('budget rejects a replay without refunding prior attempt', (t) => { const file = budget(t); reserveVideo(file, 1, 'job'); assert.throws(() => reserveVideo(file, 1, 'job'), /already reserved/); assert.equal(JSON.parse(fs.readFileSync(file)).budget.videoUsed, 1); });
test('budget lock refuses simultaneous modification', (t) => { const file = budget(t); fs.writeFileSync(`${file}.video-lock`, ''); assert.throws(() => reserveVideo(file, 1, 'job'), /EEXIST/); assert.equal(JSON.parse(fs.readFileSync(file)).budget.videoUsed, 0); });
test('budget honors no-video mode even with stale authorization', (t) => { const file = budget(t); const state = JSON.parse(fs.readFileSync(file)); state.control.mode = 'episode_prevideo'; fs.writeFileSync(file, JSON.stringify(state)); assert.throws(() => reserveVideo(file, 1, 'job'), /authorization/); });
test('invalid output counts cannot bypass budget', (t) => { const file = budget(t); for (const value of [0, -1, 1.5, NaN, Infinity]) assert.throws(() => reserveVideo(file, value, 'job'), /positive integer/); });
test('workbook embeds original image, keeps ratio and detects later corruption', async (t) => {
  const root = rootFor(t); const sharp = require('sharp'); const image = path.join(root, 'approved.png');
  await sharp({ create: { width: 200, height: 50, channels: 3, background: '#8899aa' } }).png().toFile(image);
  const originalHash = sha(image); const inputPath = path.join(root, 'input.json'); const approvedAt = '2026-09-05T00:00:00Z';
  const input = { schemaVersion: 'auto-asset-workbook-input/1.0', sheetOrder: ['人物', '场景', '道具', '_索引'], outputFile: '资产总表.xlsx', projectId: 'test', approvalStatus: 'approved', approvedAt, assets: [{ assetId: 'PROP001', category: '道具', name: 'reference', images: [{ source: image, sha256: originalHash, role: 'identity', approvalStatus: 'approved', approvedAt }] }] };
  fs.writeFileSync(inputPath, JSON.stringify(input));
  const result = await build(root, inputPath, 'assets', false); await validate(result.path, result, 'assets');
  assert.equal(result.embeddedImageCount, 1); assert.equal(sha(image), originalHash);
  const ExcelJS = require('exceljs'); const book = new ExcelJS.Workbook(); await book.xlsx.readFile(result.path);
  const embedded = book.getWorksheet('道具').getImages()[0]; assert.equal(embedded.range.ext.width / embedded.range.ext.height, 4);
  assert.equal(crypto.createHash('sha256').update(book.getImage(embedded.imageId).buffer).digest('hex'), originalHash);
  await assert.rejects(build(root, inputPath, 'assets', false), /exists/);
  const goodHash = sha(result.path); input.assets[0].images[0].approvalStatus = 'pending'; fs.writeFileSync(inputPath, JSON.stringify(input));
  await assert.rejects(build(root, inputPath, 'assets', true), /Unapproved/); assert.equal(sha(result.path), goodHash);
  fs.writeFileSync(result.path, 'corrupt'); await assert.rejects(validate(result.path, result, 'assets'), /changed/);
});
test('source parser retains OS speaker and exact dialogue, excludes annotations', () => {
  assert.deepEqual(sourceDialogue('张北（抬头）OS：回来。'), { speaker: '张北', text: '回来。' });
  assert.equal(sourceDialogue('人物：张北、老白'), null); assert.equal(sourceDialogue('△弹幕：【老白：好！】'), null);
  assert.deepEqual(performedDialogue('主体1点头，主体2同步说：“回来。”').map((entry) => [entry.subject, entry.text]), [[2, '回来。']]);
});
test('source and actual nonvisual delivery forms are distinct', () => {
  assert.deepEqual(performedDialogue('电话声音（王老二）说：“回来。”').map((entry) => [entry.speaker, entry.delivery, entry.text]), [['王老二', 'phone', '回来。']]);
  assert.deepEqual(performedDialogue('现场齐声（现场观众）说：“好！”').map((entry) => [entry.speaker, entry.delivery]), [['现场观众', 'onsite_group']]);
  assert.deepEqual(performedDialogue('线上弹幕（网友）显示：“好！”').map((entry) => [entry.speaker, entry.delivery]), [['网友', 'online_comment']]);
});
test('O.S./OS is offscreen while VO and inner speech remain voiceover', () => {
  for (const marker of ['O.S.', 'OS', '画外']) assert.equal(performedDialogue(`主体1 ${marker}：“回来。”`)[0].delivery, 'offscreen');
  for (const marker of ['VO', '内心']) assert.equal(performedDialogue(`主体1 ${marker}：“回来。”`)[0].delivery, 'voiceover');
  assert.throws(() => performedDialogue('主体1说：回来。'), /Unparsed/);
  assert.throws(() => performedDialogue('主体1说：“回来。”阿明继续说：再见。'), /Unparsed/);
  assert.equal(performedDialogue('主体1说：“他说：回来。”', { strict: true })[0].text, '他说：回来。');
});
test('source blank lines retain dialogue ownership until an explicit boundary', () => {
  assert.deepEqual(sourceEvents(['阿明：回来。', '', '千万别走。', '△阿明关门。']).ledger, [{ speaker: '阿明', text: '回来。\n\n千万别走。' }]);
  assert.deepEqual(sourceEvents(['阿明：回来。', '', '△阿明关门。']).ledger, [{ speaker: '阿明', text: '回来。' }]);
  assert.deepEqual(sourceEvents(['字幕：回来。', '音效：关门声。', '△阿明关门。']).kinds, ['screen_text', 'sound', 'action']);
});
test('literal screen text is not speech and ambiguous speaker clauses block', () => {
  assert.deepEqual(performedDialogue('屏幕文字：“他说：快走。”'), []);
  assert.throws(() => performedDialogue('主体1问主体2：“回来。”'), /Unparsed dialogue owner/);
  assert.throws(() => performedDialogue('无。额外旁白。', { strict: true }), /Unparsed dialogue/);
});
