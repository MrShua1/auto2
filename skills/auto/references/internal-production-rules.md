# Internal Production Rules

These rules are owned by the Auto Skill and are the only creative-production
rules used during an Auto task. Do not load, read or invoke any Skill outside
the Auto directory.

## Story And Scope

- Auto has no default genre, period, culture, audience, visual medium, camera grammar
  or visual-style suffix. Before shot planning, instantiate and lock the project's
  `productionProfile` from `templates/production-profile.json`. Derive it from the
  source and user constraints, never from a previous project or bundled example.
- The profile LOOK must be observable: medium, camera, light, color, texture and
  realism. Named works or creators may inform analysis but are not sufficient as the
  final production description.

- Preserve every in-scope source-script paragraph, exact dialogue, scene order and
  explicit user lock. A summary never substitutes for source text.
- Treat every in-scope script paragraph as causal backbone. There is no secondary,
  decorative, redundant or safely removable script content.
- Retain every non-empty source paragraph exactly and in source order. Scene headings,
  cast lines, actions, reactions, transitions, inserts and story-relevant sound cues
  count as script content.
- Divide the source only at natural boundaries into contiguous, non-overlapping
  passages. Ordered segment passages must reconstruct the full source exactly.
- Map every source line to a scene and one or more shots. Verify 100 percent coverage
  before images, prompts or video generation.
- If runtime is too short for all source content, split or revise runtime. Never
  compress by deleting dialogue, actions, reactions, transitions or endpoints.
- Establish one episode boundary, target duration and aspect ratio before shots.
- Assign stable IDs to recurring characters, wardrobes, locations, props, looks,
  scenes, clips and image tasks.
- Record assumptions when the source does not label episode boundaries.

## Blocking And Coverage

- One clip has one narrative purpose, one dominant action chain and one primary
  camera behavior.
- Define start state, visible action threshold and observable endpoint.
- Establish character positions, entrances, exits, screen direction, eye lines,
  action axis, prop ownership and handoff to the next clip before choosing lenses.
- For every scene with a bed, platform, table, vehicle, stairs, doorway, balcony,
  water boundary or other named surface/boundary, create a `spatial_topology_lock`
  before storyboarding or prompt compilation. It must name: fixed landmarks and
  their functional surfaces; each character's start/end anchor and level; permitted
  movement corridors; barriers or forbidden surfaces; and the camera side that makes
  the relationship legible. Do not replace this with relative prose such as
  `nearby`, `approaches`, or `beside the bed`.
- A load-bearing or elevated surface is non-traversable unless the script explicitly
  says a character mounts, crosses, sits or lies on it. A character stated as on a
  bed remains on the mattress; a character stated as under/beside the bed remains on
  the floor plane and may approach only through the declared floor corridor. The
  model must never place the floor-plane character on, across, or emerging from the
  bed surface merely to shorten the action.
- Write this lock as a testable relation, not an interpretation. Example:
  `床沿为固定边界；女主全程在床垫中央；男主起于床尾地面，沿床右侧地面通道走到床边；男主双脚始终接触地面，不上床、不跨越床垫、不从床面方向出现；镜头保持床面与地面通道同时可见。`
- If a requested camera angle hides a required topology relation, add an establishing
  or verification shot before the action. A clip with an uncheckable topology lock
  is incomplete and cannot enter paid generation.
- Every shot must add spatial information, story information, performance,
  causality or transition value. Remove decorative duplicates.
- A shot plan is incomplete when any assigned source line is absent, even if its
  narrative summary appears correct.
- Vary shot scale and angle for editorial reasons while preserving the 180-degree
  line unless a deliberate rupture is recorded.
- Compile every state-changing action as `动作前状态 -> 按顺序执行的动作 -> 动作后状态`.
  The pre-action state must name the affected character or prop and every relevant
  visible condition, including clothing, posture, gaze, hand occupancy, contact,
  held-object ownership, surface appearance and location.
- For appearance changes, explicitly state the unchanged state before the change.
  Examples: `涂色前十指甲面为自然无色`; `解开白绸前颜色被完全遮挡`; `放下茶盏前茶盏仍在右手`.
- A later state must never be implied by a verb alone. If an action has multiple
  dependent steps, preserve each threshold in order: approach, pick up, contact,
  perform, release or reveal, then record the visible result.
- For a localized appearance change, designate one exact target by side and body-part
  name before contact. Freeze every non-target counterpart through every phase. Nail
  painting must identify one hand and digit; only that nail may change after direct
  brush contact. All other nine nails keep their prior color with no simultaneous,
  anticipatory or propagated color change.

