const FIELDS = ['人物', '场景/时间/光线', '景别/拍摄/运镜', '主体', '动作/表演', '位置承接', '台词/O.S./OS', '视效', '环境音/动作音', '转场'];
const NUMBERED_FORMAT = 'numbered_fields_v1';
const TIMING_EPSILON = 1e-6;

function shotsOf(prompt, segment = {}) {
  const numbered = [...prompt.matchAll(/^【镜头([1-9]\d*)】(?:（(\d+(?:\.\d+)?)秒）)?[ \t\r]*$/gm)];
  const headings = [...prompt.matchAll(/^【镜头[^\r\n]*/gm)];
  if (headings.length !== numbered.length) throw new Error('Invalid numbered shot heading; use 【镜头1】（6秒）.');
  const timed = [...prompt.matchAll(/【(\d+(?:\.\d+)?)—(\d+(?:\.\d+)?)秒】/g)];
  if (numbered.length && timed.length) throw new Error('Cannot mix numbered and timed shot headings.');
  const matches = numbered.length ? numbered : timed;
  if (numbered.length && (!Array.isArray(segment.shotTimings) || segment.shotTimings.length !== numbered.length)) throw new Error('Numbered shots require one config shotTimings entry per shot.');
  return matches.map((match, index) => {
    const timing = segment.shotTimings?.[index];
    if (numbered.length && (Number(match[1]) !== index + 1 || timing.shot !== index + 1 || !Number.isFinite(timing.startSeconds) || !Number.isFinite(timing.endSeconds))) throw new Error('Shot numbers/timing ledger must be contiguous and ordered.');
    const durationSeconds = numbered.length && match[2] !== undefined ? Number(match[2]) : undefined;
    if (durationSeconds !== undefined && (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || Math.abs(durationSeconds - (timing.endSeconds - timing.startSeconds)) > TIMING_EPSILON)) throw new Error('Shot heading duration must be positive and match shotTimings.');
    return {
      number: index + 1, numbered: numbered.length > 0,
      durationSeconds,
      start: numbered.length ? timing.startSeconds : Number(match[1]),
      end: numbered.length ? timing.endSeconds : Number(match[2]),
      index: match.index,
      body: prompt.slice(match.index + match[0].length, matches[index + 1]?.index ?? prompt.indexOf('【结束状态】')),
    };
  });
}

function validateTiming(shots, duration, context) {
  if (!shots.length || !Number.isFinite(duration) || duration <= 0) throw new Error(`${context}: invalid shot/segment duration.`);
  let end = 0;
  for (const shot of shots) {
    if (!Number.isFinite(shot.start) || !Number.isFinite(shot.end) || shot.start < 0 || shot.end <= shot.start || Math.abs(shot.start - end) > TIMING_EPSILON) throw new Error(`${context}: timed ranges must be contiguous, non-overlapping and start at 0.`);
    end = shot.end;
  }
  if (Math.abs(end - duration) > TIMING_EPSILON) throw new Error(`${context}: timed ranges must end at ${duration} seconds.`);
  if (shots.every(shot => shot.durationSeconds !== undefined)) {
    const total = shots.reduce((sum, shot) => sum + shot.durationSeconds, 0);
    if (!Number.isFinite(total) || Math.abs(total - duration) > TIMING_EPSILON) throw new Error(`${context}: shot heading durations must sum to ${duration} seconds.`);
  }
}

const FIELD_ALIASES = {
  '人物': ['人物', '角色'],
  '场景/时间/光线': ['场景/时间/光线', '场景/时间/光照', '环境基底'],
  '景别/拍摄/运镜': ['景别/拍摄/运镜', '景别/机位/运动视角', '景别/机位'],
  '主体': ['主体', '主体锁'],
  '动作/表演': ['动作/表演', '动作/内容', '动作'],
  '位置承接': ['位置承接', '位置关系'],
  '台词/O.S./OS': ['台词/O.S./OS', '台词', '对白', '台词/对白', '画外音', '台词（画外音）', '画外音（O.S.）', '画外音（OS）', '台词（O.S.）', '台词（OS）'],
  '视效': ['视效', '音效'],
  '环境音/动作音': ['环境音/动作音', '光影/色彩', '音效', '光影'],
  '转场': ['转场', '转场机位']
};

function matchFieldLabel(line) {
  const cleanLine = line.replace(/^【/, '').replace(/】/, '');
  for (const field of FIELDS) {
    const aliases = FIELD_ALIASES[field] || [field];
    for (const alias of aliases) {
      if (cleanLine.startsWith(`${alias}：`) || cleanLine.startsWith(`${alias}:`)) {
        return field;
      }
    }
  }
  return null;
}

function validateFields(shot, context) {
  const fields = new Map();
  let current;
  for (const rawLine of shot.body.trim().split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const label = matchFieldLabel(line);
    if (label) {
      if (fields.has(label) || label !== FIELDS[fields.size]) throw new Error(`${context}: duplicate or out-of-order field ${label}.`);
      const colonIndex = line.search(/[：:]/);
      fields.set(label, line.slice(colonIndex + 1).trim());
      current = label;
    } else {
      if (!current) throw new Error(`${context}: content before the first labeled field.`);
      fields.set(current, `${fields.get(current)}\n${line}`.trim());
    }
  }
  if (fields.size !== FIELDS.length) throw new Error(`${context}: each numbered shot requires exactly ten labeled fields.`);
  FIELDS.forEach((field) => {
    if (!fields.get(field)) throw new Error(`${context}: missing, empty or out-of-order field ${field}.`);
  });
  return fields;
}

