---
name: auto
description: "全自动 AI 短片生产与 /分集 预视频交付：剧本转逐片段执行提示词、连续性资产绑定，并可按授权适配 LibTV 或其他视频后端。Use when the user says auto, /分集, 分集, 剧本到视频, or asks for screenplay-to-pre-video-package or screenplay-to-video-backend workflow."
license: MIT
compatibility: "OpenCode; Windows-first; self-contained rules; image and video execution tools are required only for the corresponding selected execution stage."
metadata:
  version: "1.8.4"
  updated: "2026-09-05"
  scope: "screenplay-to-pre-video and optional video-backend orchestration"
---

# Auto

For missing tools after installation, read references/host-tool-diagnostics.md.
Offline readiness does not measure live host registration or restarts. After one
confirmed full restart, diagnose actual config/import/permissions/tool exposure;
never repeatedly blame the user's restart based on a hardcoded readiness status.

## Auto D Mandatory Delivery Rules

Image generation uses the relaxed preflight and bounded automatic regeneration in
`references/auto-d-image-retry.md`. This latest user policy replaces older mandatory
three-repair-candidate groups and no-retry instructions for Auto-managed image jobs
only. Do not apply it to video or unrelated direct st commands.

Read `references/auto-d-portability-and-materials.md` before intake, generation,
TSC compilation, final delivery, or redistribution. These newer rules override
conflicting older defaults in this file and bundled snapshots.

- Ship every execution tool, all eight internal skill modules, their resources,
  pinned dependencies, installation, offline tests and readiness checks together.
  Missing required tools still block their stage; never bypass them with ad hoc API
  calls. Install the included direct_image_run plugin and restart OpenCode first.
- TSC is performed by the Agent under the bundled TSC module, not by a missing
  external screenplay generator. Missing real handoffs/approval still block final output.
- Use the user's explicit image route (including stx); st2 remains the default only
  when no route is selected. Never switch routes automatically. stx is 1K/auto quality.
- Supplied notices, posters, letters, cards and banners must be physically integrated
  into the relevant location and prop assets through role-bound image references.
  Filing a source image or reserving a blank surface is not visible integration.
- Do not create delivery previews, HTML overviews or contact sheets. Preserve the
  requested SEG granularity; multiple shots can belong to one SEG without any
  larger episode/unit folder when SEG is the user's maximum delivery unit.
- `/分镜` is an alias of `/分集` unless the user narrows its scope. It does not
  authorize video or bypass any approval, asset or final-delivery gate.

## Current Shot And State Rules

Newly generated character assets MUST follow
`references/character-asset-standard.md`: one composite image with a single left
front-facing, eye-level upper-body portrait and a right column of two stacked
views (top: front standing clothing view excluding head and neck by framing;
bottom: back standing view including the head and rear hairstyle). This is a
required asset layout, not an optional delivery contact sheet. Apply it to every
new character/wardrobe candidate; preserve already approved assets unchanged.

Runtime dependencies are pinned in package-lock.json. Install with `npm ci
--ignore-scripts` in the Skill directory when node_modules is absent. Official
workbook entrypoints now use local OpenXML generation rather than Excel COM;
they reopen and hash-bind the saved workbooks before approval. Audio/image pixels
are not creatively judged; mechanical image dimensions only preserve Excel layout.
Before any authorized video side effect, reserve output-count budget atomically;
failed/unknown attempts are not automatically refunded or retried. Read
`references/release-1.8.3.md` and `REVIEW-1.8.4.md` for migration and verification limits.

Natural scene/action audio (such as visible stream sound and footsteps during
walking) is now explicitly permitted without inventing external audio assets.
This overrides older blanket exclusions of such ambience/foley. Background music
remains separately governed by the project's music policy; no-music does not mean
silence. See the sound policy in `references/numbered-shot-contract.md`.