## Identity And Continuity

- Identity references control face, hair, age and build.
- Written wardrobe and approved wardrobe references control clothing.
- For every visible recurring character, create one `character_visual_lock` before
  storyboarding. It is the highest-priority per-character contract and must include:
  stable character ID and narrative role; gender presentation; face/build anchors;
  exact hair style and headwear; the `wardrobe_visual_lock`; and one character-unique
  accessory or trim. This is one indivisible assignment. Never distribute its fields
  across a generic cast list, location reference or storyboard reference.
- Build the lock autonomously from available textual evidence: screenplay, character
  bible, wardrobe table, asset manifest and the generation prompt attached to an
  approved generated image. This is production compilation, not a human form-filling
  stage.
- If an approved character/wardrobe image has no textual appearance description, do
  not inspect its pixels and do not invent colors or facial details. Use a
  `reference_preservation` lock bound to that exact reference: preserve its face/build,
  hair/headwear, garment silhouette/layers, color/material, sleeve shape and unique
  accessory/trim unchanged, with no additions, omissions, blending or transfer. This
  satisfies the lock contract without pretending the Agent observed the image.
- Never pause merely to ask the user to write observable settings for every approved
  character or wardrobe version. Ask only when a required version has neither an
  approved reference nor sufficient textual evidence; handle that as the existing
  missing-asset decision, not a second bulk visual-lock review.
- Each `character_visual_lock` is bound to exactly one approved character reference.
  No other character may inherit any part of that lock. In particular, do not exchange,
  blend or borrow robes, colors, sleeve shapes, hair styles, hair ornaments, rank
  markers, facial traits or gender presentation between characters. `男女主互换服装`,
  `角色继承另一人的发型`, or a role-inconsistent appearance is a hard failure, not an
  acceptable variation.
- For every visible recurring character, create a `wardrobe_visual_lock` before
  storyboarding. It is one compact, repeatable, observable sentence containing the
  garment silhouette/layers, dominant color and material, hair or headwear, and one
  checkable accessory or trim. Role names such as `寝殿私服`, `常服`, `宫装` or
  `黑金服装` are labels, not locks, and do not pass.
  A reference-preservation lock is also valid when the exact approved image is the sole
  wardrobe authority; it must name the frozen appearance categories and prohibit
  additions, omissions and cross-character transfer.
- The approved character reference is the sole authority for identity, hair and
  wardrobe. Location, prop and storyboard references may constrain only their stated
  roles. A storyboard/composition reference must never introduce a different robe,
  color, hair arrangement, accessory, sleeve shape or rank marker.
- Repeat each visible character's exact `wardrobe_visual_lock` verbatim in the
  segment opening state, every timed phase where the character is visible, and the
  ending state. A cross-segment handoff copies the same lock unchanged unless the
  script explicitly depicts a costume change. Never rely on a single resource-binding
  sentence to carry wardrobe continuity through a long video generation.
- A costume change is a state-changing action: write the old lock, causal change,
  new lock and the exact transition point. Without that script-authorized transition,
  any wardrobe, hair or accessory change is a generation blocker.
- Write every visible character's full `character_visual_lock` once in the role list
  as the numbered subject bound to its visual input: `{{Mixed N}}` is always
  `主体N`. Every timed phase and ending state then repeats the applicable subject
  lock names plus `各主体仅保留自身主体锁，不交换外观`. Do not use `CHAR###`,
  character names or a parallel short-lock naming system after the role list;
  names remain only in voice ownership and verbatim quoted dialogue.
  This preserves per-phase accountability without flooding a long prompt with a second
  full wardrobe paragraph. For two or more visible characters, a phase may never use
  a generic shared appearance clause.
- Use the minimum visual reference set for a video segment: one approved reference per
  visible recurring character, one location reference, and only plot-critical props.
  Do not add alternative character sheets or duplicate visual references merely
  because the model accepts more inputs. When two lead characters
  share a frame, their two approved character references must be separately named and
  adjacent to their corresponding role-indexed locks.
- Location references control architecture and geography, not incidental people,
  text, framing or display layout.
- Prop references control object identity, material and scale.
- Story state outranks incidental content in every reference image.
- Asset images constrain identity, wardrobe, location and prop appearance only. They
  do not define the first frame, event order or missing action.
- When an image conflicts with source script or textual shot state, source script
  wins; regenerate or ignore the conflicting image detail.