function validateAction(action, context) {
  let labels = ['动作前状态：', '动作顺序：', '动作后状态：'];
  if (!labels.every((l) => action.includes(l))) {
    const bracketLabels = ['【前置状态】', '【动作顺序】', '【后置状态】'];
    if (bracketLabels.every((l) => action.includes(l))) {
      labels = bracketLabels;
    }
  }
  const positions = labels.map((label) => action.indexOf(label));
  if (positions.some((position, index) => position < 0 || (index > 0 && position <= positions[index - 1])) || labels.some((label) => action.split(label).length !== 2)) throw new Error(`${context}: action requires ordered pre-state, action and post-state fields.`);
  labels.forEach((label, index) => {
    const value = action.slice(positions[index] + label.length, positions[index + 1] ?? action.length).trim().replace(/[；。\s]+$/u, '');
    if (!value || /^(?:无|同上|保持|略|不适用|未指定)$/.test(value)) throw new Error(`${context}: action state/order must contain concrete execution, not an empty placeholder.`);
  });
}

function validateSubjects(prompt, assets, context) {
  // Spoken words and literal sign/location text are not asset-binding declarations.
  // Mask literal speech only within the dedicated dialogue field (or an explicit
  // legacy speech clause). Quoted actors in action/state fields remain bindings.
  let inDialogue = false;
  const prose = prompt.split('\n').map((line) => {
    const trimmed = line.trim();
    if (matchFieldLabel(trimmed) || /^【/.test(trimmed)) {
      inDialogue = matchFieldLabel(trimmed) === '台词/O.S./OS';
    }
    return inDialogue ? line.replace(/“[^”]*”|"[^"\n]*"/g, '') : line.replace(/((?:同步说|说|喊|问|答|OS|O\.S\.)\s*[：:]\s*)(?:“[^”]*”|"[^"\n]*")/g, '$1');
  }).join('\n');
  for (const match of prose.matchAll(/主体(\d+)/g)) {
    const number = Number(match[1]);
    if (String(number) !== match[1] || !assets[number - 1] || !['character', 'location', 'prop'].includes(assets[number - 1].assetType)) throw new Error(`${context}: undefined/nonvisual subject ${match[0]}.`);
  }
}

function validateSound(sound, profile, context) {
  if (profile.prompt.musicPolicy !== 'none') return;
  // Natural scene/action sounds remain allowed. Only explicit positive music
  // instructions conflict with a no-music lock; ambiguous prose still needs review.
  const withoutNegations = sound.replace(/(?:不要|不得|不应|不|禁止|关闭|无)(?:再|额外)?(?:添加|播放|使用|加入|出现|含有|含)?(?:任何|新增|额外|全程)?(?:背景音乐|音乐|配乐|BGM)/gi, '');
  if (/背景音乐|配乐|BGM|(?:播放|加入|添加|响起)[^。；\n]*音乐/i.test(withoutNegations)) throw new Error(`${context}: sound field conflicts with the locked no-background-music policy.`);
}

function physicalStates(prompt, shots, profile) {
  const startLabel = '【站位与起始状态】';
  const endLabel = '【结束状态】';
  const startIndex = prompt.indexOf(startLabel);
  const endIndex = prompt.indexOf(endLabel);
  if (startIndex < 0 || endIndex < 0 || !shots.length) throw new Error('Missing start/end physical state sections.');
  const start = prompt.slice(startIndex + startLabel.length, shots[0].index).trim();
  let end = prompt.slice(endIndex + endLabel.length).trim();
  const suffix = `${profile.prompt.endingPolicy}\n\n${profile.look.styleSuffix}`;
  if (end.endsWith(suffix)) end = end.slice(0, -suffix.length).trim();
  for (const [label, state] of [['start', start], ['end', end]]) {
    if (!state) throw new Error(`Empty ${label} physical state.`);
    const literalLabelsRemoved = state.replace(/(?:名叫|名为|标牌(?:写着|上写着)?|标识(?:为)?)[“"][^”"]*[”"]/g, '');
    if (/(?:画外声音|电话声音|内心声音|现场齐声|线上弹幕)[（(][^）)]+[）)]\s*(?:说|喊|显示)?\s*[：:]/.test(literalLabelsRemoved)) throw new Error(`${label} state contains dialogue/replay instructions.`);
    if (/同步说|台词\s*[：:]|对白\s*[：:]|(?:说|喊|问|答|念|吼|(?<!名)叫)(?:道|着)?\s*[：:]|(?:说|喊|问|答|念|吼)(?:道|着)?\s*[“"]|主体\d+\s*[：:]\s*[“"]|\b(?:OS|O\.S\.|VO)\s*[：:]|最后可见结果|最后动作落点|最后互动目标|最后明确(?:持物|位置)|除非|上述快照逐项保持|喊完|说完|随后|然后|重新(?:拿起|放下|喊|说)/.test(literalLabelsRemoved)) throw new Error(`${label} state contains dialogue/replay instructions or unresolved last-state placeholders.`);
  }
  // Compare only explicit physical fact lines. Line ordering and legacy wrappers
  // are not narrative events and must not force dialogue or action replay.
  const canonical = (value) => value.replace(/^(?:继承)?连续性快照：\s*/u, '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).sort().join('\n');
  return { start, end, startKey: canonical(start), endKey: canonical(end) };
}

module.exports = { FIELDS, NUMBERED_FORMAT, shotsOf, validateTiming, validateFields, validateAction, validateSubjects, validateSound, physicalStates };
