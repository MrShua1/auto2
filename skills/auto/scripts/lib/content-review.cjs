const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { isDeepStrictEqual } = require('util');
const YAML = require('yaml');
const { shotsOf, validateTiming, physicalStates, validateFields, validateSubjects, NUMBERED_FORMAT } = require('./shot-format.cjs');
const { sourceEvents, isMetadata, performedDialogue } = require('./dialogue.cjs');

const REVIEW_FILE = 'content-review.json';
const CHECKS = ['sourceInterpretation', 'dialogueOwnership', 'timingAndDensity', 'referenceRelevance', 'continuityAndTopology', 'userLocks'];
const ARTIFACTS = ['promptSource', 'scriptVerbatimSource', 'storyboardExecutionSource', 'tscHandoffSource'];
const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const text = (file) => fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
function requireThat(value, message) { if (!value) throw new Error(`CONTENT_REVIEW: ${message}`); }
function meaningful(value) { return typeof value === 'string' && value.trim().length >= 8 && !/^(passed|complete|approved|required|pending)$/i.test(value.trim()); }

function isStandaloneAlias(prose, alias) {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Han text has no reliable regex word boundary. Embedded occurrences require
  // contextual review, not global rewriting of ordinary words and place names.
  return new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'u').test(prose) ||
    (/\p{Script=Han}/u.test(alias) && new RegExp(`${escaped}(?=推|拉|走|跑|转身|站|坐|抬|低头|看向|说|喊|握|拿|放下|伸手|点头|摇头)`, 'u').test(prose));
}

function validateDuration(config, state) {
  const minimum = config.segmentDurationMinimumSeconds;
  const maximum = config.segmentDurationMaximumSeconds;
  const bound = minimum !== undefined && minimum !== null;
  requireThat(bound === (maximum !== undefined && maximum !== null), 'Both duration bounds must be supplied together.');
  if (bound) requireThat(typeof minimum === 'number' && Number.isFinite(minimum) && minimum > 0 && typeof maximum === 'number' && Number.isFinite(maximum) && maximum >= minimum, 'Invalid duration bounds.');
  const locked = state?.project?.segmentDurationRangeSeconds;
  if (Array.isArray(locked) && locked.length) requireThat(bound && isDeepStrictEqual(locked, [minimum, maximum]), 'Config duration bounds differ from the recorded user/project lock.');
  for (const segment of config.segments || []) {
    requireThat(typeof segment.durationSeconds === 'number' && Number.isFinite(segment.durationSeconds) && segment.durationSeconds > 0, `${segment.id}: invalid duration.`);
    if (bound) requireThat(segment.durationSeconds >= minimum && segment.durationSeconds <= maximum, `${segment.id}: duration outside locked range.`);
  }
}

function phasesOf(prompt, segment) {
  return shotsOf(prompt, segment);
}

function validateKnownDefects(prompt, id, segment) {
  // Quoted dialogue and screen text are immutable, including unusual source punctuation.
  const prose = prompt.replace(/“[^”]*”|"[^"\n]*"/g, '');
  requireThat(!/对应人物主体|原文指定的画外人物|原文指定人物|当前说话主体|上一动作的明确结果落定|画面按原文呈现必要信息或转场|主体\d+主体\d+|△/.test(prose), `${id}: unresolved subject, raw-script marker or generic execution filler.`);
  const phases = phasesOf(prompt, segment);
  requireThat(phases.length > 0, `${id}: no timed execution.`);
  for (const phase of phases) {
    requireThat(!/执行(?:本集|场次)?元数据|人物表信息|全局制作规则/.test(phase.body), `${id}: production metadata occupies a timed phase.`);
  }
  return phases;
}

