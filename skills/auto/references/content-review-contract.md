# Content Review Contract

For `numbered_fields_v1`, also apply `numbered-shot-contract.md`. Event phase numbers
refer to numbered shots; time budgets come from config segment.shotTimings. Review
the actual dialogue field, not quoted speech in a start/end snapshot. The latter is
forbidden. These presentation changes do not prove semantic correctness or remove
the independent full-source reading requirement below.

This gate supplements, never replaces, the existing script, asset, wardrobe,
topology, audio, duration, package-layout and authorization contracts. It applies
to final delivery and revalidation of all supported package versions. Old files
are not silently rewritten or reapproved: missing evidence means NEED_FIX until
reviewed. Draft planning remains available without this review.

## Root Causes To Prevent

- Source reconstruction proves preservation, not enactment in timed prompt prose.
- Literal marker/subject-number checks do not establish identity or causal meaning.
- A producer writing semanticReview=passed is not independent semantic review.
- A successful old report says nothing about subsequently changed files.
- Word substitution and punctuation splitting are not a semantic TSC compiler.

## Compilation Rules

Keep the source immutable, including malformed punctuation. Interpret each source
event in context; record any repaired display punctuation separately with exact
source evidence. Do not let an unclosed bracket swallow following dialogue. Split
long dialogue at semantic/punctuation boundaries outside protected quoted text;
preserve every spoken character and its speaker in order. Multiple events may map
to one source line; split sentences may share that line's exact sourceText.

Titles, scene headings, cast tables and global production directions are preserved
and mapped to their applicable context, but consume no performance time. Explicit
on-screen titles, identity/location captions, numeric displays, online comments,
flashbacks and scene transitions are story events and require their actual execution.
Do not substitute generic instructions to show necessary information or react.

Resolve each entity before writing prose. Protect names embedded in unrelated words,
place names and quoted text; never replace all registered names globally. For example,
the character name Lao Bai is not the liquor name Lao Bai Gan. Disambiguate roles
against the scene and exact asset evidence. An unresolved named speaker is BLOCKED,
not an invented offscreen voice. Distinguish sync, offscreen, inner voice/voiceover,
phone, onsite group speech and online comments using source/context, not a keyword
such as audience alone. An onsite audience does not become a livestream chat.

Bind only references required by that segment's visible state/action or authorized
audio. Re-evaluate entrances/exits and prop ownership at every phase. Mentioning a
character does not establish visibility. Do not retain every asset seen earlier in
the scene indefinitely. Where local numbering changes, explicitly rebind/review the
handoff; never silently assign an old subject number to a different identity.

Estimate performance time for each event, including delivery, pauses, reactions,
transitions and dependent actions. Record speech units, rate and pauses with an
event-specific rationale; use measured readings when available. Do not hardcode a
universal fast speech rate, seconds-per-character formula or four-second phase floor.
Do not clamp an overloaded duration to a legal maximum. Split at a natural beat or
replan; never delete content, accelerate delivery just to pass, or pad with generic
reactions to meet a minimum. Concurrent events require concrete feasibility evidence.
Keep every explicit user duration bound even for an unselected backend. Do not impose
15-30 seconds on projects that never requested it. Live compatibility is a separate
gate before authorized backend execution.

TSC authors and repairs prompt prose as a semantic Agent operation. Helpers may
extract, organize, hash, test and package data, but regex templates cannot substitute
for source interpretation or certify creative correctness.

## Evidence Format

Auto 1.8.4 source syntax: colon-form speaker lines start dialogue; subsequent
unmarked lines (including intervening blank lines) continue the same utterance.
A new speaker, a recognized heading/directive, or an explicit action/text/sound/
transition boundary ends it. Use the original source's `△` action boundary;
`字幕：` / `弹幕：` / `屏幕文字：`, `音效：` / `环境音：` / `声音：`, and
`转场：` / `切至` / `淡入` / `淡出` identify non-dialogue source events.
Unmarked narrative outside an active utterance is action. Mixed/ambiguous source
syntax needs an explicitly reviewed parser adaptation before delivery; do not edit
the authoritative source to satisfy this grammar or guess that a continuation is
action. Events must match these independently derived source types.

Numbered dialogue fields contain only explicit quoted speaker clauses or `无。`;
put staging/direction in the action field. Unparsed remaining dialogue instructions
block instead of disappearing. Quoted performance in other fields is also rejected.
Legacy prose retains tested speech-clause detection but is not a free-form language
parser. `O.S.` / `OS` means offscreen speech; `VO` / `内心` means voiceover.
Prefer the explicit Chinese delivery clauses below when project OS notation differs.

