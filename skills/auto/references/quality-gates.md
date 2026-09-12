# Auto Quality Gates

Natural scene/action sound is now allowed when consistent with the visible scene
and movement. A no-background-music lock forbids score, not streams or footsteps.
This supersedes older blanket ambience exclusions below, without adding mandatory
external audio assets or changing supplied/story-critical reference requirements.

For `numbered_fields_v1`, `numbered-shot-contract.md` supersedes historical timed
headings and literal whole-snapshot copying below. Validate numbered shot fields,
config shotTimings and physical-only start/end facts. Dialogue belongs only in its
shot, never a continuity state. All unrelated gates remain in force.

## G0 Scope

- An absolute `PROJECT_ROOT` is recorded for every new project.
- Prior user-confirmed asset records were checked and recorded before generation.
- `script-preview.md` was presented for the requested script portion regardless of
  whether confirmed assets existed.
- `project-inventory.json` records a recursive scan of all candidate scripts, images,
  asset manifests and wardrobe tables. Text and table candidates were fully read;
  images were listed mechanically without content inspection. Every unsupported or
  inaccessible candidate is an explicit blocker.
- Source script, title, duration, aspect, output root and rights mode are known.
- A project-specific production profile is locked. It states category, genre/form,
  medium, audience, tone, observable LOOK, prompt language, timed-phase bounds,
  written-continuity mode and sound/music policy; no creative default was inherited
  from another project or a bundled example.
- Paid stages have a budget unit, attempt limit and hard stop.
- No required user-authored shot or dialogue has been silently rewritten.

## G1 Canon

- Every recurring character, location and prop has a stable ID.
- Identity and wardrobe roles are separate.
- LOOK is observable camera, light, color, texture and realism, not brand filler.
- Conflicting references have a canonical decision.
- Every canonical character identity, distinct wardrobe state, location and prop
  records whether it uses a supplied reference or requires generation.
- When generation is required and the user supplied no candidate count, exactly
  three base candidate slots are planned with ordered `-V1/-V2/-V3` IDs. An
  explicit user count is preserved exactly instead.
- Supplied usable references are not duplicated merely to satisfy the generated-
  asset candidate default, unless the user explicitly requested new generation.
- `asset-requirements.json` contains one stable row per visible asset version derived
  from the complete script. Character wardrobe/state, location time and prop state
  variants are separate rows with episode, scene and exact script evidence.
- Existing assets did not define or shrink the requirement universe.
- Every existing candidate is either tied to prior explicit human confirmation and an
  unchanged hash, or remains pending human review. Auto did not inspect image content.
- Every human-approved existing asset is preserved byte-for-byte and has no generation task.
- Every missing or human-rejected version has exactly one generation-required row and a
  finalized prompt in `生图需求全集.xlsx` before paid generation.

## G2 Sequence

- `script-source.txt` contains the complete in-scope source text in order.
- Ordered per-segment `script-verbatim.txt` files reconstruct `script-source.txt`
  exactly, with no gaps, overlap, paraphrase or bookkeeping inserted.
- Every source line maps to a scene and at least one textual shot phase.
- `script-coverage-report.md` reports 100 percent coverage with no missing,
  duplicated, reordered or summary-only units.
- Generation-segment durations are derived from action, dialogue, reaction and
  transition needs rather than equal division, and reconcile with target duration.
- Every segment has one coherent dramatic passage; its internal shot changes are
  explicit and supported by the selected multi-shot mode.
- Every action has a visible start and endpoint.
- Axis, screen direction, eyelines, geography and handoffs are explicit.
- Every visible recurring character has a `wardrobe_visual_lock` containing silhouette/
  layers, color/material, hair or headwear and one checkable accessory/trim, bound to
  its approved character reference. A role label such as `常服` or `寝殿私服` does
  not pass.
- The lock may use `reference_preservation` when an exact human-approved image is the
  only appearance authority. In that mode it binds to one `{{Mixed N}}`, freezes face,
  build, hair/headwear, silhouette/layers, color/material, sleeve shape and accessory/
  trim categories, and prohibits additions, omissions, blending and transfer. It does
  not claim pixel inspection or require the user to transcribe the image.
