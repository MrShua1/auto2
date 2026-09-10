# TSC Prompt Compiler Module

Auto D clarification: the current Agent executes this module's semantic compilation
instructions directly. There is no separate TSC executable or external storyboard
generator to locate. Required input/approval gates below remain in force. Read
../../references/auto-d-portability-and-materials.md and carry every material-in-frame
binding into the corresponding subject, location, handoff and shot action.

For new/revised prompts, first read `../../references/numbered-shot-contract.md`.
Its numbered headings with per-shot seconds (e.g. `【镜头1】（6秒）`), ten shot fields and physical-only state inheritance override
the historical timed-heading/whole-snapshot examples in this module and snapshots.
Preserve the locked project shot-count and duration ranges; no Node migration or
expanded resource/audio scope is implied.
For new/revised prompts set prompt.requireShotDuration=true in the production profile.
Every heading's seconds must equal its shotTimings interval; their sum is the SEG
duration. Preserve source-locked timing and flag overload rather than changing text.

Apply the short no-added-subtitles instruction from numbered-shot-contract.md once
in the global scene section, unless explicit script/user overlay requirements take
precedence. Preserve audio and physical scene/prop text; do not repeat per shot or
retain contradictory unsolicited subtitle instructions in the visual-effects field.

Natural synchronized scene/action sound is permitted by the user's updated policy
in numbered-shot-contract.md. It does not require extra audio-reference slots.
Keep explicit background-music locks separate; no score does not forbid stream or
footstep sound. This overrides the older blanket ambience/foley prohibition below.

TSC is Auto's exclusive video-prompt compiler. Apply it after Auto has finalized
a generation segment and written its `tsc-handoff.yaml` from
`../../templates/tsc-handoff.yaml`.

## Ownership

Before compilation or repair, read `../../references/content-review-contract.md`.
Never use global alias substitution, a fixed speech speed, duration clamping or
placeholder reactions as a substitute for contextual interpretation. A separate
semantic reading must produce current hash-bound episode-level review evidence;
TSC production alone does not grant a passed review status.

TSC alone owns:

- the first-line `生成时长：N秒。` declaration from the handoff duration
- `{{Mixed N}}` subject and reference binding prose
- compact backend-neutral Chinese generation prompts with deterministic reference slots
- complete one-to-one causal action-phase encoding
- dialogue, character voice and explicitly authorized critical sound binding
- textual shot-execution action, camera and transition phases in the sequence
- the fixed role/resource/scene/start-state/timed-camera/end-state prompt format
- written ending-state inheritance for related adjacent Prompts
- final visual-treatment sentence
- deterministic project visual-style suffix as the final prompt constraint
- explicit pre-action state, causal action sequence and post-action state for every
  character, prop, wardrobe, posture, gaze, contact or appearance change

Auto may prepare facts, references, shot design and an optional backend capability
contract, but it must not
draft, repair, optimize or silently replace TSC's prompt prose. If this module
cannot compile, mark the prompt stage `BLOCKED`.

## Required Auto Handoff

Every segment handoff must include:

1. The complete mapped textual shot execution, exact dialogue, dramatic turn and
   endpoint. The source script remains available for fact checking, but its full
   text is not pasted into the finished prompt.
2. Story-derived duration and the selected backend/model's supported duration values
   when known. Backend-neutral handoffs use `capability_status: unbound` without
   becoming incomplete.
3. Character references for every recurring visible character.
4. Location references for every visible location.
5. Textual phases providing visual state, blocking, transitions and shot continuity.
6. Character voice references only when supplied by the user, explicitly requested,
   or required by the selected video backend. Dialogue text and speaker ownership stay
   explicit even when no external voice reference exists.
7. Environmental audio, sound effects or music only when supplied or explicitly
   requested by the user, or indispensable to plot, timing or transition.
8. Prop references when appearance or ownership is plot-critical.
9. Deterministic `{{Mixed N}}` assignments. Approved local files with verified role
   ownership are marked `package_slot_verified`; unresolved placeholders are marked
   `planned_unverified`. Neither status claims a LibTV node connection.