The current validator independently extracts colon-form source dialogue (including
speaker performance parentheses and OS/VO suffixes) and compares it with the handoff.
Do not reclassify dialogue/action as metadata. Metadata is limited to recognized
headings/cast/context declarations; global rules use explicit production-rule labels.
An unfamiliar screenplay syntax must be resolved before finalization, not silently
normalized or omitted. Original source bytes remain immutable.

For actual performance, synchronous dialogue uses `主体N同步说：“逐字台词”`.
Nonvisual voices/groups use explicit ownership, e.g. `画外声音（原文说话人）说：“…”`,
`电话声音（原文说话人）说：“…”`, `内心声音（原文说话人）说：“…”`,
`现场齐声（原文说话人）说：“…”` or `线上弹幕（原文账号）显示：“…”`.
These are voice/text ownership clauses, not new visual subjects. Never convert
onsite speech to online text or invent a character image merely for an offscreen
voice. Every delivery decision must retain its source/context evidence.
Actual prompt utterances are checked in shot order and against exact speaker,
delivery and text; fragments must reconstruct the source in order. Action evidence
must be actual action text, not a bare subject label or appearance-preservation lock.

After prompt production, perform a separate source-to-prompt semantic reading of
EVERY segment (not a sample and not the producer's cached interpretation). This is
an Agent responsibility, not a new human data-entry or image-review requirement.
Write one episode-level `content-review.json`; do not add files to SEG folders.
The schema is `auto-content-review/1.0`:

- `status`: passed only after all issues are resolved; otherwise NEED_FIX.
- `configSha256`, `scriptSha256`: SHA-256 of current raw config and source bytes.
- `reviewer`: id, method=independent_semantic_read, reviewedAt ISO timestamp.
- `issues`: actual unresolved issues; an empty array is required for delivery.
- `segments`: exactly one ordered entry per configured segment, with id and hashes
  keyed by promptSource, scriptVerbatimSource, storyboardExecutionSource,
  tscHandoffSource. Hash the current artifact bytes, not a normalized summary.
- Each segment has `checks`: sourceInterpretation, dialogueOwnership,
  timingAndDensity, referenceRelevance, continuityAndTopology, userLocks. Each has
  status and source-specific evidence describing the actual check/result.
- Each segment has `events`, in source/performance order. Each event has lineStart,
  lineEnd (1-based segment source lines), exact sourceText, kind and interpretation.
  Kinds: metadata, global_directive, action, dialogue, screen_text, transition, sound.
- Metadata/directives use null phase/startSeconds/endSeconds and an appliedTo
  explanation. All other events use a 1-based phase, exact promptEvidence substring
  within that phase, startSeconds, endSeconds, requiredSeconds, timingBasis and a
  subjects array of visual Mixed numbers (empty when legitimately nonvisual).
- Overlapping events each need an overlapReason. Every timed phase must contain a
  substantive event. The reviewer must check that evidence is action/performance,
  not merely a subject lock or a restatement of a production instruction.
- Dialogue adds exact speaker and spokenText, delivery (sync/offscreen/voiceover/
  phone/onsite_group/online_comment), speechUnits, unitsPerSecond and pauseSeconds.
  Sync adds speakerSubject bound to the exact registered character name/alias.
  Offscreen/voiceover/phone/onsite_group adds deliveryEvidence from source/context.
  The reviewer must check completeness/order against the source and handoff, not
  simply search for isolated dialogue strings anywhere in the prompt.

Run `node scripts/validate-content-review.cjs --project-root <root>` before
packaging. The official packager copies this review into the episode root and
refuses to replace formal output when the gate fails. The final validator verifies
the review again and checks the packaged copy. Changing any config, source, prompt,
storyboard or handoff invalidates the evidence and requires another reading.

The validator checks evidence integrity, coverage, timing arithmetic and known
defect patterns; it is NOT a complete screenplay parser, a trusted reviewer identity
service or proof of semantic correctness. Never auto-fill evidence to pass it.
Report structural checks, semantic reading and remaining uncertainty separately.
Do not claim guaranteed zero-error model output. Known or newly found content
errors revoke completion claims immediately and block subsequent delivery/execution.

Preserve approved assets byte-for-byte, existing no-video authorization locks,
original source text, sound policy, profile and fixed six-entry SEG layout. Updating
this gate does not authorize regeneration, uploading, model selection or paid runs.