- The full wardrobe/character lock appears in the role list and opening state; each
  timed phase and ending state repeats its role-indexed short lock name. Cross-segment
  handoffs carry the same lock unchanged unless the script explicitly authorizes and
  locates a costume change.
- Every visible recurring character has a `character_visual_lock` bound to exactly one
  approved character reference, with narrative role, gender presentation, face/build,
  hair/headwear, wardrobe and one unique accessory/trim. Each lock is role-indexed;
  generic grouped descriptions do not pass.
- No separate bulk human `character_visual_lock_review` or appearance-table completion
  is required when each visible version already has an approved reference or adequate
  textual source. Such a gate is a workflow failure, not a valid blocker.
- Every scene with a bed, platform, table, vehicle, stairs, doorway, balcony, water
  boundary or other named surface/boundary has a `spatial_topology_lock` that records
  fixed landmarks, each character's level/start/end anchor, permitted corridor,
  forbidden surfaces/crossings and a camera composition that proves the relation.
- A topology lock is rejected when a character can appear to traverse an undeclared
  load-bearing/elevated surface, emerge from its wrong side, or change floor/elevated
  level without an explicit script-authorized transition. This blocks generation even
  when the rest of the blocking is valid.
- Dialogue is assigned to one exact speaker with a sync/off-screen/post policy.
- A related cross-segment handoff copies the previous written ending state into the
  next opening blocking. No video tail frame is required or referenced.
- The ending state contains a complete continuity snapshot with scene/light, anchors,
  role locks, position, level, posture, facing, eyeline, separate left/right hand
  states, held-object ownership, contact, prop positions, appearance state and any
  unfinished action. A directly continuing opening copies the same snapshot payload
  verbatim; summary-only inheritance fails this gate. The delivered prompt carries no
  internal snapshot ID.

## G3 Duration

- `videoBackend` is explicitly `unselected`, `libtv` or `custom`. Target model and
  capability source may remain unbound for backend-neutral `final_prevideo`.
- The Agent model and target video model are recorded as separate concepts. An active
  Agent model never satisfies a video-backend capability gate.
- A temporarily unavailable schema does not block story segmentation, textual shot
  execution, backend-neutral TSC prompts or `final_prevideo`; it blocks only claims of
  backend compatibility and that backend's execution.
- A user-selected Seedance 2.5 project with a declared 15-30 second range keeps every
  planned generation segment within that range.
- Live endpoint support for each selected duration is verified before paid execution.
- Long duration is not used to hide multiple action chains or camera conflicts.
- A model duration limit may force a split but never determines the initial story
  segmentation. Split only at a natural beat or transition.

## G4 Textual Shot Execution

- Reported generation-segment count equals the unique declared segment IDs. Source
  lines, paragraphs, scanned files, shots, assets and missing artifact files are never
  counted as generation segments.
- Missing `storyboard-execution.txt`, `tsc-handoff.yaml` and `prompt.txt` totals are
  reported separately rather than summed or multiplied into a segment count.

- The ordered `storyboard-execution.txt` files execute every source line; a synopsis
  or selected-beat plan does not pass.
- Every shot has a distinct editorial function.
- Shot scale, lens, angle, height, composition and depth mechanism are concrete.
- User-locked fields match exactly.

## G5 Images

- Every new character/wardrobe candidate prompt satisfies
  `character-asset-standard.md`: left single frontal eye-level upper-body portrait;
  right top frontal standing clothing crop excluding head and neck; right bottom
  back standing view including head and rear hairstyle. All three show one identity
  and wardrobe version. Check the prompt before submission, not just a metadata flag.
- One three-panel character composite counts as one candidate/output, not three.
  Pixel layout compliance still requires the normal human asset review; no automatic
  approval or retroactive regeneration of approved images is implied.
- The image budget and finalized manifest include every planned base asset
  candidate. The effective per-asset count and its `default` or `user_explicit`
  source reconcile with `auto-state.json`.
- Every generated base asset candidate has a stable `<ASSET-ID>-V#` task ID,
  exact prompt and expected local path.