function validateContentReview({ root, configPath, config, state, formalRoot }) {
  validateDuration(config, state);
  const reviewPath = path.join(root, REVIEW_FILE);
  requireThat(fs.existsSync(reviewPath), `Missing ${REVIEW_FILE}; state.semanticReview flags are not evidence.`);
  const review = JSON.parse(text(reviewPath));
  requireThat(review.schemaVersion === 'auto-content-review/1.0' && review.status === 'passed', 'Review schema/status is invalid.');
  requireThat(review.configSha256 === hash(configPath), 'Review is stale relative to package config.');
  requireThat(review.scriptSha256 === hash(path.resolve(root, config.scriptSource)), 'Review is stale relative to authoritative episode source.');
  requireThat(review.reviewer?.method === 'independent_semantic_read' && meaningful(review.reviewer?.id) && Number.isFinite(Date.parse(review.reviewer?.reviewedAt)), 'A separate semantic reading with reviewer identity and timestamp is required.');
  requireThat(Array.isArray(review.issues) && review.issues.length === 0, 'Unresolved review issues block delivery.');
  requireThat(Array.isArray(review.segments) && review.segments.length === config.segments.length, 'Review must cover every configured segment exactly once.');
  const reconstructed = [];
  for (const [index, segment] of config.segments.entries()) {
    const row = review.segments[index];
    requireThat(row.id === segment.id, `${segment.id}: review order/ID mismatch.`);
    for (const key of ARTIFACTS) requireThat(row.hashes?.[key] === hash(path.resolve(root, segment[key])), `${segment.id}: stale ${key} review.`);
    for (const key of CHECKS) requireThat(row.checks?.[key]?.status === 'passed' && meaningful(row.checks[key].evidence), `${segment.id}: missing substantive ${key} review.`);
    const source = text(path.resolve(root, segment.scriptVerbatimSource));
    reconstructed.push(source);
    const lines = source.split('\n');
    const prompt = text(path.resolve(root, segment.promptSource));
    const phases = validateKnownDefects(prompt, segment.id, segment);
    if (config.productionProfile?.prompt?.requireShotDuration) requireThat(phases.every((phase) => phase.durationSeconds !== undefined), `${segment.id}: every shot heading must include its duration in seconds.`);
    validateSubjects(prompt, segment.assets || [], segment.id);
    validateTiming(phases, segment.durationSeconds, segment.id);
    const handoff = YAML.parse(text(path.resolve(root, segment.tscHandoffSource)));
    requireThat(Array.isArray(handoff.script?.exact_dialogue), `${segment.id}: handoff dialogue ledger missing.`);
    const { ledger: sourceLedger, kinds: sourceKinds } = sourceEvents(lines);
    requireThat(sourceLedger.length === handoff.script.exact_dialogue.length && sourceLedger.every((item, i) => item.speaker === handoff.script.exact_dialogue[i].speaker && item.text === handoff.script.exact_dialogue[i].text), `${segment.id}: source dialogue differs from handoff; a source utterance cannot be omitted or reclassified.`);
    if (config.productionProfile?.prompt?.shotFormat === NUMBERED_FORMAT) {
      const states = physicalStates(prompt, phases, config.productionProfile);
      for (const dialogue of handoff.script.exact_dialogue) {
        if (typeof dialogue.text === 'string' && dialogue.text.length > 1) requireThat(!states.start.includes(dialogue.text) && !states.end.includes(dialogue.text), `${segment.id}: verbatim dialogue must appear only in its shot, not physical states.`);
      }
    }
    requireThat(Array.isArray(row.events) && row.events.length > 0, `${segment.id}: no source-event ledger.`);
    const covered = new Set();
    const phaseEvents = phases.map(() => []);
    const dialogueEvents = [];
    let previousLine = 0;
    let previousStart = -1;
    for (const event of row.events) {
      requireThat(Number.isInteger(event.lineStart) && Number.isInteger(event.lineEnd) && event.lineStart >= 1 && event.lineEnd >= event.lineStart && event.lineEnd <= lines.length && event.lineStart >= previousLine, `${segment.id}: source event range/order invalid.`);
      previousLine = event.lineStart;
      requireThat(event.sourceText === lines.slice(event.lineStart - 1, event.lineEnd).join('\n'), `${segment.id}: event source text was rewritten.`);
      for (let line = event.lineStart; line <= event.lineEnd; line++) covered.add(line);
      requireThat(['metadata', 'global_directive', 'action', 'dialogue', 'screen_text', 'transition', 'sound'].includes(event.kind), `${segment.id}: unclassified source event.`);
      requireThat(sourceKinds.slice(event.lineStart - 1, event.lineEnd).every((kind) => !kind || kind === event.kind || (kind === 'metadata' && event.kind === 'global_directive')), `${segment.id}: event kind differs from source syntax; do not reclassify action/dialogue as another event type.`);
      requireThat(meaningful(event.interpretation), `${segment.id}: event needs a source-specific interpretation.`);
      if (['metadata', 'global_directive'].includes(event.kind)) {
        requireThat(event.sourceText.split('\n').every((line) => !line.trim() || isMetadata(line) || (event.kind === 'global_directive' && /^\s*(?:制作要求|全局规则|拍摄要求)[：:]/.test(line))), `${segment.id}: narrative source cannot be reclassified as metadata/directive.`);
        requireThat(event.phase === null && event.startSeconds === null && event.endSeconds === null, `${segment.id}: metadata must consume zero performance time.`);
        requireThat(meaningful(event.appliedTo), `${segment.id}: metadata/global rule has no application evidence.`);
        continue;
      }
      requireThat(Number.isInteger(event.phase) && event.phase >= 1 && event.phase <= phases.length, `${segment.id}: event lacks a timed phase.`);
      const phase = phases[event.phase - 1];
      requireThat(typeof event.promptEvidence === 'string' && event.promptEvidence.trim().length > 0 && phase.body.includes(event.promptEvidence), `${segment.id}: execution evidence is absent from its assigned phase.`);
      if (event.kind === 'action') {
        const evidence = event.promptEvidence.replace(/主体\d+/g, '').replace(/[\s；：。！？，、]/g, '');
        requireThat(evidence.length >= 4 && !/主体锁|参考外观|不交换外观/.test(event.promptEvidence), `${segment.id}: action evidence must enact movement/state, not an appearance lock or subject label.`);
        if (phase.numbered) requireThat(validateFields(phase, segment.id).get('动作/表演').includes(event.promptEvidence), `${segment.id}: action evidence is not in the action field.`);
      }
      requireThat(Number.isFinite(event.startSeconds) && Number.isFinite(event.endSeconds) && event.startSeconds >= phase.start && event.endSeconds <= phase.end && event.endSeconds > event.startSeconds && event.startSeconds >= previousStart, `${segment.id}: event timing is invalid or reordered.`);
      previousStart = event.startSeconds;
      requireThat(meaningful(event.timingBasis), `${segment.id}: missing event-specific performance timing rationale.`);
      requireThat(Number.isFinite(event.requiredSeconds) && event.requiredSeconds > 0 && event.requiredSeconds <= event.endSeconds - event.startSeconds + 0.01, `${segment.id}: required performance time exceeds its allocation.`);
      phaseEvents[event.phase - 1].push(event);
      requireThat(Array.isArray(event.subjects), `${segment.id}: missing subject binding list.`);
      for (const subject of event.subjects) {
        requireThat(Number.isInteger(subject) && subject >= 1 && subject <= (segment.assets || []).length && ['character', 'location', 'prop'].includes(segment.assets[subject - 1].assetType), `${segment.id}: undefined/nonvisual subject binding.`);
        requireThat(event.promptEvidence.includes(`主体${subject}`), `${segment.id}: subject not present in execution evidence.`);
      }
      if (event.kind === 'dialogue') {
        dialogueEvents.push(event);
        requireThat(typeof event.speaker === 'string' && event.speaker.trim() && typeof event.spokenText === 'string' && event.spokenText.length > 0 && event.sourceText.includes(event.spokenText), `${segment.id}: dialogue lacks verbatim text and exact speaker.`);
        requireThat(['sync', 'offscreen', 'voiceover', 'phone', 'onsite_group', 'online_comment'].includes(event.delivery), `${segment.id}: ambiguous dialogue delivery.`);
        requireThat(event.promptEvidence.includes(event.spokenText), `${segment.id}: dialogue omitted or rewritten in its phase.`);
        if (event.delivery === 'sync') {
          const speakerAsset = segment.assets[event.speakerSubject - 1];
          requireThat(event.subjects.includes(event.speakerSubject) && speakerAsset?.assetType === 'character', `${segment.id}: synchronous speaker has no character binding.`);
          requireThat([speakerAsset.characterName, ...(speakerAsset.promptAliases || [])].includes(event.speaker), `${segment.id}: speaker identity does not match the bound character.`);
        }
        if (['offscreen', 'voiceover', 'phone', 'onsite_group'].includes(event.delivery)) requireThat(meaningful(event.deliveryEvidence), `${segment.id}: non-sync voice/group delivery needs source/context evidence.`);
        if (event.delivery === 'online_comment') requireThat(!/现场观众|众人齐声/.test(event.speaker), `${segment.id}: on-site audience mislabeled as online comments.`);
        requireThat(Number.isFinite(event.speechUnits) && event.speechUnits > 0 && Number.isFinite(event.unitsPerSecond) && event.unitsPerSecond > 0 && Number.isFinite(event.pauseSeconds) && event.pauseSeconds >= 0, `${segment.id}: missing measured/estimated speech budget.`);
        requireThat(event.speechUnits / event.unitsPerSecond + event.pauseSeconds <= event.requiredSeconds + 0.01, `${segment.id}: dialogue cannot fit the reviewed speech budget.`);
      }
    }
    let dialogueIndex = 0;
    let spokenOffset = 0;
    for (const event of dialogueEvents) {
      const expected = handoff.script.exact_dialogue[dialogueIndex];
      requireThat(expected && event.speaker === expected.speaker && typeof expected.text === 'string' && expected.text.slice(spokenOffset, spokenOffset + event.spokenText.length) === event.spokenText, `${segment.id}: dialogue differs from the ordered handoff ledger.`);
      spokenOffset += event.spokenText.length;
      if (spokenOffset === expected.text.length) { dialogueIndex++; spokenOffset = 0; }
    }
    requireThat(dialogueIndex === handoff.script.exact_dialogue.length && spokenOffset === 0, `${segment.id}: handoff dialogue is missing from timed execution.`);
    for (const [phaseIndex, phase] of phases.entries()) {
      const fields = phase.numbered ? validateFields(phase, segment.id) : null;
      const actual = performedDialogue(fields ? fields.get('台词/O.S./OS') : phase.body, { strict: !!fields });
      if (fields) for (const [label, value] of fields) if (label !== '台词/O.S./OS') requireThat(performedDialogue(value).length === 0, `${segment.id}: spoken performance outside the dialogue field.`);
      const expected = dialogueEvents.filter((event) => event.phase === phaseIndex + 1);
      let actualIndex = 0; let offset = 0;
      for (const event of expected) {
        const utterance = actual[actualIndex];
        const subject = event.speakerSubject || event.subjects.find((number) => segment.assets[number - 1]?.characterName === event.speaker);
        const ownerMatches = utterance && (utterance.subject ? subject === utterance.subject : event.speaker === utterance.speaker && event.delivery !== 'sync');
        requireThat(ownerMatches && utterance.text.slice(offset, offset + event.spokenText.length) === event.spokenText, `${segment.id}: actual prompt dialogue speaker/order/text differs from reviewed source.`);
        requireThat(utterance.delivery === event.delivery, `${segment.id}: actual speech delivery differs from the source-reviewed policy.`);
        offset += event.spokenText.length;
        if (offset === utterance.text.length) { actualIndex++; offset = 0; }
      }
      requireThat(actualIndex === actual.length && offset === 0, `${segment.id}: unreviewed or repeated dialogue in actual prompt.`);
    }
    lines.forEach((line, lineIndex) => requireThat(!line.trim() || covered.has(lineIndex + 1), `${segment.id}: source line ${lineIndex + 1} has no interpretation/execution mapping.`));
    for (const events of phaseEvents) {
      requireThat(events.length > 0, `${segment.id}: empty/template-only timed phase.`);
      for (let left = 0; left < events.length; left++) for (let right = left + 1; right < events.length; right++) {
        const a = events[left]; const b = events[right];
        if (Math.min(a.endSeconds, b.endSeconds) > Math.max(a.startSeconds, b.startSeconds)) {
          requireThat(meaningful(a.overlapReason) && meaningful(b.overlapReason), `${segment.id}: concurrent actions/dialogue need explicit feasibility evidence.`);
        }
      }
    }
  }
  requireThat(reconstructed.join('\n') === text(path.resolve(root, config.scriptSource)), 'Segment source passages do not reconstruct the episode source.');
  if (formalRoot) requireThat(fs.existsSync(path.join(formalRoot, REVIEW_FILE)) && hash(path.join(formalRoot, REVIEW_FILE)) === hash(reviewPath), 'Formal delivery review is missing or differs from reviewed evidence.');
  return { schemaVersion: review.schemaVersion, segments: review.segments.length, reviewSha256: hash(reviewPath), validation: 'passed', scope: 'evidence_integrity_and_known_defects_not_a_zero_error_guarantee' };
}

module.exports = { validateContentReview, validateDuration, validateKnownDefects, isStandaloneAlias, phasesOf, REVIEW_FILE, CHECKS, ARTIFACTS };