Read `references/numbered-shot-contract.md` before authoring or revising prompts.
For new prompts and explicitly requested format revisions, use
`productionProfile.prompt.shotFormat: numbered_fields_v1`.
Set `productionProfile.prompt.requireShotDuration: true` for new or explicitly
revised prompts. Display each shot's own duration after its heading; these durations
must match shotTimings and sum to the SEG duration. Never equal-split by default.
This contract overrides older timed-heading and verbatim whole-snapshot instructions below and in internal
source snapshots: headings are `【镜头1】（6秒）`, `【镜头2】（8秒）`, etc.; every shot has the
ten required fields. Opening/ending sections contain physical facts only, never
spoken dialogue or completed performance. Preserve previous project shot-count and
duration bounds, Mixed bindings, resource scope, role list and offscreen rules.
Existing delivered projects are not silently migrated; regenerate and rereview
affected prompts and handoffs when a format revision is requested.

Default to no added subtitles/overlays in new prompts. Apply the short global
instruction in `references/numbered-shot-contract.md` once; preserve spoken audio
and original scene/prop text, honor explicit script/user overlay requirements, and
remove contradictory unsolicited caption instructions. Do not rewrite old projects.

Turn a supplied screenplay into an auditable, backend-neutral AI-video production
package and, when a backend is selected, authorized and technically ready, adapt and
generate each accepted clip. LibTV is one optional adapter. This Skill is the single user-facing orchestrator and owns its full
production rule set inside this directory.

## Trigger And Scope

Use this Skill when the user invokes `auto` or requests the complete chain:

```text
PROJECT_ROOT -> confirmed-asset check -> required script preview -> recursive inventory
-> complete script extraction -> version-level asset requirement universe
-> existing-asset human-confirmation matching -> image-requirement workbook
-> asset generation || segment-project preparation
-> generated-asset coverage review -> TSC prompts -> complete pre-video delivery
-> explicit video command -> selected-backend adaptation/pilot/batch -> take review -> download
```

Modes:

- `/分集`: execute one complete screenplay through the complete pre-video delivery
  gate and stop before all video side effects. Read
  `references/episode-command.md` and preserve its `episode_prevideo` state lock on
  every resume. This mode may generate required `st2` asset images and pauses for
  aggregate human asset selection, but it never uploads to LibTV, creates/updates a
  node, runs video generation, downloads video or enters Stage 7.
- `auto plan`: create planning artifacts and clearly labeled `planned_unverified`
  prompt drafts with no paid generation. It cannot produce a complete pre-video
  delivery unless every required reference was already supplied and approved.
- `auto images`: execute the complete in-scope `st2` image workflow directly
  without intermediate review pauses or a separate `st2` command.
  Then present all generated asset candidates for human asset selection. After required character,
  location, prop and sound references are approved, compile every
  generation-segment prompt exclusively through Auto's integrated TSC module and
  present the complete pre-video package for final approval.
- `auto video`: continue a human-approved package through the explicitly selected
  video backend. LibTV generation and no-watermark download apply only when LibTV is
  selected;
  it does not generate images. This or an equally explicit user command containing
  an unambiguous request to generate video is the only video authorization.
- `auto resume`: read `auto-state.json` and continue only the next unresolved stage.
  When generation-required image rows remain, call `direct_image_run` directly for
  those in-scope batches; do not ask for another `st2` command or wait for an image
  token. Skip the tool check when no image generation is required.
- Bare `auto` with `PROJECT_ROOT` means the complete workflow through validated
  pre-video delivery. Its image stage calls `direct_image_run` only when generation
  work exists, and it stops before every video side effect. Completing assets, prompts or approval does not
  imply permission to generate video; wait for `auto video` or an equally explicit
  command for this project.

Do not use for one unrelated image, traditional screenplay formatting, pure
live-action planning, or a LibTV operation unrelated to narrative production.

## Closed Skill Boundary

During an Auto task, never load, read or invoke any Skill outside this Auto
directory. This prohibition includes similarly named story, director, prompt,
image-generation and LibTV Skills. Use only files and modules contained in
this Auto directory:

| Internal module | Owned responsibility |
|---|---|
  | `references/internal-production-rules.md` | Story scope, canon, blocking, coverage, camera, asset contracts and review boundary |
