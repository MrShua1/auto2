---
name: gpt-10s-nine-grid-storyboard
description: "4-30秒分镜、自定义分镜画面数、九宫格分镜、人物参考图、场景参考图、storyboard、contact sheet、gpt-image-2分镜板。Use when turning one short clip and optional user-supplied character/location images into the minimum sufficient 1-9 continuous storyboard stills over a model-verified 4-30 second duration, optional adaptive contact sheets, and matching per-panel prompts. Supports Seedance 2.5 clips up to 30 seconds when the active endpoint confirms that limit. Use nine panels only when the clip truly requires nine distinct states. Do not use for unrelated concept images or direct video generation."
compatibility: "Agent Skills-compatible hosts; Chinese-first; image-model agnostic with adaptive contact-sheet layouts."
metadata:
  version: "2.3.0"
  updated: "2026-09-01"
  source_backup_sha256: "ab46095785e3fb84a03195af0c53816bb44b26028ba10d17c703d206e53774c7"
---

# Adaptive Clip Storyboard

Turn one compact clip into the minimum sufficient number of readable storyboard stills. The panel count is selected from the clip's visible state changes, not from duration or a fixed 3x3 layout. The supported clip duration is capability-driven: use 4-15 seconds as the portable default and allow up to 30 seconds only when the selected model endpoint, including Seedance 2.5, confirms that limit. This skill designs storyboard images and clean keyframes; it does not generate video.

The historical folder and skill name are retained so existing installations continue to discover it. Nine-grid behavior is now an explicit special case, not the default.

## Trigger Boundary

Use when the user asks for:

- A 4-30 second clip storyboard or keyframe plan whose duration fits the verified target-model limit
- 自定义分镜画面数、按剧情决定几格、不要强制九宫格
- 九宫格、六宫格、四宫格、三联画、首尾帧 or contact sheet
- A storyboard that preserves supplied character and location references
- Per-panel still prompts and an optional combined board

Do not use when the user asks for:

- Unrelated concept images
- A full-film shot list before clips are defined
- Direct video generation without a storyboard task
- A single final illustration with no temporal state change

For a full AI short, invoke this once per planned clip after the sequence and clip contract are known.

## Required Inputs

Resolve or label defaults for:

1. Clip ID, duration, and narrative job.
2. Target model/endpoint and its verified maximum duration. Default to 15 seconds when the capability is unknown; Seedance 2.5 may use up to 30 seconds only when the active endpoint confirms it.
3. Start state, primary visible action, and end state.
4. Visual style as observable production characteristics.
5. Character identity, wardrobe, props, location, period, weather, and light direction.
6. Optional user-requested panel count. If absent, select it with the allocation rules below.
7. Delivery mode: `individual` by default, `contact-sheet`, or `both`.
8. Board mode: `clean` by default or `labeled` when labels are essential.
9. Supplied references, each assigned one explicit role.
10. A per-panel wardrobe contract for every visible character, including off-face inserts and rear views.
11. A project LOOK lock or explicit observable style defaults for camera response, lens family, depth, motivated light, color, tonal density, texture and realism.


If the user requires references but the files cannot be identified unambiguously, stop image generation and resolve the mapping. Never substitute a guessed identity.

## Duration Capability Rule

- Portable default: 4-15 seconds.
- Extended mode: 16-30 seconds only when the target model's current schema or documented endpoint capability confirms it. Seedance 2.5 is eligible for this mode; do not infer the same limit for older Seedance versions or unrelated models.
- Record `target_model`, `declared_duration`, `verified_max_duration`, and the capability source in the output.
- Block delivery when the declared duration exceeds the verified maximum.
- A longer supported duration does not authorize more actions, camera moves, locations, or speakers inside one generation. Keep one primary narrative job and one dominant action chain.
- For 16-30 second clips, prefer temporal holds, performance development, atmosphere, or one continuous reveal. If the clip contains multiple independent action chains, location changes, incompatible camera moves, or more than nine indispensable visual states, split it into multiple video clips.
- When one 16-30 second continuous clip legitimately needs more than nine sampled states, keep it as one video clip but deliver multiple sequential boards, each with at most nine panels and explicit non-overlapping time ranges. Independent keyframes remain the I2V inputs; combined boards remain review artifacts.

## Minimum-Sufficient Panel Rule

Each panel must preserve a state that would otherwise be lost. Do not add cosmetic angle changes merely to fill a layout.