- A provisional asset binding used by dependent generation is marked
  `provisional_unapproved`; it is not recorded as human-selected or approved.
- Every successful base asset candidate is included in aggregate human review,
  and canonical asset approval records the user's selected path or paths.
- Every required original image slot has at least one generated local image file.
- Provider-failed slots completed one bounded `-R1/-R2/-R3` repair group at concurrency 3, or remain explicitly blocked; a blocked slot prevents complete pre-video delivery.
- Every declared character, location, prop and required sound asset path exists or
  is explicitly recorded as missing.
- Required original identity references were actually sent.
- Every referenced job records the exact local paths sent, and no job received an unrelated task's references.
- Generated asset candidate paths, prompts and reference roles are recorded.
- Auto checked only whether each expected generated output file exists. It did not
  decode, inspect, rank, describe, approve or reject image content and did not load an
  image-review Skill.
- Every generated result was delivered directly for human review.
- `image-delivery-manifest.json` enumerates every delivered image with task ID, clip ID,
  role, exact local path and generation batch.
- Every required image file is surfaced in the final aggregate human-review package as a visible preview or direct local file link; counts or directory-only summaries do not pass.
- Before video generation, every required asset has an explicit human `approved` decision.
- User-rejected assets follow the explicit review decision and approved budget.
  Provider-failed image tasks automatically receive one bounded three-candidate
  repair group through a direct `direct_image_run` call with concurrency 3.
- `资产总表.xlsx` exists after asset approval and opens as a valid workbook. A
  project with no visual-reference slots uses an explicitly approved empty image
  manifest and a valid empty workbook; it is not forced to invent an image asset.
- `asset-requirements.json` and `生图需求全集.xlsx` have been rebuilt after image
  generation. Full-series and every episode report zero missing, human-rejected and
  pending-human-review versions, every requirement is `approved_existing` or
  `approved_generated`, and registry status is `COMPLETE`. Otherwise status is
  `NEED_FIX` and every unresolved row is listed.
- It contains `人物`, `场景`, `道具` and hidden `_索引` sheets.
- `_索引` records each embedded image's asset ID, category, source path and approval timestamp.

## G5.1 Mandatory Storyboard Keyframe Image & Spatial Lineart Gate (Rule 0.24)

- Storyboard image generation is a mandatory prerequisite phase for video delivery. Direct video generation without verified storyboard images is strictly prohibited.
- Every shot in each segment must have:
  1. A dedicated pure B&W spatial staging lineart (`SEGxxx_镜头y_站位线稿`) defining lateral coordinates (画左/画中/画右), body facing, and gaze vectors without facial/clothing details;
  2. Explicit lineart mapping injected in the shot's `位置承接：` (`[线稿图对应关系：...]`);
  3. A dedicated storyboard image node (`biz/image`, `SEGxxx_镜头y_图片`) connected to the shot's characters, scene, and lineart;
  4. The legacy frontal reference block (`【资源引用】`) is completely removed to eliminate frontal portrait prior bias.

## G5A TSC References And Prompts

- Every generation segment has one valid `tsc-handoff.yaml` produced from the
  current script, segment plan, asset bible, approved assets and sound manifest.
- Every handoff points to complete `script-verbatim.txt` and
  `storyboard-execution.txt` files.
- Every segment prompt starts with `生成时长` and then includes
  `【角色清单】`, `【资源引用】`, `【场景】`, `【站位与起始状态】`, a number of
  contiguous timed camera fields within the locked production profile range, and
  `【结束状态】`, in that order.
- Every visual `{{Mixed N}}` is defined in `【角色清单】` as `主体N` with an
  observable description. Mixed and subject numbers match exactly and remain
  unchanged throughout the prompt.
- After `【角色清单】`, character names appear only in voice-ownership clauses and
  verbatim quoted dialogue. `CHAR###`, `角色锁` and parallel aliases are absent;
  timed fields use `主体锁` and `各主体仅保留自身主体锁，不交换外观`.
- The verbatim section contains the complete assigned source passage in source order,
  without paraphrase or omission. The textual execution and generation instructions enact
  every source line; attaching unused source text does not pass.