10. The fixed prompt fields: `【角色清单】`, `【资源引用】`, `【场景】`,
     `【站位与起始状态】`, the production profile's permitted number of continuous timed camera fields and
     `【结束状态】`.
11. For a related following Prompt, the previous Prompt's exact written ending
     state, the current opening blocking and whether the physical scene is the same.
     No video tail frame path or frame input is accepted.
12. When a scene contains a bed, platform, table, vehicle, stairs, doorway,
    balcony, water boundary or other named surface/boundary: a validated
    `spatial_topology_lock` with fixed landmarks, each character's level/anchor,
    permitted corridor, forbidden crossing/surface and a visible proof composition.
    Missing or ambiguous topology is a hard blocker, not a prompt-writing detail.
13. For every visible recurring character: a validated `wardrobe_visual_lock` that
    specifies observable silhouette/layers, color/material, hair or headwear and one
    checkable accessory/trim, plus the approved source reference. A role label alone
    is insufficient. Any wardrobe change requires an explicit script-authorized state
    transition.
14. For every visible recurring character: a validated `character_visual_lock` bound
    to exactly one approved character reference. It must contain narrative role,
    gender presentation, face/build, hair/headwear, wardrobe and a unique accessory
    or trim. Cross-character transfer is forbidden: location and prop references
    may not modify it, and one character may not inherit another's face,
    hair, garment, color, sleeve shape, accessory or rank marker.
    When an approved reference is the only appearance authority, accept a
    `reference_preservation` lock that freezes all those categories against that exact
    `{{Mixed N}}` without inventing a pixel-derived description.
15. The minimum visual reference set: one approved reference per visible recurring
    character, one location reference and only plot-critical props.

Asset images constrain only identity, wardrobe, location and prop appearance.
`storyboard-execution.txt` supplies composition, blocking, transitions and temporal
continuity as text compiled into the final prompt.

For any approved left-one/right-two character composite, read
`../../references/character-asset-standard.md`, section `TSC Reference Instruction`.
In each new or explicitly revised `prompt.txt`, write its reference-use instruction
once per applicable Mixed slot in `【资源引用】`, with the actual matching subject
number. Explicitly map left to face, right top to front wardrobe and right bottom
to rear hair/wardrobe, all belonging to the same character. Tell the video model
not to inherit panels, repeated figures, head/neck cropping or display poses;
the shot execution controls actual character count, composition and action.
A handoff-only note does not satisfy this requirement. Do not add slots, apply the
instruction to single-view references or silently migrate old delivered prompts.

## Missing References

For Auto production, a missing visible-character reference is a hard blocker for
final TSC compilation. A speaking-character voice reference is optional unless the
user explicitly requires it or the selected backend contract requires it. An
audio-reference audit timeout does not block an authorized video run; record the timeout
and omit that external voice node from the run. A missing location,
prop or other sound reference is a blocker only when it is explicitly required
by the user, already declared in the approved plan, or indispensable to the story.
Record required missing references in the handoff,
`auto-state.json` and `release-report.md`. TSC may still compile a clearly labeled
planning draft with deterministic `{{Mixed N}}` placeholders, as allowed by its
source rules, but the mapping must remain `planned_unverified`. Do not replace a
missing sound file with text such as "参考某种音色" and do not claim that a planned
token is a verified LibTV connection.

An explicit user decision may mark a reference category `not_applicable`, for
example `character_voice` in a segment with no dialogue. This is different from
`missing`.

Do not create optional environment-audio, room-tone, reverb, foley, sound-effect
or music placeholders. Do not mention those sounds in prompt prose when the user
did not supply or request them. A story-critical exception must state its concrete
narrative purpose in the handoff.

## Output

Each delivered segment contains exactly the six entries defined in
`../../templates/package-layout.md`. TSC writes prompt prose only to `prompt.txt`.
Draft/final status belongs in the handoff and episode state, not in the creative
prompt or an extra segment file. Keep model settings and the handoff outside the
creative prompt. After compilation, validate against
`../../references/quality-gates.md` without rewriting TSC prose.