For narrative scenes, a panel may also preserve an editorial shot whose viewpoint would otherwise be lost: tactile/environment detail, spatial establish, character POV, performance/reaction, or meaningful afterimage. Do not reduce a multi-shot cinematic clip to setup/action/end from one angle. Conversely, do not add pretty inserts unless they establish space, approaching force, obstacle, time, causal object, transition, or character choice.

### Panel Count Algorithm

Start with the required states:

1. Add the start state when spatial setup or continuity handoff matters.
2. Add each distinct action threshold that changes position, ownership, pose, expression, information, or physical state.
3. Add a reaction only when it changes story meaning.
4. Add the end state when it must hand off to the next clip or differs materially from the action peak.
5. Merge adjacent states that remain legible in one frozen frame.
6. Remove any panel whose only job is a cosmetic angle variation.

Use these defaults:

| Clip type | Default panels | Required states |
|---|---:|---|
| Static atmosphere or held reaction | 1 | Hero/terminal state |
| Simple transition or start/end contrast | 2 | Start, end |
| One clear action | 3 | Setup, action peak, endpoint |
| Action plus meaningful reaction | 4 | Setup, action, reaction, endpoint |
| Blocking/contact/handoff | 5 | Spatial rule, approach, contact, reaction, separation |
| Complex movement or reveal | 6 | Setup plus 4 thresholds plus endpoint |
| High-risk multi-stage physics/performance | 7-9 | Only demonstrably distinct states |

Panel count constraints:

- Minimum 1, maximum 9.
- A user-requested exact count wins when every panel can have a distinct narrative job.
- If the requested count creates duplicates, recommend the lower count and explain the merge.
- Nine panels require nine distinct state changes. Duration alone never justifies nine panels.
- A single clip may have several panels without becoming several video shots; panels can be state samples from one future moving shot.
- A 16-30 second clip still uses the minimum sufficient states. Do not increase panel count merely because the model accepts a longer duration.
- If more than nine states are indispensable, decide explicitly between `split-clip` for multiple action chains and `multi-board-single-clip` for one continuous action chain.

### Complexity Score Fallback

When the count is still ambiguous, score one point for each condition:

- Spatial setup is essential.
- More than one actor changes position.
- A prop changes owner or state.
- A reaction changes the meaning of the action.
- Physics path or VFX progression must be verified.
- The end frame must hand off precisely to the next clip.
- Identity, hands, contact, occlusion, or screen direction is fragile.

Map total score to panels: `0-1 -> 1-2`, `2 -> 3`, `3 -> 4`, `4 -> 5`, `5 -> 6`, `6-7 -> 7-9`. Choose the lower number unless another state is genuinely necessary.

## Workflow

### 1. Restore The Clip

Write a one- or two-sentence summary containing the initial visible state, one primary action, the changed end state, and the clip's handoff requirement. Do not summarize the entire film.

### 2. Lock References And Continuity

Load `references/reference-image-workflow.md`. Create a reference manifest before panel design. Bind each image to identity, wardrobe, prop, location/layout, or visual style. Preserve the user's assigned identity at every panel in which that character appears; do not silently replace it with a generated look.

Before generating any character-bearing panel, compile a literal wardrobe contract. For each visible character state screen position, upper garment, lower garment, legwear, footwear, bag/accessories, and which source-reference clothing must be ignored. Written panel wardrobe and dedicated wardrobe/continuity references override incidental clothing in identity sheets. Never let a bright source hoodie, studio outfit, jeans, or another panel's costume leak into a scene merely because it appears in the identity reference.

For cropped body inserts, do not rely on character names alone. Enumerate the exact visible people and body parts, for example: `exactly two students, screen-left Akari skirt + two navy knee socks + two black loafers; screen-right Takaki charcoal trousers + two black socks + two black school shoes; exactly four feet total`. A face-free frame can still fail character and wardrobe continuity.

### 3. Select And Justify Panel Count

Apply the minimum-sufficient rule. Return:

```text
Selected panels: N
Reason: [the N distinct states]
Rejected extra panels: [merged/redundant states, if any]
```

### 4. Allocate Time Samples

- Total duration must equal the declared clip duration.
- Declared duration must not exceed the verified target-model maximum.
- Every panel receives a timestamp or interval.
- For one continuous future shot, treat panel times as sampled states rather than separate cuts.
- Use the action peak and terminal handoff as mandatory sample points when relevant.
- For multiple boards serving one continuous 16-30 second clip, board time ranges must be ordered, non-overlapping, and together cover the declared duration.