- Every visible recurring character has an approved independent character reference.
- For every approved three-panel character composite used in a new/revised video
  prompt, the actual `【资源引用】` section includes the numbered reference-use
  instruction from `character-asset-standard.md`: one identity, left face, right-top
  front wardrobe, right-bottom rear hair/wardrobe, and no inherited panels, repeated
  figures, head/neck cropping or display poses. A handoff-only note does not pass.
  Shot execution still controls character count, composition and action; do not
  apply this requirement to single-view references or unchanged legacy deliveries.
- Every visible location has an approved independent location reference.
- Every indispensable character, location, prop or required sound has an approved
  reference or an explicit missing status.
- Every speaking character retains exact dialogue and speaker ownership. An external
  character-voice reference is required only when supplied or explicitly requested by
  the user, or required by the selected backend; otherwise it is `not_applicable`, not
  missing. A required reference may carry an explicitly recorded audio-audit timeout
  into an authorized run without binding that node.
- Environmental audio, room tone, reverb, foley, sound effects and music are absent
  from mappings and prompt prose unless supplied or explicitly requested by the user,
  or documented as indispensable to plot, timing or transition. Every included
  critical sound has an approved reference or is reported as required and missing.
- A category is `not_applicable` only when the segment does not use it and the
  decision is recorded. `missing` and `not_applicable` are never interchangeable.
- Every reference records exact local path, role, subject or environment, approval
  state and `{{Mixed N}}` package-slot status. A final pre-video prompt requires
  `package_slot_verified`; this does not claim a LibTV node connection.
- No ordinary asset reference or video frame is treated as a first frame. Cross-
  segment continuity uses only the written handoff state.
- Reference images never overrule script chronology, exact dialogue, actions,
  reactions, transitions or endpoints.
- Every final `prompt.txt` was compiled by `modules/tsc/MODULE.md`; Auto did
  not draft, rewrite, optimize or substitute its prose.
- An internal TSC draft may contain planned `{{Mixed N}}` placeholders,
  but every such token is marked `planned_unverified` in the handoff. Drafts never
  count as final prompts and never pass the video-generation gate.
- Every TSC prompt preserves exact dialogue, causal order, reference ownership,
  character voice ownership and ownership of any explicitly included sound.
- Every TSC prompt follows the profile-governed production format: role list,
  resource references, physical scene, starting blocking, the permitted number of
  timed camera fields and ending state.
- Internal planning identifiers such as `C###`, `SHOT###`, `镜头###` and `clipId` do
  not belong in delivered video prompt prose. They may remain in audit files,
  handoffs, manifests and configuration. Use a timed range alone for each prompt phase.
- Every state-changing action contains an explicit observable pre-action state, ordered
  dependent steps and a resulting post-action state. Appearance changes must state the
  original appearance before the change, such as natural unpainted nails before nail
  polish is applied.
- A localized appearance change names exactly one target and freezes all non-target
  counterparts in every affected phase. For nail painting, the target hand and digit
  are explicit, only brush contact may change that nail, and the other nine nails retain
  their prior color throughout.
- Every visible recurring character's full `character_visual_lock` and
  `wardrobe_visual_lock` are attached to its `主体N` in `【角色清单】`; every visible
  timed phase and `【结束状态】` repeat the applicable numbered subject lock.
  A changed robe, color, headwear, accessory or sleeve silhouette
  without an explicit script-authorized transition fails G5A and blocks video generation.
- Every visible phase includes every visible character's exact role-indexed
  short `character_visual_lock` name, followed by the no-transfer clause. A prompt fails G5A and
  blocks generation if a character can plausibly take another character's clothing,
  hairstyle, headwear, face, gender presentation, accessory or rank marker, even when
  each individual reference file is present.
- When `spatial_topology_lock.required` is true, its fixed landmarks, character levels,
  permitted corridor and forbidden crossings are stated in `【场景】`,
  `【站位与起始状态】`, each movement phase and `【结束状态】`. The prompt also names a
  composition that visibly proves the relevant surface boundary; a destination-only
  description does not pass.
- Every final prompt ends with the locked project visual-style suffix. The suffix is
  checked as a rendering constraint and cannot override story or continuity state.