| `references/internal-image-execution.md` | `direct_image_run` route, task batching, concurrency, failure repair and mechanical validation |
  | `modules/tsc/MODULE.md` | Exclusive backend-neutral video-prompt compiler using script, textual shot execution, character, location, prop and sound references |

Read `references/internal-module-manifest.md` for the complete load order,
capability map, allowed execution interfaces and forbidden dependencies.
For `/分集`, also read `references/episode-command.md` before Stage 0.

Detailed integrated modules live under `modules/`. Enter each module through its
`MODULE.md`; read its renamed `SOURCE-SKILL.md` and local resources only when the
active stage requires them. Never resolve those source snapshots through the Skill
loader. Auto's main hard gates, current internal rules and user locks have precedence
over conflicting historical language inside a snapshot.

`direct_image_run` and the `libtv` executable are optional execution interfaces, not
Skills. Require `direct_image_run` only when unresolved asset rows actually require
image generation. Require `libtv` only after `videoBackend: libtv` is selected. If a
required tool for the active execution stage is absent, mark that stage `BLOCKED`;
its absence never blocks backend-neutral story, segmentation, storyboard, TSC prompt
or pre-video packaging work.

## Authority And Precedence

1. The complete user-authored script, verbatim dialogue and explicit per-shot locks.
2. Accepted generated take and its observed end state.
3. Canonical identity, wardrobe, location, prop and LOOK assets.
4. Selected video backend's verified capability contract, when a backend is selected.
5. `auto` workflow and project state.
6. Auto internal-module defaults.

Never let a style layer change story state, identity, wardrobe, blocking,
geography, screen direction or a user-locked shot.

## Production Profile Contract

Auto is genre-, audience-, period-, culture-, medium- and model-neutral. Every new
project must instantiate `templates/production-profile.json` before shot planning.
The locked profile records content category, genres or documentary form, visual
medium, audience, tone, observable LOOK suffix, prompt language, timed-phase range,
state-change contract, written-continuity mode and sound/music policy. Do not inherit
these choices from a previous project, bundled example or target model.

Every generated still or video prompt ends with the locked project LOOK suffix. It
must describe observable medium, camera, lighting, color, texture and realism rather
than merely naming a genre, title, studio or creator. Auto has no Skill-wide visual
style default.

## Project Intake And Asset Universe

`PROJECT_ROOT` is mandatory for every new Auto project. Before any paid generation:

1. Check whether the project already contains user-confirmed asset decisions or an
   approved Auto manifest. Record what was found, but do not trust a filename,
   directory or old approval after its file hash changes.
2. Preview the exact script portion requested by the user. When no narrower preview
   was requested, present a concise episode/scene-indexed preview of the complete
   script. This preview always happens, whether confirmed assets exist or not.
3. Run `scripts/scan-project-root.cjs --project-root <PROJECT_ROOT>`, then fully read
   every candidate screenplay, image asset, asset manifest and wardrobe table in its
   usable native form. The complete in-scope script remains the sole authority for
   required content.
4. Build `asset-requirements.json` with one row per required asset version. Create one
   entity per visible character; split a character for every distinct wardrobe or
   visible state, a location for every distinct story time/lighting state, and a prop
   for every distinct visible state. Every row carries episode, scene and exact script
   evidence.
5. Match existing files using filename, directory, manifest and wardrobe-table
   evidence, but do not inspect or judge image content. An existing image is valid
   only when the user already confirmed that exact file and its recorded hash still
   matches. All other existing images are delivered as `pending_human_review`.
6. Preserve every human-confirmed valid asset byte-for-byte. Never regenerate, overwrite, rename,
   move or delete it merely to normalize the project. Generate only missing or human-rejected
   versions, writing to new non-conflicting paths.
7. Before image generation, build `生图需求全集.xlsx` from the registry. It contains
   one generation-required asset version per row and the required columns defined by
   `templates/asset-requirements-workbook.md`.

After generation, check only whether each requested output file exists, record its path,
and deliver it directly for human review. Do not inspect,
rank, describe, approve or reject image content. `STATUS=COMPLETE` is legal only when
the user has approved every required version and full-series and every episode have
zero missing, human-rejected and pending-human-review versions; otherwise use
`STATUS=NEED_FIX` and list every issue.