The user-required first-line duration declaration is part of TSC prompt prose. It must
match `duration.proposed_seconds`. A backend-neutral final prompt may keep this
story-derived value unbound. Before a runnable backend-specific prompt is used, the
same value must be supported by the selected backend/model capability contract.

## Fixed Prompt Contract

TSC output must use this exact order after the duration line:

```text
【角色清单】
【资源引用】
【场景】
【站位与起始状态】
【0.0—X.X秒】
【X.X—N.N秒】
【结束状态】
```

Separate the duration, every named section, the timed-shot block, the ending state
and the final style suffix with blank lines exactly as in the approved example.
Do not collapse headings and prose onto one line.

### Subject Naming Contract

- In `【角色清单】`, introduce every visual asset in ascending Mixed order with
  `把 {{Mixed N}} 中...作为主体N`. The number is immutable: `Mixed N` always maps
  to `主体N`; audio references do not become visual subjects.
- The subject description states observable identity, hair/headwear and wardrobe for
  a person; architecture, light and materials for a location; or appearance, material
  and scale for a prop. A bare name is not a valid definition.
- After `【角色清单】`, address all people, locations and props only as `主体N`.
  Do not emit character names, `CHAR###`, `角色锁` or a parallel alias. Character
  names are allowed only in voice-ownership text and inside verbatim quoted dialogue.
- Bind a voice as `{{Mixed A}} 仅作为主体N（{{Mixed N}}）姓名音色`.
- Use `主体锁：主体1、主体2；各主体仅保留自身主体锁，不交换外观。` in every
  timed field, listing only the visible subjects. An unbound incidental person uses a
  functional label such as `未命名宫人` and never borrows a numbered appearance.
- End the operational prompt with the exact locked
  `productionProfile.prompt.endingPolicy` immediately before the final visual-style
  suffix. It must prohibit video tail-frame continuity; its music clause follows the
  project sound plan.

Use the minimum sufficient timed camera fields within the production profile's
`timedPhaseMinimum` and `timedPhaseMaximum`. Each field contains,
in order, characters, physical scene/time/light, scale/camera/move, subject,
action/performance, position handoff, dialogue/O.S./OS, VFX, environment/action
sound and transition. Time ranges start at `0.0`, end at the declared duration, and
cannot overlap or leave gaps.

When the next field continues the same long take, state that it continues from the
previous field's written ending state. When the next Prompt is related to the prior
Prompt in the same physical scene, copy the prior Prompt's written ending state into
the next Prompt's `【站位与起始状态】`. Do not use a video tail frame, extracted
 undeclared media as continuity input.

The ending state is not a narrative summary. Append one stable `连续性快照：...`
record containing scene/light, fixed anchors, each visible subject lock, position, level,
posture, facing, eyeline, left hand, right hand, held objects, contacts, relevant prop
positions, visible appearance state and unfinished action. A directly continuing
Prompt must begin with `继承连续性快照：...` and copy everything after the marker
verbatim. Compilation fails when either snapshot is incomplete or the strings differ.

`C###`, `SHOT###`, `镜头###` and `clipId` are internal audit identifiers. They may
remain in handoffs, manifests and audit files, but must not appear in delivered
video prompt prose. Use the timed range alone as the phase heading.

## State-Change Compilation

Every action that changes a visible state must be written in this order:

```text
动作前状态：affected subject and complete relevant condition；
动作顺序：first dependent step -> next dependent step -> visible result；
动作后状态：resulting pose, gaze, hands, contact, prop ownership and appearance.
```

The compiler must make unchanged starting conditions explicit when they matter to
logic. For example, a nail-painting action begins with `主体1十指甲面自然无色，
未接触染膏，主体2手中的细笔尚未碰到甲面`, then shows taking the brush, dipping it,
contacting the nail and applying color. It must not begin with painted nails or
describe application as an instantaneous result. Apply the same rule to removing,
revealing, picking up, putting down, entering, sitting, standing, touching and
withdrawing.

