const test = require('node:test');
const assert = require('node:assert/strict');
const { shotsOf, physicalStates, validateFields, FIELDS } = require('./lib/shot-format.cjs');
const { validatePrompt } = require('./validate-video-prompts.cjs');
const { resolveProductionProfile } = require('./lib/production-profile.cjs');

function fixture() {
  const profile = {
    schemaVersion: 'auto-production-profile/1.0', profileId: 'numbered-test', contentCategory: 'narrative', genres: ['drama'], visualMedium: 'live_action', audience: 'general', tone: ['quiet'],
    look: { styleSuffix: '自然光，写实摄影。' },
    prompt: { language: 'zh-CN', shotFormat: 'numbered_fields_v1', timedPhaseMinimum: 2, timedPhaseMaximum: 4, stateChangeContract: 'explicit_pre_action_ordered_action_post_action', continuityMode: 'written_ending_state_only', musicPolicy: 'none', endingPolicy: '仅记录文字状态，不上传或引用视频尾帧。全程无背景音乐。' },
  };
  const segment = { id: 'SEG001', durationSeconds: 18, sameSceneAsPrevious: false, shotTimings: [{ shot: 1, startSeconds: 0, endSeconds: 7 }, { shot: 2, startSeconds: 7, endSeconds: 18 }], assets: [{ mixedToken: '{{Mixed 1}}', assetType: 'character', characterName: '张北', promptAliases: ['张北'] }] };
  const state = '主体1站在岸边石块右侧，面向溪流，下巴略抬，左手空，右手握鱼竿。\n未完成动作：无。';
  const shot = (number) => `【镜头${number}】\n` + [
    '人物：主体1。', '场景/时间/光线：溪流岸边，白天，树隙自然光。', '景别/拍摄/运镜：中景，平视，固定机位。',
    '主体：主体锁：主体1自身参考外观；各主体仅保留自身主体锁，不交换外观。',
    '动作/表演：动作前状态：主体1右手握竿，竿梢低垂；动作顺序：主体1轻提竿梢后停住；动作后状态：竿线绷紧，右手仍握竿。',
    '位置承接：双脚留在岸边石块右侧，身体仍面向溪流。',
    '台词/O.S./OS：无。', '视效：无。', '环境音/动作音：无新增。', '转场：保持岸边位置连续承接。',
  ].join('\n');
  const prompt = `生成时长：18秒。\n\n【角色清单】\n把 {{Mixed 1}} 中的人物作为主体1；\n\n【资源引用】\n{{Mixed 1}}限定主体1外观。\n\n【场景】\n溪流岸边，白天。\n\n【站位与起始状态】\n${state}\n\n${shot(1)}\n\n${shot(2)}\n\n【结束状态】\n${state}\n\n${profile.prompt.endingPolicy}\n\n${profile.look.styleSuffix}`;
  const config = { schemaVersion: 'auto-episode-package/2.3', productionProfile: profile, promptCharacterAliases: [{ characterName: '张北', promptAliases: ['张北'] }], segments: [segment] };
  return { profile, segment, prompt, config, state, run: (text = prompt) => validatePrompt(config, resolveProductionProfile(config), segment, text) };
}