Every action that changes a visible state must be compiled as `动作前状态 -> 动作顺序
-> 动作后状态`. The pre-action state must make relevant unchanged conditions explicit,
including appearance, wardrobe, posture, gaze, hands, contact, prop ownership and
location. Dependent steps such as pick up, open, contact, apply, reveal, release or
withdraw must remain in causal order.

## Script Fidelity Contract

Read `references/content-review-contract.md` before segmentation, TSC compilation,
repair or final delivery. Structural validators do not prove semantic correctness.
Every final package requires an independently read, hash-bound `content-review.json`;
its executable gate runs before formal packaging and again before completion.
Preparation helpers must initialize semantic review as pending, never passed.

The source script is the sole authority for what happens and in what order.
The textual shot execution translates every in-scope script event into executable
prompt phases. Reference images constrain only identity, wardrobe, location and
props; they never replace, summarize or rewrite the script.

Every piece of content inside the user-defined script scope is causal backbone.
Auto must not classify any script line as secondary, decorative, redundant or
safe to remove.

Before shot planning, extract the complete in-scope script verbatim into
`script-source.txt`. Preserve every non-empty scene heading, cast line, action,
dialogue, reaction, pause, transition, insert, entrance, exit and story-relevant
sound cue in source order.

These are hard requirements:

1. Segment passages are contiguous and non-overlapping. Concatenating every segment's
   `script-verbatim.txt` in episode order must reproduce `script-source.txt` exactly.
2. The ordered per-segment `storyboard-execution.txt` files must collectively execute
   every source line. If any line is omitted, revise the textual execution before
   generating assets or prompts.
 3. Every TSC segment prompt uses the fixed production format:
    `【角色清单】`, `【资源引用】`, `【场景】`, `【站位与起始状态】`,
    the production profile's permitted number of continuous timed camera fields,
    and `【结束状态】`.
    Every visual `{{Mixed N}}` is introduced in `【角色清单】` as `主体N` with
    an observable appearance description. After that section, use only `主体N`
    for people, locations and props. Character names may remain only in voice
    ownership text and inside verbatim spoken dialogue. Never emit `CHAR###`,
    named character locks or a second alias system beside `主体N`.
    Internal `C###`, `SHOT###`, `镜头###` and `clipId` identifiers are audit metadata,
    not prompt prose; omit them from every delivered video `prompt.txt` while
    retaining them where needed for traceability in handoffs and audit files. Use
    only the timed range in a delivered phase heading, without `镜头N`.
 4. The complete source passage remains in the audit files. The final video prompt
    uses textual shot execution and does not paste the source passage or repeat
    each shot's source wording.
5. Never shorten, merge, drop or summarize exact dialogue, speakers, actions,
   reactions, pauses, entrances, exits, props, transitions, causal order or endpoints.
   Every source line is causal backbone. If all
   content cannot fit the duration or model limit, split at a natural beat or increase
   the planned duration. Never resolve a duration conflict by deleting story content.
 6. Keep one continuous scene and related action chain inside one generation segment whenever it can
      be completed within the configured model-supported maximum duration. If related material crosses a segment boundary,
      the next Prompt inherits the previous Prompt's written ending state only.
      Never use, extract, upload or claim a video tail frame as continuity input.
      The next Prompt's starting blocking must match the previous ending blocking,
      pose, facing, eyeline, hand occupancy, props, contact and unfinished action.
      The prior `【结束状态】` must contain one complete observable continuity snapshot:
      physical scene and lighting, fixed anchors, every visible character's exact
      position, level, posture, facing, eyeline, left-hand state, right-hand state,
      held-object ownership, contact, prop position, appearance state and unfinished
      action. When the next segment is a direct continuation, copy that snapshot
      verbatim into `【站位与起始状态】`; do not summarize, reinterpret or rebuild it.
 7. When a reference image conflicts with the script or textual shot execution, the script wins.
    Ignore incidental image content or regenerate the image; never alter the story to
    match a generated frame.
  8. Every prompt uses the project or user-specified visual-style suffix as a
    deterministic final style constraint. The suffix may refine rendering, palette,
    lighting and medium, but must never change story state, identity, wardrobe,
    blocking, geography, chronology or user-locked action.
  9. Before every action that changes a character, prop, garment, held object,
    posture, gaze, contact, location or visible appearance, state the complete
    observable pre-action state, then describe the action in causal order and state
    the resulting condition. Do not let a prompt jump directly to a changed state.
    For a localized appearance change, name the one exact target and freeze every
    non-target part before, during and after the action. For nail painting, identify
    the target hand and digit; only the nail physically touched by the brush may gain
    color, while every other nail remains at its recorded unchanged color.