- Immediately before the style suffix, every prompt contains the exact locked
  `productionProfile.prompt.endingPolicy`. It forbids video tail-frame continuity;
  its music clause matches the project sound plan.
- A related next Prompt cannot pass unless its written starting blocking matches the
  previous Prompt's written ending state and contains no tail-frame input.
- Matching requires literal equality of the stable continuity snapshot payload, not
  semantic similarity or a generic instruction to keep positions consistent.
- Every TSC prompt starts with `生成时长：N秒。`; `N` matches the segment handoff
  and package configuration, and is supported by the selected live model before generation.
- Missing references, unapproved references, unrecorded audio-audit timeouts,
  invented `{{Mixed N}}` package slots or LibTV connections,
  missing TSC handoffs, draft-only prompts, legacy prompts or partial prompt collections
  fail G5A and block video generation.

## G5B `/分集` Pre-Video Completion

- `references/content-review-contract.md` is satisfied for every segment, including
  zero-time metadata handling, exact dialogue ownership, context-specific reference
  relevance and realistic event timing. `content-review.json` is hash-bound to the
  current source, config, prompts, textual shot execution and handoffs. It is copied
  unchanged into the episode root and passes `scripts/validate-content-review.cjs`.
- A producer's semanticReview=passed or a literal source-coverage report is not
  semantic evidence. Missing/stale evidence and unresolved content errors block
  formal replacement and completion. No additional SEG-level file is introduced.

- `control.mode` is `episode_prevideo`, its terminal stage is
  `pre_video_delivery_complete`, and video side effects are disabled.
- Image and sound manifests, aggregate human approval, workbook result, all TSC
   handoffs/prompts and the fixed formal package agree on the same approved files.
- For 2.3 projects, `project-inventory.json`, `script-preview.md`,
  `asset-requirements.json`, `生图需求全集.xlsx` and its result are included and
  hash-identical to the working project.
- Approved image files retain their reviewed SHA-256 values and one aggregate
  approval timestamp across the image manifest, workbook input and workbook result.
- Every packaged asset mapping is `OK`; missing required slots are zero.
- `segment-progress.json` reports the unique configured segment count and separate
  missing counts for `script-verbatim.txt`, `storyboard-execution.txt`,
  `tsc-handoff.yaml` and `prompt.txt`.
- `scripts/validate-video-prompts.cjs` and
  `scripts/validate-prevideo-delivery.cjs` both pass for the complete segment set.
- `budget.videoLimit`, `budget.videoUsed` and generated video count are all zero;
  no upload, video node mutation, run or download is claimed.
- The state is not marked complete until the pre-video validator passes. Package
  construction or prompt validation by itself does not pass G5B.

## G6 Selected Video Backend

- The user issued `auto video` or an equally explicit current-project video command;
  its exact text and authorization time are recorded. Bare `auto`, asset approval or
  pre-video completion does not pass this gate.
- A backend and target model are explicitly selected and their capability contract is
  verified before any paid video generation.
- For LibTV only: `libtv account info` succeeds, the working directory is bound to the
  intended canvas, exact model schema is fetched live, settings satisfy the schema,
  connected node names/keys are real and prompt placeholders reference only connected
  nodes.

## G7 Take

- The run command exited and terminal JSON was saved.
- Generated video was visually reviewed, not accepted from status alone.
- Actual endpoint and deviations are recorded.
- Failed paid generations are not automatically retried.

## G8 Delivery

- Every claimed download exists locally.
- Every delivered segment root contains exactly `资产/`, `prompt.txt`,
  `script-verbatim.txt`, `storyboard-execution.txt`, `tsc-handoff.yaml` and
  `素材映射.txt`; `资产/` contains exactly `场景/`, `道具/`, `人物/` and `声音参考/`.
- Every packaged asset uses one of the six allowed asset types and its mapping points
  into the matching fixed asset directory. No extra segment-level report or manifest exists.
- Planned/generated/accepted/downloaded counts reconcile with state.
- Attempt usage does not exceed the hard stop.
- Remaining failures and post-production gaps are explicit.