test('numbered headings pass with existing 2-4 count and 18-second duration', () => { const f = fixture(); assert.equal(f.run().timedRanges, 2); });
test('new templates require visible shot seconds', () => {
  assert.equal(require('../templates/production-profile.json').prompt.requireShotDuration, true);
  assert.equal(require('../templates/episode-segment-package.json').productionProfile.prompt.requireShotDuration, true);
});
function withDurations(f) {
  f.profile.prompt.requireShotDuration = true;
  return f.prompt.replace('【镜头1】', '【镜头1】（7秒）').replace('【镜头2】', '【镜头2】（11秒）');
}
test('visible unequal durations pass and remain outside ten fields', () => { const f = fixture(); assert.equal(f.run(withDurations(f)).timedRanges, 2); });
test('required heading duration cannot be missing', () => { const f = fixture(); assert.throws(() => f.run(withDurations(f).replace('（11秒）', '')), /must include its duration/); });
test('each duration must match ledger even when their sum matches', () => { const f = fixture(); assert.throws(() => f.run(withDurations(f).replace('（7秒）', '（8秒）').replace('（11秒）', '（10秒）')), /match shotTimings/); });
test('zero, negative, invalid and infinite heading durations fail', () => {
  for (const value of ['0', '-1', 'NaN', 'Infinity', '9'.repeat(400)]) {
    const f = fixture(); assert.throws(() => f.run(withDurations(f).replace('（7秒）', `（${value}秒）`)), /heading/);
  }
});
test('fractional seconds agree with the ledger', () => {
  const f = fixture(); const prompt = withDurations(f).replace('（7秒）', '（7.5秒）').replace('（11秒）', '（10.5秒）');
  f.segment.shotTimings[0].endSeconds = 7.5; f.segment.shotTimings[1].startSeconds = 7.5;
  assert.equal(f.run(prompt).timedRanges, 2);
});
test('duration headings still require timing ledger', () => { const f = fixture(); const prompt = withDurations(f); delete f.segment.shotTimings; assert.throws(() => f.run(prompt), /shotTimings/); });
test('displayed durations cannot bypass segment total', () => { const f = fixture(); const prompt = withDurations(f).replace('（11秒）', '（10秒）'); f.segment.shotTimings[1].endSeconds = 17; assert.throws(() => f.run(prompt), /end at 18/); });
test('duration flags must be boolean', () => { const f = fixture(); f.profile.prompt.requireShotDuration = 'true'; assert.throws(() => f.run(), /requireShotDuration/); });
test('sub-centisecond gaps and overlaps cannot bypass duration totals', () => {
  for (const delta of [0.009, -0.009, 0.00001]) {
    const f = fixture(); const prompt = withDurations(f).replace('（11秒）', `（${11 - delta}秒）`);
    f.segment.shotTimings[1].startSeconds = 7 + delta;
    assert.throws(() => f.run(prompt), /contiguous/);
  }
});
test('sub-centisecond total mismatch fails even on a contiguous ledger', () => {
  const f = fixture(); const prompt = withDurations(f).replace('（11秒）', '（10.991秒）');
  f.segment.shotTimings[1].endSeconds = 17.991;
  assert.throws(() => f.run(prompt), /end at 18/);
});
test('accumulated heading rounding cannot bypass the total check', () => {
  const f = fixture(); const prompt = withDurations(f).replace('（7秒）', '（7.0000006秒）').replace('（11秒）', '（11.0000006秒）');
  assert.throws(() => f.run(prompt), /must sum to 18/);
});
test('ordinary binary floating-point noise remains valid', () => {
  const f = fixture(); const prompt = withDurations(f).replace('（7秒）', '（0.3秒）').replace('（11秒）', '（17.7秒）');
  f.segment.shotTimings[0].endSeconds = 0.1 + 0.2;
  f.segment.shotTimings[1].startSeconds = 0.3;
  assert.equal(f.run(prompt).timedRanges, 2);
});
test('all ten fields including empty-effect/no-new-sound decisions are present', () => { const f = fixture(); for (const shot of shotsOf(f.prompt, f.segment)) validateFields(shot, 'test'); assert.equal(FIELDS.length, 10); });
test('missing mandatory field fails', () => { const f = fixture(); assert.throws(() => f.run(f.prompt.replace('视效：无。\n', '')), /ten labeled fields|out-of-order field/); });
test('empty field fails', () => { const f = fixture(); assert.throws(() => f.run(f.prompt.replace('视效：无。', '视效：')), /empty or out-of-order/); });
test('combined time/shot heading is rejected', () => { const f = fixture(); assert.throws(() => f.run(f.prompt.replace('【镜头1】', '【0.0—7.0秒｜镜头1】'))); });
test('shot numbering must start at one and be contiguous', () => { const f = fixture(); assert.throws(() => f.run(f.prompt.replace('【镜头2】', '【镜头3】')), /contiguous and ordered/); });
test('timing ledger is required even though headings contain no times', () => { const f = fixture(); delete f.segment.shotTimings; assert.throws(() => f.run(), /shotTimings/); });
test('timing gaps fail', () => { const f = fixture(); f.segment.shotTimings[1].startSeconds = 8; assert.throws(() => f.run(), /contiguous/); });
test('timing must end at configured duration', () => { const f = fixture(); f.segment.shotTimings[1].endSeconds = 17; assert.throws(() => f.run(), /end at 18/); });
test('previous dialogue in opening state fails', () => { const f = fixture(); assert.throws(() => f.run(f.prompt.replace(f.state, `${f.state}\n同步说：“老白，都两个小时了！”`)), /dialogue\/replay/); });
test('spoken dialogue in ending state fails', () => { const f = fixture(); assert.throws(() => f.run(f.prompt.replace('【结束状态】', '【结束状态】\n主体1喊：“老白！”')), /dialogue\/replay/); });
test('vague last-state placeholder fails', () => { const f = fixture(); assert.throws(() => f.run(f.prompt.replace(f.state, '主体1位于最后动作落点。')), /placeholders/); });
test('dialogue in its actual shot is allowed', () => { const f = fixture(); assert.equal(f.run(f.prompt.replace('台词/O.S./OS：无。', '台词/O.S./OS：主体1同步说：“老白，都两个小时了！”')).timedRanges, 2); });
test('physical continuity ignores line order, not physical values', () => { const f = fixture(); const a = physicalStates(f.prompt, shotsOf(f.prompt, f.segment), f.profile); const reversed = f.state.split('\n').reverse().join('\n'); const changed = f.prompt.replace(f.state, reversed); const b = physicalStates(changed, shotsOf(changed, f.segment), f.profile); assert.equal(a.endKey, b.startKey); const moved = f.prompt.replace(f.state, f.state.replace('右侧', '左侧')); assert.notEqual(a.endKey, physicalStates(moved, shotsOf(moved, f.segment), f.profile).startKey); });
test('old persisted profiles keep timed heading format', () => { const f = fixture(); delete f.config.productionProfile.prompt.shotFormat; assert.equal(resolveProductionProfile(f.config).prompt.shotFormat, 'timed_legacy'); });
test('spoken fictional subject label does not create an asset reference', () => { const f = fixture(); assert.equal(f.run(f.prompt.replace('台词/O.S./OS：无。', '台词/O.S./OS：主体1说：“老王是隔壁村的张三。”')).timedRanges, 2); });
test('spoken dialogue with subject placeholder tokens fails Rule 0.12', () => { const f = fixture(); assert.throws(() => f.run(f.prompt.replace('台词/O.S./OS：无。', '台词/O.S./OS：主体1说：“主体99是文件里的编号。”')), /Rule 0.12/); });
test('cross-medium static double exposure fails Rule 0.13', () => { const f = fixture(); assert.throws(() => f.run(f.prompt.replace('溪流岸边，白天，树隙自然光。', '海滩沙地，白天，可清晰透视海底暗流礁石。')), /Rule 0.13/); });
test('gaze penetration with physical splash disturbance fails Rule 0.13', () => { const f = fixture(); assert.throws(() => f.run(f.prompt.replace('景别/拍摄/运镜：中景，平视，固定机位。', '景别/拍摄/运镜：第一人称主观视角，顺着视线向前俯冲。').replace('动作/表演：动作前状态：主体1右手握竿，竿梢低垂；动作顺序：主体1轻提竿梢后停住；动作后状态：竿线绷紧，右手仍握竿。', '动作/表演：动作前状态：视线俯瞰海面；动作顺序：镜头跟随视线前推切入海面，伴随浪花与气泡向两侧划开散去，显露海底暗流；动作后状态：水下广阔海底呈现。')), /Rule 0.13.*gaze penetration/); });
test('empty action fails under existing state-change contract', () => { const f = fixture(); assert.throws(() => f.run(f.prompt.replace(/动作\/表演：[^\n]+/, '动作/表演：无。')), /action requires/); });
test('empty action marker values also fail', () => { const f = fixture(); assert.throws(() => f.run(f.prompt.replace(/动作\/表演：[^\n]+/, '动作/表演：动作前状态：无；动作顺序：无；动作后状态：无。')), /concrete execution/); });
test('unchanged observational profile does not acquire mandatory action markers', () => { const f = fixture(); f.profile.prompt.stateChangeContract = 'none'; assert.equal(f.run(f.prompt.replace(/动作\/表演：[^\n]+/, '动作/表演：固定机位观察岸边的竿梢。')).timedRanges, 2); });
test('natural environment/action sound allowed with no music', () => { const f = fixture(); assert.equal(f.run(f.prompt.replace('环境音/动作音：无新增。', '环境音/动作音：溪流声，人物沿岸行走时响起脚步声；无背景音乐。')).timedRanges, 2); });
test('explicit background score conflicts with no-music lock', () => { const f = fixture(); assert.throws(() => f.run(f.prompt.replace('环境音/动作音：无新增。', '环境音/动作音：播放激昂背景音乐，保留溪流声。')), /no-background-music/); });
test('source/user-defined music policy may explicitly allow music', () => { const f = fixture(); f.profile.prompt.musicPolicy = 'source_and_user_defined'; f.profile.prompt.endingPolicy = '仅记录文字状态，不上传或引用视频尾帧。音乐按项目授权执行。'; const prompt = f.prompt.replace('仅记录文字状态，不上传或引用视频尾帧。全程无背景音乐。', f.profile.prompt.endingPolicy).replace('环境音/动作音：无新增。', '环境音/动作音：播放已授权背景音乐。'); assert.equal(f.run(prompt).timedRanges, 2); });
test('named landmark in physical state is not speech', () => { const f = fixture(); assert.equal(f.run(f.prompt.replace(f.state, '主体1站在名叫“回声亭”的建筑外，右手持鱼竿，左手空闲。\n未完成动作：无。')).timedRanges, 2); });
test('speaker-colon quote in physical state fails', () => { const f = fixture(); assert.throws(() => f.run(f.prompt.replace(f.state, `${f.state}\n主体1：“老白，都两个小时了！”`)), /dialogue\/replay/); });
test('completed performance sequence in physical state fails', () => { const f = fixture(); assert.throws(() => f.run(f.prompt.replace(f.state, `${f.state}\n主体1高声喊完，随后放下鱼竿又重新拿起。`)), /dialogue\/replay/); });
test('multiline dialogue is one field, not an eleventh field', () => { const f = fixture(); assert.equal(f.run(f.prompt.replace('台词/O.S./OS：无。', '台词/O.S./OS：主体1说：“第一句。”\n主体1停顿后说：“第二句。”')).timedRanges, 2); });
test('duplicate field is not accepted as continuation', () => { const f = fixture(); assert.throws(() => f.run(f.prompt.replace('视效：无。', '视效：无。\n视效：无。')), /duplicate/); });
test('full negative music instruction permits natural stream sound', () => { const f = fixture(); assert.equal(f.run(f.prompt.replace('环境音/动作音：无新增。', '环境音/动作音：不要添加任何背景音乐，仅保留溪流声。')).timedRanges, 2); });
test('quoted actual actor cannot bypass binding', () => { const f = fixture(); assert.throws(() => f.run(f.prompt.replace('主体1轻提', '“主体99”轻提')), /undefined\/nonvisual/); });
test('unquoted shouted dialogue is forbidden in physical state', () => { const f = fixture(); assert.throws(() => f.run(f.prompt.replace(f.state, `${f.state}\n主体1高声呼喊：老白，该给我上点鱼了！`)), /dialogue\/replay/); });
test('CLI validates consecutive physical-state inheritance without repeated dialogue', () => {
  const fs = require('fs'); const path = require('path'); const os = require('os'); const { spawnSync } = require('child_process');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opencode', 'numbered-cli-'));
  try {
    const f = fixture();
    f.segment.promptSource = 'first.txt';
    const second = { ...f.segment, id: 'SEG002', sameSceneAsPrevious: true, promptSource: 'second.txt' };
    f.config.segments.push(second);
    fs.writeFileSync(path.join(root, 'first.txt'), f.prompt);
    fs.writeFileSync(path.join(root, 'second.txt'), f.prompt);
    fs.writeFileSync(path.join(root, 'episode-package-config.json'), JSON.stringify(f.config));
    const run = () => spawnSync(process.execPath, [path.join(__dirname, 'validate-video-prompts.cjs'), '--project-root', root], { encoding: 'utf8' });
    const passed = run(); assert.equal(passed.status, 0, passed.stderr);
    assert.equal(JSON.parse(passed.stdout).inheritedContinuityChecks, 1);
    fs.writeFileSync(path.join(root, 'second.txt'), f.prompt.replace(f.state, f.state.replace('右侧', '左侧')));
    assert.notEqual(run().status, 0);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('unmotivated subjective POV without gaze trigger fails Rule 0.14', () => {
  const f = fixture();
  const shot1 = f.prompt.slice(0, f.prompt.indexOf('【镜头2】'));
  const shot2 = f.prompt.slice(f.prompt.indexOf('【镜头2】'));
  const modifiedShot2 = shot2
    .replace('景别/拍摄/运镜：中景，平视，固定机位。', '景别/拍摄/运镜：第一人称主观视角POV，大俯角下倾。')
    .replace('动作/表演：动作前状态：主体1右手握竿，竿梢低垂；动作顺序：主体1轻提竿梢后停住；动作后状态：竿线绷紧，右手仍握竿。', '动作/表演：动作前状态：镜头俯瞰水面；动作顺序：镜头向前推移下倾；动作后状态：镜头固定在水面。');
  const modified = shot1 + modifiedShot2;
  assert.throws(() => f.run(modified), /Rule 0.14.*unmotivated subjective POV/);
});

test('subjective POV motivated by prior gaze trigger passes Rule 0.14', () => {
  const f = fixture();
  const shot1 = f.prompt.slice(0, f.prompt.indexOf('【镜头2】'));
  const shot2 = f.prompt.slice(f.prompt.indexOf('【镜头2】'));
  const modifiedShot1 = shot1.replace('动作后状态：竿线绷紧，右手仍握竿。', '动作后状态：主体1猛然转头望向前方水面，双眸凝视。');
  const modifiedShot2 = shot2
    .replace('景别/拍摄/运镜：中景，平视，固定机位。', '景别/拍摄/运镜：第一人称主观视角POV，大俯角下倾。')
    .replace('动作/表演：动作前状态：主体1右手握竿，竿梢低垂；动作顺序：主体1轻提竿梢后停住；动作后状态：竿线绷紧，右手仍握竿。', '动作/表演：动作前状态：主观视线承接主体1目光；动作顺序：视线焦点推近观察水下动向；动作后状态：视线焦点锁定游鱼。');
  const modified = modifiedShot1 + modifiedShot2;
  assert.equal(f.run(modified).timedRanges, 2);
});

test('hallucinated terrain or elevation drift fails Rule 0.15', () => {
  const f = fixture();
  const modified = f.prompt.replace('位置承接：双脚留在岸边石块右侧，身体仍面向溪流。', '位置承接：海滩最高礁石沙坎处，主体1迎风挺立。');
  assert.throws(() => f.run(modified), /Rule 0.15.*hallucinated spatial terrain/);
});

test('shot with character missing facing direction in 位置承接 fails Rule 0.16', () => {
  const f = fixture();
  const modified = f.prompt.replace('位置承接：双脚留在岸边石块右侧，身体仍面向溪流。', '位置承接：双脚留在岸边石块右侧。');
  assert.throws(() => f.run(modified), /Rule 0.16.*facing\/body orientation/);
});

test('shot with character specifying facing direction passes Rule 0.16', () => {
  const f = fixture();
  assert.equal(f.run().timedRanges, 2);
});