### 5. Write Per-Panel Prompts

Each row includes:

- Panel number and time sample/interval
- Narrative job
- Shot size and angle/POV
- Camera intent for the future moving shot
- Frozen visible action/state
- Sound/dialogue intent
- Reference assets actually required
- Per-character wardrobe contract and source-clothing exclusions
- Standalone still-image prompt

Every still prompt describes exactly one frozen instant. Do not ask an image model to depict a time sequence inside one panel.

When the user requests prestige-TV, Hollywood, Netflix-like, HBO-like,
DP-inspired, named-show, or LOOK-transfer treatment, load
`references/cinematic-look-routing.md`. If the separately installed and
appropriately licensed `cinematic-prompt-engine` Skill is available, use it to
compile photography layers only. Preserve this Skill's panel state, identity,
wardrobe, blocking, prop, location and continuity contracts verbatim.

When dialogue occurs, identify the speaker, exact original line, listener reaction, and sync policy. Put mouth-visible speech in a stable close or medium shot with one speaker. Move dialogue off screen or into post when the shot contains large movement, strong weather across the face, or complex camera motion.

### 6. Choose Delivery Layout

Default to independent 16:9 frames because they are usable as clean keyframes. Every story panel must exist as its own 16:9 image before contact-sheet assembly. A combined board may contain neutral whitespace to preserve every panel's 16:9 aspect ratio; never crop, stretch, or redraw panels merely to fill the board.

When a combined contact sheet is useful, load `references/contact-sheet-compiler.md` and use:

| Panels | Preferred layout |
|---:|---|
| 1 | Single 16:9 frame |
| 2 | 1x2 horizontal |
| 3 | 1x3 horizontal |
| 4 | 2x2 |
| 5 | 2x3 with one deliberate neutral/metadata cell, or individual frames only |
| 6 | 2x3 |
| 7-8 | 2x4 |
| 9 | 3x3 |

Do not let an image model invent an extra story panel for an uneven grid. Prefer individual frames when no clean equal-cell layout exists.

### 7. Lint Before Delivery

Load `references/quality-gates.md`. Block delivery until panel necessity, count, timing, progression, reference binding, continuity, prompt completeness, order, and negatives pass.

### 8. Generate And Pair Deliverables

When the user explicitly requests generation and an image tool is available:

1. Generate independent 16:9 frames for all selected states.
2. Use the bound original identity references in every character-bearing generation. Identity references outrank pose, environment, style, and previously generated storyboard faces. If they conflict, preserve the original identity's facial geometry, features, hairline, hairstyle, age presentation, and body proportions; do not average or blend faces.
3. Apply the panel wardrobe contract separately from identity. Explicit scene wardrobe and approved wardrobe continuity references outrank incidental garments in identity sheets. Repeat forbidden source garments by name when leakage risk is visible.
4. Apply the same approved LOOK lock to every independent frame. Photography refinements may not alter identity, wardrobe, body count, action state, screen direction or geography. Use one physically motivated depth mechanism and keep atmosphere subordinate to subject readability.
5. Optionally assemble a contact sheet from the approved independent frames rather than asking a model to redraw the whole board.
6. Save the exact manifest and prompts beside the images.
7. Report visible deviations and reject identity substitutions, source-clothing leakage, wrong character count, wardrobe drift or LOOK discontinuity.

If no image tool is available, return the prompt package and mark generation as not executed.

## Output Contract

Return these sections:

1. `【分镜图片】` with independent paths/status
2. `【组合分镜板】` when requested or useful
3. `【参考图绑定表】`
4. `【故事还原摘要】`
5. `【画面数决策】`
6. `【角色与场景一致性锚点】`
7. `【N格分镜提示词列】`
8. `【负向提示词】`
9. `【质检】`

Use `templates/adaptive-clip-board.md`. Use the legacy nine-shot template only when the selected count is exactly nine.

## Image-Generation Boundary

- A contact sheet is for planning and review.
- Independent approved frames are the clean I2V/keyframe assets.
- Do not promise exact typography or current model/API support without verification.
- Keep credentials and endpoint settings outside creative prompts.
- Treat user-supplied images only as task inputs; do not identify unknown real people, infer sensitive traits, or reuse them outside the requested work.

## Source

The original fixed-nine note remains at `source-backup/gpt_10秒分镜九宫格提示词.md`. `SOURCE-NOTES.md` records provenance and the adaptive-panel revision.