Any missing source line, incomplete textual execution mapping, absent verbatim segment
script or prompt-coverage failure blocks TSC final compilation and video generation.

Prompt compilation is a semantic Agent operation owned by the internal TSC module,
not an external Skill or a project-specific prompt generator. For every project,
write source prompts from the finalized handoffs under `modules/tsc/MODULE.md`, run
`scripts/validate-video-prompts.cjs` for the complete set, package with
`scripts/build-episode-segment-package.ps1`, and use
`scripts/generate-segment-libtv.cjs` for dry-run or authorized execution. A
project-local preparation helper may exist, but Auto must remain able to apply its
rules and gates without treating that helper as authoritative.

## Hard Gates

1. Establish duration, aspect ratio, output root, rights boundary, generation budget
   unit, attempt limit and hard stop. Record `videoBackend` as `unselected`, `libtv` or
   `custom`; target model fields may remain unbound for backend-neutral pre-video work.
2. Before paid image generation, finalize the canon, prompts and image budget.
   `script-source.txt` and `script-coverage-report.md` must prove 100 percent
   coverage of the in-scope source script; a summary-only execution plan is not final.
   When a character, wardrobe state, location or prop lacks a suitable supplied
   reference, or the user explicitly requests a newly generated canonical asset,
   create exactly three base candidates by default. Use stable `-V1`, `-V2` and `-V3` job suffixes,
   record all three in the finalized image manifest and include all three in
   `imageLimit`. A user-specified candidate count overrides this default exactly.
   Do not generate three copies of an already supplied usable asset unless the
   user explicitly requests new asset generation, and do not
    apply this asset default to per-shot states. Each provider-failed candidate
   still follows the separate bounded `-R1/-R2/-R3` repair rule.
   Generate images only through `st2`; never substitute `st`, `st1`, `st3`,
    `st4`, the standalone `gpt-image` CLI, or another provider. `auto`, `auto images`,
    and `auto resume` call `direct_image_run` directly for all in-scope `st2` image
    batches; do not ask the user to send a separate `st2` command and never block on
    a missing authorization token, marker, continuation token, or prior plugin
    message. Start each batch only when its contracts are final. Do not pause for
    human review between these batches. Use a plain `prompts` array only when all
    tasks in the batch are text-only. Otherwise submit `jobs` with a stable `jobID`,
    final `prompt`, and zero or more per-task `referencePaths`; each path must remain
    inside the supplied Auto `projectRoot` or the current session's generated-output
    root. Never attach one shared reference set to unrelated jobs. Auto decides the
    batch composition, batch size, dependency order and number of tool calls from the
    finalized task graph; do not impose a fixed 10-task grouping policy. Wait for a
    tool call to finish and verify every requested image was generated and saved
    before starting dependent work. The finalized project manifest may
    contain any total number of in-scope image tasks, including hundreds;
    `imageLimit` records that exact project total and is not capped at 10, 30, or
    100. The provider executor hard-caps simultaneous requests at 10 independently
    of task count, so a call containing more than 10 tasks is queued through the
    same worker pool rather than denied or run all at once.
   `auto plan` and `auto video` never call the image tool.
   After all non-video images and bounded failure-repair groups are complete, check
   only whether every requested output was generated and saved. Do not inspect image
   content and do not load an image-review Skill. Present every generated candidate
   directly for human asset selection. After that decision,
    resolve user-supplied or explicitly required speaking-character voice references
    plus user-specified or story-critical sound references, compile TSC handoffs and prompts, and
    present one complete pre-video package containing every approved reference, exact
    manifests, every `tsc-handoff.yaml`, and every TSC `prompt.txt`. A count,
    directory path, partial batch, legacy prompt or
    placeholder prompt is not a complete delivery. Wait for explicit final approval;
    never infer approval from silence or begin video generation before this gate.

   Do not create a separate human data-entry gate for `character_visual_lock` or
   `wardrobe_visual_lock`. Derive explicit lock text from screenplay facts, character
   bibles, wardrobe tables, asset manifests and approved generation prompts. When an
   approved image is the only appearance authority, bind the lock to that exact
   `{{Mixed N}}` reference and use a reference-preservation contract that freezes its
   face/build, hair/headwear, garment silhouette/layers, color/material and unique
   trim without claiming to inspect or describe the pixels. Never ask the user to fill
   dozens of appearance rows already backed by approved references.
  3. Before paid video generation, require an explicit current-project video command,
     an explicitly selected video backend, completed pre-video delivery, and
     human-approved character references, location references, prop references, any
     user-required speaking-character voice references, any user-specified or
     story-critical sound references and TSC-compiled motion prompts. LibTV login,
     bound canvas and live model schema are required only when `videoBackend: libtv`.
     A missing applicable reference blocks final prompt
    compilation; Auto must not draft a substitute prompt. A voice-reference audit
    timeout does not block video generation when the user has authorized it; record
    the unresolved audio reference and continue without binding that audio node.
