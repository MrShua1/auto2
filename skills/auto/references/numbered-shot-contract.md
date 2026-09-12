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
位置承接：必须明确人物在场景中的具体物理锚点（如细沙滩、礁石、门外）、景深层次（远景/中景/近景/深景）、身体与面朝方向，并显式承接前序镜头中该角色的朝向与空间锚点（如：承接镜头2朝向与空间锚点，身体与面部严格正向面朝深景处的远景大海，后背严格背向近景陆地细沙，绝对严禁背朝远景大海或面朝近景陆地），绝对严禁使用“前方/后方/正前方/正后方”等孤立模糊词，严禁使用“承接上一镜”等泛泛空词，严禁漏写面朝方向与景深锚点。
台词：实际说话主体与逐字台词；没有则写“无”。（注：剧本无OS必须人嘴说话，嘴唇同步张合发音，严禁O.S.标签污染；仅剧本有OS或纯POV方可写为画外音；兼容标签：台词：/对白：/画外音：/台词/O.S./OS：）
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

## Cinematic Grammar, POV Decoupling, And Single Physical Momentum (Rule 0.11)

All numbered shots must strictly comply with cinematic shot grammar and perspective decoupling:
1. **Objective vs Subjective POV Decoupling Gate**:
   - Never merge third-person character observation/reaction (e.g. eye opening, ability activation) with first-person POV or environment X-Ray/penetration effects into a single shot.
   - When the script describes sensory abilities (e.g. 水眼金睛, 透视), character gaze, or medium penetration (e.g. sea water turning transparent to reveal fish), it MUST be split into an authentic montage sequence:
     - Shot A: Objective Reaction Shot (ECU / Close-up of character's face/eyes, golden light burst, lips strictly closed, zero lip movement).
     - Shot B: Subjective POV Shot (High-angle POV looking down at the environment, expanding ripples, crystal transparency, marine life).
     - Shot C: Reaction / Result Shot (Medium shot of character smiling or executing subsequent physical actions).
2. **Shot Duration Budget & Single Physical Action Rule**:
   - Short drama individual shot durations must stay within the 2.5s to 5.0s golden range (ECU 2.5~3.5s, POV/VFX 3.5~5.0s, dialogue 3.0~4.5s). Never cram 8~10s multi-stage actions into one shot.
   - 动作顺序 must contain exactly ONE core physical momentum change. Multi-stage continuous transitions (e.g. eye opening + wave expanding + sea clearing + fish swimming + speaking/laughing) are strictly forbidden within a single shot.
3. **POV Asset Purge & Ghost Mixed Elimination**:
   - Zero Ghost Mixed: Only declare Mixed IDs for subjects that actually physically appear in this specific shot. Never output unrendered placeholder tokens like `{{Mixed 3}}`.
   - In Subjective POV Shots: The observer's character asset (e.g. `{{Mixed 1}}`) MUST be purged from the shot's 主体锁 field to prevent video diffusion models from hallucinating floating human bodies/faces in the sea or sky.
4. **Cinematic Audio-Visual Decoupling & O.S. Voiceover**:
   - Spoken dialogue during a POV shot must be marked as `画外音（O.S.）`, with explicit note: `纯画外音配音回荡，出镜画面无人物，彻底规避口型同步失真风险`.
   - Any character appearing in extreme close-up during internal monologue or ability burst must declare: `双唇严密闭合（Lips tightly closed, zero lip movement），严禁开口驱动`.
5. **Verbatim Dialogue Sacred & Zero Subject Placeholder Replacement (Rule 0.12)**:
   - Any text inside Chinese quotes `“……”` or English quotes `"..."` representing spoken dialogue, voiceover (VO), offscreen dialogue (OS), or internal monologue MUST be 100% verbatim from the authoritative source script!
   - Under NO circumstances may entity names (character names, fish species, prop items, locations) inside quotation marks be substituted with subject placeholders (`主体1`, `主体2`, `主体3`).
   - Any prompt containing `[“"][^”"\n]*主体\d+[^”"\n]*[”"]` fails validation immediately.
6. **Universal Subjective Gaze Penetration & Optical Refocusing Gate (Rule 0.13)**:
   - **Universal Scope**: Applies not just to supernatural/divine vision (水眼金睛), but universally to all cinematic scenes where a character "gazes over / looks through" (视线望过去) across physical mediums or vast distances:
     - Looking into water from docks/boats/bridges (0 bubbles or splash);
     - Looking through windows/glass with raindrops or reflections into exterior/interior spaces (0 glass vibration/breakage);
     - Gazing across mist/curtains/distance towards a distant subject (rack focus reveal, 0 medium deformation);
     - Supernatural or X-ray vision revealing deep targets.
   - **Anti-Double-Exposure Gate**: Never combine foreground medium scene and background target scene in a single static shot expecting in-place transparency.
   - **Three Invariants**: Non-physical gaze trajectory (zero physical fluid/mechanical disturbance), medium objective invariance (zero pseudo-transformation), depth-of-field optical reveal.
   - **Cinematic Sequence**: Shot A (Objective reaction ECU) -> Shot B (Subjective POV Optical Penetration & Refocusing, 0 character body in frame, O.S. monologue, 4.0~5.0s) -> Shot C (Objective reaction) -> Shot D (Target close-up).

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


## Segment Boundary Continuity, Spatial Orientation and Tail-Action Avoidance

To prevent AI video diffusion models (e.g., Seedance 2.5) from duplicating actions across segment boundaries (such as throwing an iPad in SEG001 and then holding it and throwing it again in SEG002) or flipping character orientations:

1. **Tail-Action Avoidance (Segment Endings Must Be Static)**:
   - In the final shot of any segment (SEG_N), active transitional or irreversible physical actions (e.g., throwing a device, opening a door, falling over, sitting up, punching) MUST NOT occur.
   - The final shot and `【结束状态】` must conclude on a **static holding state / suspense freeze** (e.g., character sits on bed gripping the tablet, staring angrily at the screen with chest heaving). The action is NOT executed in the ending shot.

2. **Head-Action Trigger (Action Triggers in Next Segment Opening Shot)**:
   - Dynamic transitional actions must be shifted to the opening shot (Shot 1) of the subsequent segment (SEG_(N+1)).
   - SEG_(N+1) `【站位与起始状态】` inherits the static holding pose from SEG_N's ending. Then, Shot 1 of SEG_(N+1) triggers and completes the dynamic action (e.g., character throws the tablet onto the bed).
   - This guarantees that the physical action occurs exactly once across the entire production timeline, completely eliminating the model's propensity to reset props into hands and duplicate actions.

3. **Explicit Facing Direction & Landmark Anchor in Continuity (`位置承接：`, Rule 0.16 & Rule 0.17)**:
   - The `位置承接：` field of every shot with characters, as well as `【站位与起始状态】` and `【结束状态】`, MUST explicitly specify:
     a. Landmark physical anchor in the set (e.g., center of master bed leaning on pillows, sand ground spot).
     b. Depth plane association (e.g., `深景处的远景大海`, `近景细沙地面`, `中景走廊大门`).
     c. Body torso orientation and explicit facing direction tied to anchor and depth (e.g., torso and face strictly facing the background sea, back strictly facing foreground sand ground; strictly zero back-to-sea reversal).
     d. Eyeline and head direction (e.g., head turned facing background sea waves).
     e. Relative spatial topology (e.g., back to double entrance doors, bedside table on left).
     f. **Orientation & Anchor-Depth Inheritance across Interleaved Shots**: When an objective character shot follows an interleaved POV shot, cutaway or prop insert, `位置承接：` MUST explicitly inherit the character's prior orientation and anchor-depth relation (e.g. `承接镜头2主体1的朝向与空间锚点：主体1身体与面部严格正向面朝深景处的远景大海，后背严格背向近景陆地细沙（绝对严禁背朝远景大海或面朝近景陆地），挺拔巍然而立`), preventing models from flipping the character 180 degrees.
     g. **Ban Vague Direction Words (Rule 0.17)**: Pure floating directions such as `正前方`, `前方`, `正后方`, `后方` without depth plane and concrete physical anchor are strictly banned.
     h. **Anchor Depth Invariance Across Segment (Rule 0.17)**: If an anchor is established as background (e.g. `远景大海`), it must remain background throughout the segment.
   - Vague phrases like "承接上一镜" or omitting facing directions/depth anchors are strictly forbidden and fail validation immediately.

4. **Dialogue Lip-Sync & Strict OS Voiceover Isolation (`台词：`, Rule 0.18)**:
   - **On-Screen Speech (No OS in Script)**: If the script does not write `(OS)` and the character is on screen, it MUST be on-screen speech (`人嘴说话`).
     * Field heading MUST use clean `台词：` (or `对白：`). NEVER include `O.S.` or `OS` in the heading or notes!
     * `动作/表演：` MUST include physical mouth opening action (e.g. `主体1嘴唇根据台词清晰自然张合发音，面部肌肉自然配合咬字驱动，严禁紧闭双唇`).
     * The dialogue line must conclude with explicit on-screen lock: `（主体1正常开口发声，双唇清晰自然张合咬字驱动，现场原声对白，严禁闭口，严禁生成画外音）`.
   - **Voiceover / Inner Monologue (OS in Script or pure POV)**:
     * Only when the original script explicitly designates `(OS)` or in pure subjective POV shots (0 characters on screen) can voiceover be used.
     * When character is visible on camera during an OS line, character MUST be locked: `双唇严密闭合（Lips tightly closed, zero lip movement），内心独白画外音，严禁口型张开驱动`.

5. **Dialogue & Plot Capacity, Action Hierarchy & Segment Boundary (Rule 0.19, 7.2/7.3/7.4 Specs)**:
   - Dialogue capacity: 20-45 characters per 15s prompt; 8-18 characters per shot; 4-10 characters for dramatic peaks. Never hallucinate or delete verbatim dialogue.
   - Action hierarchy: Class A (key plot changes) allocated 1.5-3s full action arc; Class B (connective moves) concise; Class C (decorative gestures) bundled or pruned.
   - Boundary condition: End segment only upon capacity saturation (15-28s), natural plot beat boundary, or major scene transition.

6. **POV Underwater Decoupling & Zero Sky-Fish Gate (Rule 0.20)**:
   - In objective shots with sky/horizon/beach/person, strictly forbid describing underwater fish/marine life in the same frame to prevent diffusion models from rendering 'fish flying in the sky'.
   - Split cross-medium underwater reveals into a three-shot montage: Objective Setup Shot -> High-Angle Top-Down Subjective POV looking directly down into water (0 sky, 0 people) -> Objective Result Shot.

7. **Zero Wardrobe Declaration in Staging & Continuity (Rule 0.21)**:
   - 【站位与起始状态】, 【位置承接】, and 【结束状态】 MUST NEVER declare character clothing, wardrobe, or accessories (e.g. 身穿粗布工装, 穿着便服, 短袖, etc.).
   - Character attire is 100% and exclusively governed by the character reference image cards bound in 【资源引用】.
   - Staging sections must strictly describe pure physical spatial coordinates, body postures, facing directions, and relative environmental anchors.
8. **Zero Vague Relative Position, Segment Lateral Screen Invariance & 4D Anchor-Depth Synergy Gate (Rule 0.22)**:
   - **Ban Vague Relative Words**: Strictly forbid using 旁侧, 身侧, 身旁, 旁边, 在旁 in 【站位与起始状态】, 【位置承接】, and 【结束状态】.
   - **Explicit Lateral Screen Axis**: Every visible character must be bound to explicit screen coordinates: 【画左】, 【画右】, 【画左偏中】, 【画右偏中】, 【画左外侧】, 【画右外侧】. Relative distance between characters must state explicit relative sides and steps (e.g. 主体2右侧半步, 主体1左侧).
   - **Segment Lateral Screen Invariance**: In a single video segment (SEG), characters' screen sides (left vs right) MUST remain strictly constant across all shots. Characters established on screen left must stay on screen left; characters on screen right must stay on screen right. Unauthorized cross-the-line axis flips or teleport swaps are strictly forbidden.
   - **4D Coordinate Synergy with Rule 0.17 Anchor Depth**: Every position statement must synthesize into a unified 4D coordinate:
     [Character] standing on [Screen Lateral: 画左/画右] + [Depth: 近景/中景/远景/深景] + [Physical Anchor: landmark] + (Relative spacing to others), body and face facing [Target Screen Side & Character], back strictly facing [Opposite Physical Anchor].

9. **Strict Zero Scene Visual Description Hallucination & Pure Scene Reference Gate (Rule 0.23)**:
   - When a scene reference image asset is present ({{Mixed N}} 限定主体N场景结构与环境), the 【场景】 section MUST ONLY state the pure spatial identifier and basic lighting: 主体N场景空间，日景自然光照。 (or 夜景自然光照 / 黄昏自然光照).
   - Strictly forbid writing any descriptive visual prose, architectural condition, debris details, or atmospheric adjectives in the 【场景】 section (e.g. forbid 残破焦黑的房梁木炭散落，烧焦砖瓦满地，海风呼啸吹过废墟，沿海阴天真实质感 or 残破砖瓦与焦黑木桩横陈).
   - Scene architecture, texture, debris, and physical details are 100% and exclusively governed by the scene reference image asset. Text descriptions override and distort the image asset in diffusion models, causing cross-segment scene drift and visual discontinuities.
   - **Dual-Track Shot-Level Alignment & Strict Zero Descriptive Prose**: In individual shots, 场景/时间/光线： MUST strictly follow pure spatial syntax: 场景/时间/光线：主体N场景，日景自然光照。 (or 夜景自然光照。). Absolutely forbid adding any architectural condition, debris, or atmospheric adjectives (e.g. forbid 废墟阴影与沿海阴天散射光, 斑驳阳光, 写实光照). Both top-level 【场景】 and shot-level 场景/时间/光线： are enforced with hard exit-1 linter gates.

10. **Mandatory Storyboard Keyframe Image & Spatial Lineart Decoupling Gate (Rule 0.24)**:
    - **Mandatory Storyboard Keyframe Workflow**: Storyboard image nodes (`biz/image`) and verified storyboard keyframe images are mandatory prerequisites for video generation. Direct submission to video generation without confirmed storyboard images is strictly prohibited.
    - **Pure Black-and-White Spatial Lineart**: Every shot with characters must be accompanied by a dedicated B&W spatial lineart (`SEG00x_镜头y_站位线稿`) establishing lateral screen coordinates (画左/画中/画右), body orientation, eyelines, depth, and camera angles. Lineart deliberately omits facial and clothing details to avoid portrait priors.
    - **Purge 【资源引用】 & Inject Lineart Mapping**: The legacy 【资源引用】 block (e.g. `右上格提供正面服装...`) is completely abolished to prevent frontal portrait prior hijack. Each shot's `位置承接：` MUST begin with explicit lineart-to-subject mapping syntax:
      `[线稿图对应关系：线稿画左外侧站立的两名人物对应主体2与主体3（面朝画右）；线稿画左偏中挺立的人物对应主体1（面朝画右）；线稿画右近景大步迈入的两名人物对应主体4与主体5（面朝画左）。]`
    - **Three-Tier Decoupled Node Binding**: Each storyboard image node (`SEG00x_镜头y_图片`) strictly binds:
      1. Visible character reference cards (identity, face, wardrobe);
      2. Scene reference card (spatial structure, natural lighting);
      3. The shot's dedicated spatial lineart (spatial skeleton, orientation).
    - **Video Node Dual Ingress**: Video nodes (`SEG00x`) connect character cards, scene cards, audio references, and all shot linearts as image inputs, with the approved storyboard keyframes used as first-frame anchors.