For localized painting, staining, injury, wetting or other appearance changes, identify
one exact target and list the unchanged non-target set in every affected phase. For
nails, name the hand and digit. Example: `唯一目标甲为主体1左手食指甲；只有笔尖直接
接触的左手食指甲可由自然无色变为薄层蔻丹；左手拇指、中指、无名指、小指及右手
五指共九枚甲面从动作前到动作后始终自然无色，不得提前、同时或连带变红。`

## Spatial Topology Compilation

When `spatial_topology_lock.required` is true, compile the lock verbatim into
`【场景】`, `【站位与起始状态】`, every timed phase that contains movement, and
`【结束状态】`. Name the physical plane and corridor, not only the destination.
The prompt must state both the allowed relation and the prohibited shortcut.

For example: `床垫是高于地面的固定承重面；女主始终坐在床垫中央。男主起于床尾
地面，双脚始终落在地面，沿床右侧地面通道走近床沿；不上床、不跨过床垫、不从床面
方向进入。镜头同时看见床面和男主脚下的地面通道。`

Do not compile a movement phase if its start/end anchors can be read as two different
levels without a named route. If the model cannot show the required boundary and the
movement in the same phase, split the action into an establishing/verification phase
and a shorter approach phase. A topology violation is not repairable by the final
visual-style suffix.

## Wardrobe Compilation

When a character is visible, copy that character's exact `wardrobe_visual_lock`
verbatim into `【站位与起始状态】`, every timed phase where they remain visible, and
`【结束状态】`. Place the lock beside that character's physical action, not as a
generic end-of-prompt sentence. The character reference owns face, hair and wardrobe;
location and prop references may only control their declared roles and
must not alter the lock.

Use concise, image-checkable language. For example, attach this description to
`主体1`: `始终穿珊瑚粉交领寝衣，
外罩半透暖白披帛，乌发低髻配一枚白玉簪，右袖口有同色细绣边；服装、发髻、玉簪
全程不变。` Do not substitute `寝殿私服` for this sentence. When the script
authorizes a change, state the old lock, the causal costume-change action, the new
lock and the phase where the change completes; otherwise any new garment, hair style,
color, accessory or rank marker fails compilation.

## Character Visual Compilation

Compile each visible character's full `character_visual_lock` in `【角色清单】` as
the numbered subject bound to its exact `{{Mixed N}}` input. Every timed phase and
`【结束状态】` must use that same subject name, for example
`主体锁：主体1、主体2；各主体仅保留自身主体锁，不交换外观。` Use one separate full
clause per person in the role list, never a merged cast description or `CHAR###` alias.
When source text contains concrete appearance facts, compile those facts directly.
Otherwise, for an approved reference, compile a reference-preservation clause such as:
`主体1严格保持{{Mixed 1}}中已由人工批准的人物外观；脸型体态、发型头饰、服装廓形层次、颜色材质、袖型及独有配饰均以该参考为唯一依据，全程不增删、不混合、不转移给其他主体。`
This clause is valid without image inspection and must be generated by Auto rather
than requested as bulk user-authored text.
The short lock repeat is mandatory; repeating the complete clothing paragraph in every
phase is prohibited because it dilutes action and spatial instructions.

The approved character reference is the only reference that can supply face, gender
presentation, hair/headwear and wardrobe. A location reference supplies only set
geometry/material; a prop reference supplies only prop appearance. If a phase would
omit a visible character's lock, has more than one plausible lock owner, or gives one
garment/hair description to an unnamed group, block compilation.

## Visual Style Suffix

Append the locked project LOOK suffix to every compiled prompt after the ending-state
handoff. Auto has no default suffix. The suffix must use observable production
language rather than relying on a named title, studio or creator.

This is a high-level emotional and visual constraint only. Never let the suffix override script, identity, wardrobe,
blocking, geography, chronology or physical state.