4. When the user explicitly selects Seedance 2.5 and specifies 15-30 second
   generation segments, use that range during planning and prompt packaging; do not
   replace it with the unknown-model 15-second fallback. Before paid video execution,
   resolve the exact LibTV model key and confirm the live endpoint supports the planned
    values. If the live schema conflicts, block execution instead of deleting story content.
   A missing or temporarily unavailable live schema never blocks story analysis,
   dramatic-beat segmentation, `script-verbatim.txt` or `storyboard-execution.txt`.
    It blocks only LibTV-specific duration adaptation, LibTV compatibility verification
    and LibTV video execution. It does not block a backend-neutral final TSC handoff,
    final prompt or `final_prevideo` package. Retry the read-only model query only when
    LibTV is selected, and distinguish the Agent model from the video target model.
5. One video generation unit has one narrative job, one dominant action chain
   and one primary camera behavior. Split overloaded clips even if 30s is allowed.
    Derive its duration from the script's action, dialogue, reaction and transition
   needs; never impose equal chunks or a fixed seconds-per-shot formula and never
   omit script content to satisfy a target duration. Treat
   reference images as role-bound identity, wardrobe, location, prop or LOOK
     controls. Asset images constrain appearance only; they do not define time zero
     or replace written shot actions. Written handoff state is
     the only cross-segment continuity mechanism.
   6. Use the complete textual shot execution to author each prompt. Feed only the current
      segment's approved character, location, prop and required audio assets. For
      related cross-segment material, copy the previous written ending state into
      the next starting blocking. Bind only character, location, prop and required
      sound assets.
    7. Generate and approve a representative pilot clip before batch video creation.
      Record its observed written ending state when a following Prompt continues
      from that state; no frame extraction or frame registration is required.
8. Treat `libtv node ... --run` as synchronous. Wait for process exit; do not
   add external polling, background execution or arbitrary timeout.
9. Never fabricate model names, schema fields, node keys, URLs, login state,
   canvas binding, generation success or downloaded files.
10. For every failed image task, regardless of whether the provider charged for
      the failed attempt, record the original failure and automatically create exactly
      three repaired replacement candidates. Submit those three candidates with a
      provider concurrency limit of 3 through a direct `direct_image_run` call; do
      not ask for another `st2`, image token, or `auto resume` command. Give each
      replacement a stable suffix (`-R1`, `-R2`, `-R3`) and apply the smallest practical prompt
      correction while preserving identity, story state, continuity and reference
      roles. This is one bounded repair group, not a replay of the failed request.
      If a replacement candidate also fails, record it but do not recursively spawn
      another repair group.