- Never inherit white backgrounds, labels, multi-view character sheets or display
  poses from references into story frames. The required character asset layout in
  `character-asset-standard.md` is reference packaging, not a story-frame layout.

## Asset Contracts

Build the complete script-derived asset version universe before generation. Every
visible character has a stable entity ID; each wardrobe or visible character state is
a distinct version. Each location time/lighting state and prop state is also a distinct
version. Existing files are candidates against that universe, never authorities for it.

Auto never inspects or judges image content. An existing candidate passes only when the
user explicitly confirmed that exact file and its recorded hash is unchanged. All
other candidates remain pending human review. Preserve every approved file byte-for-byte
and generate only missing or human-rejected versions to new paths.

For newly generated character assets, also use `character-asset-standard.md`.
Only these exceptions apply to the list below: item 1 uses one frozen character
state across three reference panels instead of one narrative instant/visual center;
item 4 uses neutral display poses instead of an action threshold/consequence;
item 8 permits the required three-panel layout and preserves required original
garment text. All other requirements remain mandatory, including per-view camera
choices, identity/wardrobe roles, light/depth, material/realism, risk exclusions,
output aspect ratio and no added labels or watermarks.

Every newly generated canonical asset prompt must contain, subject only to the
character-specific exceptions above:

1. One frozen narrative instant and one visual center.
2. Shot scale, angle, camera height, lens and composition.
3. Named character count, position, identity and wardrobe roles.
4. One physical action threshold and visible consequence.
5. Motivated physical light and one depth mechanism.
6. Concrete material and realism targets.
7. Risk-specific exclusions for identity, anatomy, props and architecture.
8. Output aspect ratio and an explicit ban on text, watermarks and grids.

Generate independent asset candidates before video prompt compilation. Metadata and
file existence do not constitute visual approval.

## Asset Candidate Count

- An asset candidate is a newly generated canonical character identity, distinct
  wardrobe state, location or prop reference.
- If the user does not specify a candidate count, generate exactly three base
  candidates for every canonical asset that actually requires image generation.
- A user-specified count is exact and overrides the default. Record whether the
  effective count came from `default` or `user_explicit` in project state.
- Name the base candidate jobs `<ASSET-ID>-V1`, `<ASSET-ID>-V2`, `<ASSET-ID>-V3`
  for the default case, extending the same ordered `-V#` convention for an
  explicit count.
- All variants share the same written canon, role and exclusions. Candidate-level
  pose, view or composition may differ only when declared in the finalized asset
  contracts; never change identity, wardrobe state, architecture or prop design
  merely to make variants look different.
- The three base candidates must be separately generated alternatives, not three
  filesystem copies or byte-identical outputs of one returned image.
- Do not regenerate or triple an existing supplied asset that is suitable for its
  declared role. Generate candidates only for missing or explicitly requested
  assets and states.
- Present every successful candidate for human selection. File existence,
  mechanical validation and deterministic manifest order do not constitute asset
  approval.

## Review Boundary

- Before human review, check only whether each expected generated output file exists.
- Do not automatically rank, approve or reject visual quality.
- Deliver every image and every I2V prompt together before video generation.

## Prompt Fidelity

Every segment package must contain its full assigned source text in
`script-verbatim.txt` and its full mapped execution in `storyboard-execution.txt`.
The executable storyboard and `prompt.txt` must enact every source line one-to-one
and in order, preserving exact dialogue, but `prompt.txt` must not paste the full
source passage as unused context or repeat source wording after its compiled action.
No source content may be shortened, merged or treated as detail. A coverage report
must show exact full-source reconstruction and no missing, duplicated, merged,
reordered or summary-only content.

## Cross-Segment Snapshot Contract

- End every segment with the final plot beat followed by one complete continuity
  snapshot. The snapshot records scene, time/light, fixed anchors, every visible
  character's role lock, position, physical level, posture, facing, eyeline, left hand,
  right hand, held objects, contact, all relevant prop positions, visible appearance
  state and unfinished action.
- If the next segment begins as a direct continuation, its opening must repeat the
  prior snapshot payload verbatim before any new action. Keep any stable snapshot ID
  in audit metadata only; do not emit it in `prompt.txt`.
  Generic phrases such as `继承上一段状态`, `仍在原位` or `保持一致` do not pass.
- The next action begins from that copied snapshot. It may change only fields caused
  by an explicitly ordered action; all unmentioned fields remain frozen.
