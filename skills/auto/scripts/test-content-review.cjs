#!/usr/bin/env node
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { validateContentReview, validateDuration, validateKnownDefects, isStandaloneAlias, CHECKS, ARTIFACTS } = require('./lib/content-review.cjs');

function fixture(t) {
  const parent = process.env.AUTO_TEST_TMP || path.join(os.tmpdir(), 'opencode');
  assert.ok(fs.existsSync(parent), 'Test parent must already exist.');
  const root = fs.mkdtempSync(path.join(parent, 'auto-content-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (name, value) => fs.writeFileSync(path.join(root, name), value);
  const hash = (name) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex');
  const source = '第1集\n阿明：回来。\n△阿明关门。';
  const prompt = '【0.0—2.0秒】主体1同步说：“回来。”\n【2.0—3.0秒】主体1用右手把门推至门框，门闭合。\n【结束状态】门已关闭。';
  write('source.txt', source); write('script.txt', source); write('prompt.txt', prompt);
  write('storyboard.txt', 'Source-specific staging under review.');
  write('handoff.yaml', 'script:\n  exact_dialogue:\n    - speaker: 阿明\n      text: 回来。\n');
  const segment = { id: 'SEG001', durationSeconds: 3, promptSource: 'prompt.txt', scriptVerbatimSource: 'script.txt', storyboardExecutionSource: 'storyboard.txt', tscHandoffSource: 'handoff.yaml', assets: [{ assetType: 'character', characterName: '阿明', promptAliases: ['阿明'] }] };
  const config = { schemaVersion: 'auto-episode-package/2.3', scriptSource: 'source.txt', segments: [segment] };
  const state = { project: {} };
  const review = { schemaVersion: 'auto-content-review/1.0', status: 'passed', reviewer: { id: 'test-independent-reader', method: 'independent_semantic_read', reviewedAt: new Date().toISOString() }, issues: [], segments: [{ id: 'SEG001', hashes: {}, checks: Object.fromEntries(CHECKS.map((key) => [key, { status: 'passed', evidence: `Fixture ${key}: door closes after the spoken call.` }])), events: [
    { lineStart: 1, lineEnd: 1, sourceText: '第1集', kind: 'metadata', interpretation: 'Episode heading, not an on-screen card.', phase: null, startSeconds: null, endSeconds: null, appliedTo: 'Episode identity and source indexing only.' },
    { lineStart: 2, lineEnd: 2, sourceText: '阿明：回来。', kind: 'dialogue', interpretation: 'A Ming calls back before closing the door.', phase: 1, promptEvidence: '主体1同步说：“回来。”', startSeconds: 0, endSeconds: 2, requiredSeconds: 1.5, timingBasis: 'Two spoken syllables with a one-second pause.', subjects: [1], speaker: '阿明', speakerSubject: 1, spokenText: '回来。', delivery: 'sync', speechUnits: 2, unitsPerSecond: 4, pauseSeconds: 1 },
    { lineStart: 3, lineEnd: 3, sourceText: '△阿明关门。', kind: 'action', interpretation: 'Right hand pushes the door into the frame.', phase: 2, promptEvidence: '主体1用右手把门推至门框，门闭合。', startSeconds: 2, endSeconds: 3, requiredSeconds: 1, timingBasis: 'Short final door travel takes one second.', subjects: [1] },
  ] }] };
  const save = () => {
    write('episode-package-config.json', JSON.stringify(config));
    review.configSha256 = hash('episode-package-config.json'); review.scriptSha256 = hash('source.txt');
    review.segments[0].hashes = Object.fromEntries(ARTIFACTS.map((key) => [key, hash(segment[key])]));
    write('content-review.json', JSON.stringify(review));
  };
  save();
  return { root, config, state, review, write, save, run: () => validateContentReview({ root, configPath: path.join(root, 'episode-package-config.json'), config, state }) };
}

test('legal independent review, no invented 15-30 range or 4-second floor', (t) => { assert.equal(fixture(t).run().validation, 'passed'); });
test('legacy schema keeps its creative duration contract', (t) => { const f = fixture(t); f.config.schemaVersion = 'auto-episode-package/2.1'; f.save(); assert.equal(f.run().validation, 'passed'); });
test('missing evidence blocks despite cached passed flag', (t) => { const f = fixture(t); f.state.semanticReview = { status: 'passed' }; fs.unlinkSync(path.join(f.root, 'content-review.json')); assert.throws(f.run, /Missing content-review/); });
test('changed prompt invalidates evidence', (t) => { const f = fixture(t); f.write('prompt.txt', 'Changed prompt'); assert.throws(f.run, /stale promptSource/); });
test('changed config invalidates evidence', (t) => { const f = fixture(t); f.write('episode-package-config.json', '{}'); assert.throws(f.run, /stale relative to package config/); });
test('changed storyboard invalidates evidence', (t) => { const f = fixture(t); f.write('storyboard.txt', 'Changed blocking'); assert.throws(f.run, /stale storyboardExecutionSource/); });
test('source line cannot disappear from review', (t) => { const f = fixture(t); f.review.segments[0].events.pop(); f.save(); assert.throws(f.run, /source line 3/); });
test('production metadata cannot consume a phase', (t) => { const f = fixture(t); f.review.segments[0].events[0].phase = 1; f.save(); assert.throws(f.run, /metadata must consume zero/); });
test('dialogue evidence in a different phase is rejected', (t) => { const f = fixture(t); f.review.segments[0].events[1].phase = 2; f.save(); assert.throws(f.run, /absent from its assigned phase/); });
test('wrong identity cannot pass as synchronous speaker', (t) => { const f = fixture(t); f.review.segments[0].events[1].speaker = '别人'; f.save(); assert.throws(f.run, /identity does not match/); });
test('long dialogue cannot fit by clamping declared duration', (t) => { const f = fixture(t); f.review.segments[0].events[1].speechUnits = 128; f.save(); assert.throws(f.run, /cannot fit/); });
test('handoff dialogue cannot disappear from timed review', (t) => { const f = fixture(t); f.write('handoff.yaml', 'script:\n  exact_dialogue:\n    - speaker: 阿明\n      text: 回来。还有一句。\n'); f.save(); assert.throws(f.run, /source dialogue differs/); });
test('on-site audience is not an online comment', (t) => { const f = fixture(t); const e = f.review.segments[0].events[1]; e.speaker = '现场观众'; e.delivery = 'online_comment'; f.save(); assert.throws(f.run, /on-site audience/); });
test('reviewer evidence cannot be replaced by passed flags', (t) => { const f = fixture(t); f.review.segments[0].checks.userLocks.evidence = 'passed'; f.save(); assert.throws(f.run, /substantive userLocks/); });
test('open issues block completion', (t) => { const f = fixture(t); f.review.issues.push('Incorrect prop ownership'); f.save(); assert.throws(f.run, /Unresolved review issues/); });
test('formal copy must match evidence', (t) => { const f = fixture(t); assert.throws(() => validateContentReview({ root: f.root, configPath: path.join(f.root, 'episode-package-config.json'), config: f.config, state: f.state, formalRoot: path.join(f.root, 'missing') }), /Formal delivery review/); });
test('locked 15-30 range cannot be omitted', () => { assert.throws(() => validateDuration({ segments: [] }, { project: { segmentDurationRangeSeconds: [15, 30] } }), /recorded user/); });
test('duration above maximum fails', () => { assert.throws(() => validateDuration({ segmentDurationMinimumSeconds: 15, segmentDurationMaximumSeconds: 30, segments: [{ id: 'SEG001', durationSeconds: 31 }] }), /outside locked/); });
test('fractional legal durations remain valid', () => { validateDuration({ segmentDurationMinimumSeconds: 1.5, segmentDurationMaximumSeconds: 3.5, segments: [{ durationSeconds: 2.5 }] }); });
test('quoted original punctuation and words are preserved', () => { validateKnownDefects('【0.0—2.0秒】主体1说：“△对应人物主体，老白干。”【结束状态】静止。', 'SEG001'); });
test('unresolved subject outside quote fails', () => { assert.throws(() => validateKnownDefects('【0.0—2.0秒】对应人物主体同步说话。【结束状态】静止。', 'SEG001'), /unresolved subject/); });
test('alias matching does not corrupt ordinary words or longer names', () => { assert.equal(isStandaloneAlias('老白干、蓝玉峰', '老白'), false); assert.equal(isStandaloneAlias('蓝玉峰', '蓝玉'), false); assert.equal(isStandaloneAlias('老白，', '老白'), true); assert.equal(isStandaloneAlias('Joanne', 'Ann'), false); });
test('changed handoff invalidates review', (t) => { const f = fixture(t); f.write('handoff.yaml', 'script: {}'); assert.throws(f.run, /stale tscHandoffSource/); });
test('changed authoritative source invalidates review', (t) => { const f = fixture(t); f.write('source.txt', 'Changed original source'); assert.throws(f.run, /authoritative episode source/); });
test('dialogue cannot be assigned to a prop', (t) => { const f = fixture(t); f.config.segments[0].assets[0].assetType = 'prop'; f.save(); assert.throws(f.run, /no character binding/); });
test('offscreen conversion needs evidence', (t) => { const f = fixture(t); f.review.segments[0].events[1].delivery = 'offscreen'; f.save(); assert.throws(f.run, /source\/context evidence/); });
test('split dialogue preserves exact handoff order', (t) => { const f = fixture(t); const row = f.review.segments[0]; const first = row.events[1]; const second = structuredClone(first); first.spokenText = '回'; first.startSeconds = 0; first.endSeconds = 1; first.requiredSeconds = 1; first.speechUnits = 1; first.pauseSeconds = 0; second.spokenText = '来。'; second.startSeconds = 1; second.endSeconds = 2; second.requiredSeconds = 1; second.speechUnits = 1; second.pauseSeconds = 0; row.events.splice(2, 0, second); f.save(); assert.equal(f.run().validation, 'passed'); });
test('concurrent events require feasibility evidence', (t) => { const f = fixture(t); const row = f.review.segments[0]; row.events.push({ ...row.events[2], interpretation: 'A second overlapping movement has no feasibility explanation.' }); f.save(); assert.throws(f.run, /concurrent actions/); });
test('wrong user bounds are not replaced by defaults', () => { assert.throws(() => validateDuration({ segmentDurationMinimumSeconds: 1, segmentDurationMaximumSeconds: 15, segments: [] }, { project: { segmentDurationRangeSeconds: [15, 30] } }), /recorded user/); });
test('phase gaps cannot pass the content gate', (t) => { const f = fixture(t); f.write('prompt.txt', '【0.0—1.0秒】主体1同步说：“回来。”\n【2.0—3.0秒】主体1用右手把门推至门框，门闭合。\n【结束状态】门已关闭。'); f.save(); assert.throws(f.run, /contiguous/); });
test('source dialogue cannot be deleted by editing both review and handoff', (t) => { const f = fixture(t); f.write('handoff.yaml', 'script:\n  exact_dialogue: []\n'); f.review.segments[0].events[1].kind = 'metadata'; f.save(); assert.throws(f.run, /source dialogue differs/); });
test('wrong actual speaker fails despite correct review speaker', (t) => { const f = fixture(t); f.config.segments[0].assets.push({ assetType: 'character', characterName: '阿红' }); const evidence = '主体1点头，主体2同步说：“回来。”'; f.write('prompt.txt', `【0.0—2.0秒】${evidence}\n【2.0—3.0秒】主体1用右手把门推至门框，门闭合。\n【结束状态】门已关闭。`); f.review.segments[0].events[1].promptEvidence = evidence; f.save(); assert.throws(f.run, /actual prompt dialogue speaker/); });
test('appearance lock is not action execution', (t) => { const f = fixture(t); f.write('prompt.txt', '【0.0—2.0秒】主体1同步说：“回来。”\n【2.0—3.0秒】主体锁：主体1；不交换外观。\n【结束状态】门已关闭。'); f.review.segments[0].events[2].promptEvidence = '主体1'; f.save(); assert.throws(f.run, /action evidence must enact/); });
test('actual spoken fragments cannot be reversed within one phase', (t) => { const f = fixture(t); f.write('prompt.txt', '【0.0—2.0秒】主体1先说：“来。”；主体1随后说：“回”。\n【2.0—3.0秒】主体1用右手把门推至门框，门闭合。\n【结束状态】门已关闭。'); const first = f.review.segments[0].events[1]; const second = structuredClone(first); Object.assign(first, { spokenText: '回', promptEvidence: '主体1随后说：“回”', startSeconds: 0, endSeconds: 1, requiredSeconds: 1, speechUnits: 1, pauseSeconds: 0 }); Object.assign(second, { spokenText: '来。', promptEvidence: '主体1先说：“来。”', startSeconds: 1, endSeconds: 2, requiredSeconds: 1, speechUnits: 1, pauseSeconds: 0 }); f.review.segments[0].events.splice(2, 0, second); f.save(); assert.throws(f.run, /actual prompt dialogue speaker\/order\/text/); });
test('explicit named offscreen voice preserves source owner without faking visibility', (t) => { const f = fixture(t); const e = f.review.segments[0].events[1]; e.delivery = 'offscreen'; e.deliveryEvidence = 'The source staging places A Ming beyond the doorway.'; e.promptEvidence = '画外声音（阿明）说：“回来。”'; e.subjects = []; delete e.speakerSubject; f.write('prompt.txt', `【0.0—2.0秒】${e.promptEvidence}\n【2.0—3.0秒】主体1用右手把门推至门框，门闭合。\n【结束状态】门已关闭。`); f.save(); assert.equal(f.run().validation, 'passed'); });

function useNumbered(f) {
  const { shotsOf } = require('./lib/shot-format.cjs');
  const phases = shotsOf(fs.readFileSync(path.join(f.root, 'prompt.txt'), 'utf8'));
  f.config.productionProfile = { prompt: { shotFormat: 'numbered_fields_v1', endingPolicy: '文字状态。' }, look: { styleSuffix: '自然光。' } };
  f.config.segments[0].shotTimings = phases.map((phase) => ({ shot: phase.number, startSeconds: phase.start, endSeconds: phase.end }));
  f.write('prompt.txt', '【站位与起始状态】\n主体1站在门前，门敞开。\n' + phases.map((phase, index) => `【镜头${index + 1}】\n人物：主体1。\n场景/时间/光线：门口白天。\n景别/拍摄/运镜：固定中景。\n主体：主体1。\n动作/表演：${index ? phase.body.trim() : '主体1保持站位。'}\n位置承接：门口。\n台词/O.S./OS：${index ? '无。' : phase.body.trim()}\n视效：无。\n环境音/动作音：无。\n转场：连续。\n`).join('\n') + '【结束状态】\n主体1站在门前，门已关闭。\n文字状态。\n\n自然光。');
}
test('content gate rejects a sub-centisecond numbered gap', (t) => {
  const f = fixture(t); useNumbered(f);
  f.config.productionProfile.prompt.requireShotDuration = true;
  f.config.segments[0].shotTimings[1].startSeconds = 2.009;
  f.write('prompt.txt', fs.readFileSync(path.join(f.root, 'prompt.txt'), 'utf8').replace('【镜头1】', '【镜头1】（2秒）').replace('【镜头2】', '【镜头2】（0.991秒）'));
  f.save(); assert.throws(f.run, /contiguous/);
});
test('content gate enforces the displayed duration total', (t) => {
  const f = fixture(t); useNumbered(f);
  f.config.productionProfile.prompt.requireShotDuration = true;
  f.write('prompt.txt', fs.readFileSync(path.join(f.root, 'prompt.txt'), 'utf8').replace('【镜头1】', '【镜头1】（2.0000006秒）').replace('【镜头2】', '【镜头2】（1.0000006秒）'));
  f.save(); assert.throws(f.run, /must sum to 3/);
});
for (const numbered of [false, true]) {
  const save = (f) => { if (numbered) useNumbered(f); f.save(); };
  test(`${numbered ? 'numbered' : 'legacy'} rejects extra unquoted dialogue`, (t) => {
    const f = fixture(t); f.write('prompt.txt', fs.readFileSync(path.join(f.root, 'prompt.txt'), 'utf8').replace('回来。”', '回来。”主体1继续说：不要回来，马上离开。')); save(f);
    assert.throws(f.run, /Unparsed dialogue/);
  });
  test(`${numbered ? 'numbered' : 'legacy'} cannot reclassify action as screen text`, (t) => {
    const f = fixture(t); const e = f.review.segments[0].events[2]; e.kind = 'screen_text'; e.promptEvidence = '主体1'; save(f);
    assert.throws(f.run, /event kind differs/);
  });
  test(`${numbered ? 'numbered' : 'legacy'} blocks omitted multiline source continuation`, (t) => {
    const f = fixture(t); const source = '第1集\n阿明：回来。\n千万别走。\n△阿明关门。';
    f.write('source.txt', source); f.write('script.txt', source); Object.assign(f.review.segments[0].events[2], { lineEnd: 4, sourceText: '千万别走。\n△阿明关门。' }); save(f);
    assert.throws(f.run, /source dialogue differs/);
  });
  test(`${numbered ? 'numbered' : 'legacy'} preserves complete multiline source dialogue`, (t) => {
    const f = fixture(t); const source = '第1集\n阿明：回来。\n千万别走。\n△阿明关门。';
    f.write('source.txt', source); f.write('script.txt', source);
    f.write('handoff.yaml', require('yaml').stringify({ script: { exact_dialogue: [{ speaker: '阿明', text: '回来。\n千万别走。' }] } }));
    const e = f.review.segments[0].events[1]; Object.assign(e, { lineEnd: 3, sourceText: '阿明：回来。\n千万别走。', spokenText: '回来。\n千万别走。', promptEvidence: '主体1同步说：“回来。\n千万别走。”', speechUnits: 6, unitsPerSecond: 4, pauseSeconds: 0 });
    Object.assign(f.review.segments[0].events[2], { lineStart: 4, lineEnd: 4 });
    f.write('prompt.txt', `【0.0—2.0秒】${e.promptEvidence}\n【2.0—3.0秒】主体1用右手把门推至门框，门闭合。\n【结束状态】门已关闭。`); save(f);
    assert.equal(f.run().validation, 'passed');
  });
  test(`${numbered ? 'numbered' : 'legacy'} accepts offscreen O.S. without converting to inner voice`, (t) => {
    const f = fixture(t); const e = f.review.segments[0].events[1]; Object.assign(e, { delivery: 'offscreen', deliveryEvidence: 'The speaker stands beyond the visible doorway.', promptEvidence: '主体1 O.S.：“回来。”' });
    f.write('prompt.txt', `【0.0—2.0秒】${e.promptEvidence}\n【2.0—3.0秒】主体1用右手把门推至门框，门闭合。\n【结束状态】门已关闭。`); save(f);
    assert.equal(f.run().validation, 'passed');
  });
}
