# Numbered Shots And Physical Continuity

This is the current user-approved presentation/state contract. It supersedes older
timed-heading and whole-snapshot-copy instructions for new or explicitly revised
prompts. Use productionProfile.prompt.shotFormat = numbered_fields_v1. Existing
persisted projects without this field retain their old parser until explicitly
revised; do not silently reapprove or rewrite them.

## Unchanged Requirements

Keep the project's existing shot-count bounds and segment-duration bounds. Do not
force 4-6 shots or 15 seconds. Wild Tiger retains its 15-30 second segment range.
Preserve the existing Mixed/subject references, minimum necessary assets, role-list
definitions, offscreen handling, approved files, fixed episode/SEG directories,
Excel deliverables and no-video lock. Do not introduce named Node syntax or list
every merely mentioned resource. Source dialogue remains verbatim in its own shot.

## Shot Presentation

For new/revised prompts, unless the user or authoritative script explicitly requires
screen overlays, append this sentence once within the existing global `【场景】`
section: `不加字幕或叠加文字，旁白对白不转写；保留场景与物料原有文字。`
Do not repeat it per shot or append it after the locked final LOOK suffix. Keep all
spoken dialogue/audio and physical sign, poster, document and screen text intact.
Do not add conflicting caption/title/keyword-overlay requests to `视效：`; when
there are no effects, use `视效：无。`. If the user explicitly requests no subtitles
for a script that contains them, keep the source verbatim in audit files and record
the authorized omission in execution/handoff; never silently delete source text.
Explicitly required overlays take precedence over this default: scope exclusions to
unrequested overlays instead of including a contradictory blanket ban. Disable a
backend's automatic captions only when its verified controls support that setting;
never invent an API flag or claim prompts guarantee subtitle-free output. Do not
silently migrate existing delivered prompts.

Use `【镜头1】（8秒）`, `【镜头2】（10秒）`, ... consecutively numbered
from 1 within each segment. The suffix is this shot's own duration, not an end
timestamp. Positive decimal seconds are allowed. Do not add an internal SHOT ID.
Keep the first-line `生成时长：N秒。` declaration and exactly ten fields per shot.
For new or explicitly revised prompts set productionProfile.prompt.requireShotDuration
to true. Persisted profiles without this flag may still read their old bare headings;
do not silently rewrite or reapprove delivered projects.

Each shot uses exactly these ten nonempty labeled fields in order. A field may
contain multiple lines (including multiple speakers); ten fields does not mean ten
physical lines. Each label occurs once at the start of its field.

```text
【镜头1】（8秒）
人物：本镜实际参与人物，以已有主体编号表示。
场景/时间/光线：本镜发生的场景、时间与光线。
景别/拍摄/运镜：明确景别、拍摄角度及摄影机行为。
主体：主体锁：本镜适用的编号主体锁；各主体仅保留自身主体锁，不交换外观。
动作/表演：动作前状态：具体必要前态；动作顺序：具体有序动作；动作后状态：具体结果。不重复全套静态约束。
位置承接：承接本段起始状态或上一镜的具体位置、朝向与接触变化。
台词/O.S./OS：实际说话主体、同步/画外/内心声归属及逐字台词；没有则写“无”。
视效：仅剧情要求的效果；没有则写“无”。
环境音/动作音：与当前画面和动作一致的自然声音，如溪流声、脚步声；没有则写“无新增”。
转场：到下一镜的具体衔接方式；连续拍摄则明确连续承接。
```

Do not paste this instructional template as actual prompt content. Substitute the
segment's concrete facts. The ten fields may be short; their existence is not a
reason to invent visual effects, actions or participants. Natural scene/action
sounds are user-authorized: stream sound at a stream, footsteps during walking,
and other plausible synchronized physical sound may be described without adding
external audio reference slots. Background score is a separate decision: preserve
the project's explicit music lock; musicPolicy=none forbids score, not natural
sound. Do not add offscreen events or plot-changing sounds to justify ambience.
Preserve supplied or genuinely story-critical sound references and their existing
requirements. This paragraph supersedes older blanket bans on natural ambience.

When the project stateChangeContract is explicit_pre_action_ordered_action_post_action,
the action field must contain the three ordered, nonempty labels shown above.
Do not replace an authored action with '无' or remove the previous contract merely
because headings are now numbered. An explicitly observational stateChangeContract
of none remains valid; do not force invented actions into a static observation.
Every unquoted 主体N in prompt prose must resolve to a bound visual asset, including
those in action, state and dialogue-speaker clauses. Quoted literal speech/sign text
is preserved and is not an asset declaration.

Timing is both visible after each heading and retained as executable audit data.
Each config segment must have one shotTimings row per shot, for example:

```json
"shotTimings": [
  { "shot": 1, "startSeconds": 0, "endSeconds": 8 },
  { "shot": 2, "startSeconds": 8, "endSeconds": 18 }
]
```

This is an example, not a new shot-count or duration default. Derive actual budgets
from dialogue and action. Ranges are ordered, positive, contiguous from zero to
durationSeconds, and match the storyboard, handoff and content-review event budgets.
Each displayed duration equals endSeconds minus startSeconds for that shot, and
all displayed durations sum to the first-line SEG duration. Never allocate uniform
durations by default. Prompt and content-review validators share a 0.000001-second
absolute tolerance solely for floating-point arithmetic, including the total check.
Do not use that tolerance as a planned gap, overlap or rounding allowance.
Existing user-locked timings remain unchanged; flag speech or
action overload for review instead of shortening the source or secretly extending it.
Never hide overloaded dialogue by dropping timing data or truncating duration.

## Physical States Only

Opening and ending sections record current physical facts, not narrative history.
For each relevant visible subject, give the actual position/support surface/anchor,
posture, orientation, gaze when relevant, separate hand occupancy, held objects and
contact. Record relevant prop/door/window/crowd state and genuinely unfinished action.
Use concrete values from source and established staging. Do not invent a distance,
clear a hand by default or import incidental appearance from an image.

Never include spoken words, quoted dialogue, sync-speech commands, O.S./OS dialogue,
completed gestures or summaries of completed performance in these state sections.
Dialogue delivered at the previous segment's end stays in that previous shot only.
A sustained chin/head/body position may remain as a physical fact; the completed
shout itself must not be restated. If speech truly crosses a segment boundary, put
only the remaining authorized verbatim words in the next shot's dialogue field,
with the split recorded in the source/dialogue ledger, never in the opening state.

Reject placeholders such as '最后动作落点', '最后互动目标', '最后明确持物状态',
'最后可见结果', '上述快照逐项保持' and '无，除非…'. Write an explicit unfinished
action or '无'. Do not add a redundant '动作前状态：上述快照逐项保持' paragraph.
Global appearance-preservation, geography and no-tail-frame rules belong in their
existing contract sections; do not duplicate those paragraphs in the opening state.

For direct continuation, author the previous ending as a compact list of physical
fact lines, then inherit those same facts into the next opening. State comparison
ignores line order and optional legacy snapshot prefixes, but not physical values.
Do not copy arbitrary previous ending prose, dialogue or stage directions. Do not
claim that the next video can infer omitted facts by reading an unavailable previous
prompt. If source authorizes a scene/time/state discontinuity, document the transition
and use the existing non-continuation mechanism, not a fabricated matching snapshot.

The independent reader still checks source fidelity, true physical continuity,
ownership, action feasibility and whether each ten-field shot actually enacts the
source. Mechanical parsing does not certify natural-language correctness.