11. **Complete pre-video delivery is mandatory.** After aggregate image approval and
       before final pre-video approval or any video operation, verify that every required original image
      slot has at least one generated local image file, verbatim script and
      textual shot-execution coverage is complete, every failed slot has
      its bounded repair result recorded, every generation segment has a complete
      `tsc-handoff.yaml` and non-empty TSC-generated `prompt.txt`, and the
      package has complete image, sound-reference and prompt
       manifests. Deliver all of those artifacts together. Never call a partial image
       set, a prompt-only set or a directory-only summary complete.

## Workflow

Read `references/workflow.md` and execute its gates in order. Create each segment
from `templates/package-layout.md` and initialize episode state from
`templates/auto-state.json`. New projects use `auto-episode-package/2.3`,
`auto-state/2.2` and a locked `productionProfile`. Existing 2.1/2.0 and 2.2/2.1 projects may
resume under their recorded legacy contract without silently changing creative or
model settings.

Once `asset-requirements.json` and every image prompt are final, execute two branches
concurrently when tools and dependencies permit:

- Asset branch: generate only registry rows marked `generationRequired: true`, then
  check file existence, deliver all candidates for human review and update coverage.
- Segment-project branch: create contiguous segment passages, `script-verbatim.txt`,
  `storyboard-execution.txt`, segment folders and draft handoffs with stable
  `planned_unverified` asset slots.

Do not finalize asset-dependent `tsc-handoff.yaml`, compile final `prompt.txt`, mark
slots `package_slot_verified` or build the formal pre-video package until generated
assets pass file-existence checks and aggregate human approval. Auto does not inspect
image content or infer human approval from a candidate's existence or ordering.

When the user requests character/location/prop/sound assets packaged separately
by episode segment before LibTV node connection, create one data-only episode JSON and run
`scripts/build-episode-segment-package.ps1` using
`templates/episode-segment-package.json` as the starting schema. Keep stable `{{Mixed N}}` slots for
missing assets. This model-neutral export is a review and handoff artifact; it does
not replace the final approved-reference TSC gate or make draft prompts runnable.
For Auto 2.3 `final_prevideo`, use one shared package `outputRoot`, canonical episode
folders `第1集`, `第2集`, ... `第X集`, and exact segment folders `SEG001`, `SEG002`, ...
inside each episode. Do not append story titles to final segment folder names. Draft
and legacy package naming remains unchanged.

Apply a minimum-necessary sound policy. Never invent, request, reserve a
`{{Mixed N}}` slot for, or mention environmental ambience, room tone, reverb,
foley, sound effects or music merely because a scene could contain it. Include
such sound only when the user supplied or explicitly requested it, or when its
exact presence is indispensable to the plot, timing or transition. Always check
and report missing independent character references for visible characters and
preserve exact dialogue and speaker ownership. Report a missing external voice
reference only when the user supplied or requested one, or the selected backend
requires one. Other missing sound references are reported only when they meet the
user-specified or story-critical test, with the reason recorded.

Every segment prompt must state its intended generation duration on the first
line using the story-derived value recorded in the handoff and package JSON, for
example `生成时长：16秒。`. The packaging script verifies or adds this line
without duplicating it. Before video generation, the same duration must be
supported by and selected in the live model schema; prompt text does not override
the model's duration control.

Separate the duration, every named section, the timed-shot block, the ending state
and the final style suffix with blank lines. Use the minimum sufficient number of
timed fields within the locked profile range. Every timed field uses
`主体锁：...；各主体仅保留自身主体锁，不交换外观。` The exact
`productionProfile.prompt.endingPolicy` is mandatory immediately before the final
visual-style suffix. It always forbids video tail-frame continuity; its music clause
follows the project's locked sound plan.

After character, location and prop asset images have explicit human approval, or the
human explicitly confirms that the project has no visual-reference slots,
    record their decisions in the aggregate asset review, then generate
the fixed deliverable `资产总表.xlsx` according to
`templates/asset-workbook.md`. This is a required embedded-image workbook, not
a CSV or path-only manifest.

At every transition:

1. Validate the current artifact with `references/quality-gates.md`.
2. Write the artifact and state update atomically before starting the next stage.
3. Keep exactly one clip `in_progress`; other clips remain `planned`, `blocked`,
   `accepted`, or `downloaded`.
4. On resume, trust accepted artifacts and observed state. Do not regenerate them
   unless the user explicitly requests a revision.

For LibTV commands, follow Auto's internal `references/libtv-runbook.md` and call
the `libtv` executable directly. Do not load a LibTV Skill. The CLI's live `--help`
and model schema outrank examples in this Skill.

## Output Contract

Every delivered segment directory has one immutable filesystem contract. This is
the only valid per-segment delivery shape; names are literal and are never localized,
renamed, omitted or supplemented:

```text
<segment-folder>/
|-- 资产/
|   |-- 场景/
|   |-- 道具/
|   |-- 人物/
|   `-- 声音参考/
|-- prompt.txt
|-- script-verbatim.txt
|-- storyboard-execution.txt
|-- tsc-handoff.yaml
`-- 素材映射.txt
```

The segment root contains exactly these six entries. `资产/` contains exactly the
four named directories, even when one is empty. No per-segment missing report,
preview, manifest, image board or convenience file may be added. Missing-reference
status belongs in `素材映射.txt` and episode-level reports. `storyboard-execution.txt`
is mandatory plain text: it records shot execution that is compiled into `prompt.txt`;
it never represents or points to an additional image asset.

Only four asset categories are legal in `资产/`: character images under `人物`,
location images under `场景`, prop images under `道具`, and audio under `声音参考`.
Every `{{Mixed N}}` mapping must point to one of those four directories.

The minimum episode delivery is:

```text
script-source.txt
script-coverage-report.md
content-review.json
production-profile.json
project-inventory.json
script-preview.md
asset-requirements.json
生图需求全集.xlsx
asset-requirements-workbook-result.json
production-brief.md
asset-bible.yaml
资产总表.xlsx
look-lock.md
reference-manifest.yaml
auto-state.json
image-delivery-manifest.json
<segment-folder>/资产/场景/
<segment-folder>/资产/道具/
<segment-folder>/资产/人物/
<segment-folder>/资产/声音参考/
<segment-folder>/prompt.txt
<segment-folder>/script-verbatim.txt
<segment-folder>/storyboard-execution.txt
<segment-folder>/tsc-handoff.yaml
<segment-folder>/素材映射.txt
release-report.md
```

Do not create empty downstream artifacts for a blocked stage. Record the block
in `auto-state.json` and the release report.

The mandatory delivery immediately before video generation is narrower than the
eventual full-production delivery above. It must contain all successfully generated
independent images, exact failed/repaired image status, `image-delivery-manifest.json`,
`script-source.txt`, `script-coverage-report.md`, the locked `production-profile.json`, all per-segment
`script-verbatim.txt` and `storyboard-execution.txt` files,
all segment `tsc-handoff.yaml` and TSC-compiled `prompt.txt` files,
all required sound references and `release-report.md`.
Surface the image files themselves through visible previews or direct local links;
do not make the user infer the deliverables from counts or search the package tree.

## Completion Report

  Report only verified facts: project path, scene/clip count, planned versus
  generated duration, generated asset candidates, the exact asset delivery manifest,
per-segment TSC handoff/prompt completeness, sound-reference
completeness, LibTV generated/failed
clips, downloaded files, `资产总表.xlsx` path/status/embedded asset count, attempt
usage, blocking issues and the exact next resumable stage.

## Rights

This self-contained Auto Skill is MIT licensed. It does not load or incorporate
external Skill rule sets. The image provider, `direct_image_run` tool and LibTV
CLI retain their own service terms and implementation licenses. Named platform or
studio shorthand must be translated into observable production descriptors and
must not imply affiliation. See `THIRD_PARTY_NOTICES.md`.
