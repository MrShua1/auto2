# Auto Production Workflow

## Stage 0: Intake And Preflight

Resolve from the script and user context:

```yaml
title: required
source_script: required
target_duration: required
aspect_ratio: required
video_backend: unselected | libtv | custom
target_video_model: optional until a backend-specific runnable command is requested
output_root: required
rights_mode: original | licensed-adaptation | restricted
image_budget: approved calls or currency cap
video_budget: approved calls or currency cap
max_attempts_per_clip: required
hard_stop: required
production_profile: required before shot planning
PROJECT_ROOT: required for every new project
```

Proceed on explicit, low-risk assumptions for creative fields. Ask one concise
question only when a missing answer changes aspect ratio, rights, paid cost or the
explicitly selected backend's usable model surface.

Instantiate `templates/production-profile.json` for every new project and persist
the same locked profile in `auto-state.json` and `episode-package-config.json`.
It must explicitly record category, genre/form, medium, audience, tone, observable
LOOK, prompt language, timed-phase bounds, continuity and sound/music policy. Auto
has no default genre, visual medium, aspect ratio, target model or LOOK. Existing
2.1/2.0 and 2.2/2.1 projects resume under their recorded contract unless the user
explicitly authorizes a migration and revalidation.

Before paid generation, inspect `PROJECT_ROOT` for prior user-confirmed asset decisions
or approved Auto manifests and record exactly what was found. Then always write and
present `script-preview.md` for the script portion requested by the user. When no
narrower portion is requested, preview the complete script as a concise episode/scene
index with representative exact evidence. Preview is mandatory whether confirmed
assets exist or not.

Run `scripts/scan-project-root.cjs --project-root <PROJECT_ROOT>` and recursively
inventory all files. Fully read every candidate screenplay, asset manifest and wardrobe
table in a usable native form. List image candidates by path, hash and size, but do not
decode, inspect or judge their content. Record unsupported, inaccessible
or ambiguous files as blockers. Filename, directory or manifest membership identifies
a candidate only; it never makes an asset valid.

Preflight Auto's internal rule files and only the execution tools required by the
active stage. Never load a Skill outside the Auto directory. For LibTV video execution,
`libtv --help` must work.
When `videoBackend` is `unselected`, backend capability, login and canvas fields remain
explicitly unbound and do not block final backend-neutral prompts or `final_prevideo`.
When a backend is selected, its authoritative capability contract is required only
before backend compatibility is claimed or execution begins. LibTV login, canvas
binding and node connection are mandatory only for the LibTV adapter in Stage 7.
Failure to fetch a live schema does not block story work, dramatic segmentation,
textual shot execution, backend-neutral TSC compilation or `final_prevideo`. When
LibTV is selected, it blocks only LibTV compatibility verification and LibTV execution;
retry `libtv model search --type video` and exact `libtv model <modelKey>` before
recording that blocker. The OpenCode Agent model is never evidence for, or a substitute
for, a video-backend capability contract.

## Stage 1: Story And Canon

Read `internal-production-rules.md`. Extract the entire in-scope source verbatim to
`script-source.txt`; do not begin from a synopsis. Preserve every non-empty source
paragraph, including scene headings, cast lines, actions, dialogue, reactions,
transitions and story-relevant sound cues. Then extract the story spine, scenes,
exact dialogue, emotional turns and ending.
Build stable IDs:

```text
CHAR###  LOCATION###  PROP###  LOOK###  SCENE###  CLIP###
```

Write `asset-bible.yaml`, `look-lock.md` and `reference-manifest.yaml`. Identity
references control face, hair, age and build. Written wardrobe and approved
wardrobe references control clothing. Location references control geography,
not incidental people or text.

For every canonical character identity, distinct wardrobe state, location and prop,
decide whether an existing supplied reference is suitable or a new asset image is
required, including any explicit user request for new generation. Record the asset
candidate policy in `auto-state.json`. If the user did
not specify a count, plan exactly three base candidates per newly generated asset;
if the user specified a count, use it exactly. Use ordered `-V#` job IDs. Existing
usable supplied assets are references, not generation tasks, and are not tripled.

Before deciding what to generate, build `asset-requirements.json` from the complete
script with one row per required visible version:

- one stable entity for every visible character
- one version for every distinct character wardrobe or visible state
- one version for every location at a distinct script-required time or lighting state
- one version for every prop at a distinct visible state
- all applicable episode IDs, scene IDs and exact script evidence on every version

Existing images cannot define or shrink this universe. Match candidates by filename,
directory, asset manifest and wardrobe table without inspecting image content. Only an
exact file explicitly confirmed by the user, with unchanged hash, is
`approved_existing`. Unconfirmed candidates remain `pending_human_review` and are
delivered directly for a decision. A row becomes `rejected_invalid` only by human
decision. Preserve approved files byte-for-byte and never regenerate, overwrite,
delete, move or rename them.

Finalize one image prompt for every generation-required version and build
`生图需求全集.xlsx` with `scripts/build-image-requirements-workbook.ps1`. This workbook
contains exactly one generation-required asset version per row and must exist before
any paid image generation.

Gate: no shot planning until the verbatim extraction is complete and recurring
identity, wardrobe, location, prop and LOOK definitions are concrete enough to
repeat verbatim.

## Stage 2: Beat, Blocking And Clip Plan

Once the version-level asset universe, image prompts and script coverage are locked,
start the segment-project branch concurrently with Stage 5 asset generation whenever
execution resources permit. This branch may create segment folders, contiguous
`script-verbatim.txt`, full `storyboard-execution.txt` and draft `tsc-handoff.yaml`
with stable `planned_unverified` slots. It must not finalize approved reference paths,
compile final `prompt.txt` or mark any slot `package_slot_verified`.

Apply `internal-production-rules.md`. Break scenes into pressure-changing beats, then block
bodies and props in space before choosing cameras. Establish the action axis,
screen direction, entrances, exits, eyelines and fixed landmarks.

The generation-segment count is the number of declared contiguous narrative segments,
not source lines, paragraphs, scanned files, shots, assets or missing artifact files.
Never multiply the segment count by the number of required files. Before reporting
segment progress, assert that the count equals the unique segment IDs in the segment
plan and `episode-package-config.json`. Report missing artifacts separately, for
example: `16 segments; 3 missing storyboard files; 5 missing handoffs; 16 missing final
prompts`.

Before selecting a camera, create a `spatial_topology_lock` for every scene with a
named traversable/non-traversable surface or boundary. Record each character's
floor/elevated level, start/end anchor, allowed corridor, forbidden surfaces and a
camera view that visibly proves the relation. Treat this as a blocking contract, not
decorative scene description. For example, if one character is on a bed and another
approaches from below, the plan must explicitly keep the first on the mattress and
the second on the floor path beside the bed; a shot that makes the second appear to
emerge from or cross the mattress fails planning.

Create one `CLIP###` per video generation by default. Each clip records:

- the complete contiguous source passage assigned to the clip
- narrative job and exact duration
- start, primary action and visible end state
- shot size, lens, angle, camera height and one camera behavior
- character positions, wardrobe and prop state
- spatial topology lock when the scene contains a named surface or boundary
- receiver-in and handoff-out
- dialogue/audio strategy
- continuity risks and fallback

Durations must sum to the target. Honor an explicit user-selected model and duration
range during planning. For Seedance 2.5 with a user-specified 15-30 second range,
every generation segment must be within 15-30 seconds. Live schema verification is
still required before paid execution, but the unknown-model 15-second fallback must
not override the user's declared SD2.5 planning constraint.

Estimate enough duration for every exact line and visible action. If the requested
episode duration cannot contain the complete source at natural dialogue and action
speed, report the conflict and revise duration or split strategy. Never omit or
summarize source lines to force them into the requested runtime.

## Stage 3: Textual Shot Execution

Apply `internal-production-rules.md`. Preserve all user-locked shots. Create the
coverage map, sequence logic, shot contracts and edit relationships. Ensure each
shot has a unique editorial job and adjacent shots preserve axis, eye trace,
motion, sound or a deliberate rupture.

Map every source line to one or more explicit shot rows. Generate
`script-coverage-report.md` by comparing the verbatim source, ordered segment
passages and textual shot execution. Concatenated segment passages must exactly equal
the source, and the shot mappings must cover 100 percent in source order. Extra visual
coverage may elaborate staging but may not replace, reorder or delete source lines.

Write one `storyboard-execution.txt` per segment. Asset generation may proceed in its
parallel branch after the complete script, asset requirement universe and image prompts
are final; final TSC compilation remains blocked until textual execution passes
sequence, continuity, 100 percent script coverage and prompt-contract gates.

## Stage 4: Prompt Plan

Use the complete textual shot execution to derive each segment's continuous action
phases, camera transitions, blocking, dialogue timing and visible endpoints. Store
that plan in `storyboard-execution.txt`; do not create `prompt.txt` yet.

Do not compile video prompts at this stage. Record the planned generation segments,
story-derived durations, complete assigned source passages, dialogue, reference
categories and natural split points. Final prompt compilation belongs exclusively
to TSC after the required character, location, prop and sound references are
identified and approved. The final prompt must not paste the source script or
repeat a shot's source text after its textual action description.

## Stage 5: Asset Generation

This is the asset branch that runs in parallel with Stages 2-4 after the Stage 1
requirements workbook passes. Generate only rows where `generationRequired` is true,
and always write to a new non-conflicting path.

If there are zero generation-required rows, record the image execution stage as
`not_required` and continue without checking for `direct_image_run`. Tool availability
is a blocker only when this stage has actual generation work.

Apply `internal-production-rules.md` for observable photography and LOOK layers,
then apply `internal-image-execution.md` and call the
`direct_image_run` tool. Use its `st2` route exclusively for generation and
reference edits. `st2` targets `aihub.top` with `gpt-image-2`. Do not fall back
to another `st*` route, the standalone `gpt-image` CLI or another provider. An
eligible `auto`, `auto images` or `auto resume` invocation may execute all
in-scope image batches in this workflow directly, so do not ask for a separate
`st2` command and do not wait for an authorization token or marker. Before each
batch, verify that every required image has a final
contract, count only ungenerated images, and verify that this exact count is no
more than the remaining approved image budget. The finalized manifest determines
the total image budget and may contain hundreds of tasks; there is no 10-, 30-,
or 100-image workflow-wide cap.
Submit one complete `prompts` array for an entirely text-only batch. When tasks
need different references or stable output names, submit `jobs` as
`{jobID, prompt, referencePaths}`. Bind only the references declared by that
task's contract; paths must be under the supplied Auto `projectRoot` or the
same session's generated-output root. Never inherit a previous batch's shared
references or send one task's inputs to another task. Auto chooses batch boundaries,
batch sizes and call count from dependencies, cost, finalized contracts and the
current project state; there is no required 10-task partition. Call
`direct_image_run` with `route: "st2"`, the chosen settings, `projectRoot`, and
either `prompts` or `jobs`. The provider executor hard-caps simultaneous requests
at 10 globally and queues any additional tasks. Wait for a call's complete result
before starting dependent work. Auto may call the tool again directly for every
later batch; no token or continuation parameter is used. A provider failure enters
the bounded three-candidate repair flow defined by the Auto hard gates. A
local-save shortfall blocks delivery until the image is recovered or accurately
recorded as failed; dependent video work never starts from a missing image.

Before prompt compilation, generate every planned base asset candidate. The default,
when the user gave no asset candidate count, is three independent jobs per generated
asset with `-V1`, `-V2` and `-V3` suffixes. All base
  candidate jobs count toward the finalized image budget. If human review is deferred
  until the aggregate asset gate, bind the first existing generated file in
  manifest order as `provisional_unapproved` only for planning; this is not a visual
  ranking or approval. Keep and deliver every successful candidate so the user can
  select the canonical version.

After base assets and bounded failure repairs are complete, check only whether each
expected generated output file exists. Do not decode, inspect, rank, describe, approve
or reject image content. Deliver every generated result directly for aggregate human
review.

Update each registry row's generation status, final path and hash. Keep generated rows
as `generated_pending_human_review` until the user decides. Recompute full-series and
per-episode coverage and rebuild `生图需求全集.xlsx`. Use `STATUS=COMPLETE` only when
every required version is `approved_existing` or `approved_generated`, with zero
missing, human-rejected and pending-human-review versions for the full series and every
episode. Otherwise use `STATUS=NEED_FIX` and list every unresolved row.

After base assets and bounded failure repairs are complete, build
`image-delivery-manifest.json`. It must enumerate every asset image with its asset
 ID, segment usage, candidate/repair role, local path and
  generation batch. Present all asset candidates for one human review together with
  the manifest and the required-reference checklist for each planned video segment.
  Do not present only counts, only a directory or only prompts.

The user may approve all images, approve specific image paths, or reject specific
images. Record that decision in `auto-state.json`. Silence, a successful provider
response, file existence or an agent opinion is never final approval. A user-rejected
image follows the explicit review decision and approved budget; provider-failed image
tasks follow the automatic bounded three-candidate repair rule. Do not ask for a
standalone `st2` command. TSC compilation and video generation remain blocked until
this aggregate review is complete and every required reference has a resolved status.

After aggregate human approval, build `<output-root>/资产总表.xlsx` using
`templates/asset-workbook.md` and `scripts/build-asset-workbook.ps1`. Do not build
an approval workbook from provisional or unreviewed candidates. Embed approved
images into the workbook; do not use external image links as the visual content.
Keep one asset per row and place its approved variants horizontally.
Create `人物`, `场景` and `道具` sheets even when one category is empty, and record
asset IDs, source paths and approval timestamps in the hidden `_索引` sheet. The
workbook must pass G5 after approval. Rebuild it when the human decision changes
the approved asset set.

## Stage 6: TSC Reference Handoff And Prompt Compilation

Enter `modules/tsc/MODULE.md`. TSC is the exclusive video-prompt compiler. Auto
must not draft, optimize, repair or replace its prompt prose.

Stage 6 is the join point for the parallel branches. It starts only after the segment
project branch passes complete textual coverage, the asset registry is `COMPLETE`,
generated files pass mechanical existence checks and aggregate human approval is recorded.
Do not add a bulk `character_visual_lock_review` pause here. Compile character and
wardrobe locks from project text, or bind `reference_preservation` locks to exact
approved references when no textual appearance description exists. Ask only when a
required version has neither an approved reference nor sufficient textual evidence;
that is an unresolved asset, not a request for mass appearance-text entry.
Execute this exact order for the complete configured segment set:

1. Finalize every `script-verbatim.txt`, `storyboard-execution.txt` and
   `tsc-handoff.yaml`.
2. Use `modules/tsc/MODULE.md` as the sole semantic rule set to write every source
   `prompt.txt`; no external Skill or project-local prompt rules may replace it.
   TSC uses the locked production profile rather than any Skill-wide creative default.
3. Run `scripts/validate-video-prompts.cjs` and repair through the TSC module until
   the complete configured set passes.
4. Run `scripts/build-episode-segment-package.ps1 -Force` to create the delivery
   package, then run `scripts/validate-prevideo-delivery.cjs` before final approval
   or LibTV execution.
5. In `/分集` and bare `auto`, mark the pre-video package complete and stop here. In video-capable
   Auto modes only, `scripts/generate-segment-libtv.cjs` without `--run` may perform
   its local segment preflight; only explicit video authorization permits `--run`.
   A `draft_model_neutral` package is never runnable. A `final_prevideo` package
   still requires completed pre-video validation and a non-`episode_prevideo` state
   with `videoSideEffectsAllowed: true` before any LibTV mutation.

Project-local scripts may transform project-specific source data into the required
handoff artifacts, but they do not own Auto rules and are not required execution
interfaces. Auto's reusable validation, packaging and LibTV commands all live under
this Skill's `scripts/` directory.

1. If a video backend is selected, resolve its capability contract. For LibTV, a
   read-only `libtv model search --type video` and `libtv model <modelKey>` is preferred
   when available. Retry both queries before declaring the schema unavailable. If the
   exact schema still cannot be fetched, record only a LibTV adaptation/execution
   blocker without inventing fields and continue all backend-neutral story,
   segmentation, storyboard, TSC and packaging work. When `videoBackend: unselected`,
   record `capability_status: unbound` rather than reporting a missing LibTV schema.
   `/分集` does not log in, bind a canvas, upload or create nodes.
2. Record supported `modeType`, input types/counts, ratio, resolution, duration,
   sound and other schema-backed settings.
6. Derive generation-segment boundaries and durations from complete dramatic
   passages, action chains, dialogue delivery, reactions and transitions. Do not
   divide by a fixed duration. Then adapt to the model's supported duration values,
   splitting only at a natural beat when required. Write the resulting value as
   the first line of each TSC prompt in the form `生成时长：N秒。`, synchronized
   with the handoff and package JSON.
    7. Instantiate `templates/tsc-handoff.yaml` per generation segment. Include the
   exact complete text in `script-verbatim.txt`,
   complete mapped shot execution in `storyboard-execution.txt`, exact dialogue,
    character references, location references,
    approved prop assets and voice samples only when supplied, explicitly requested or
    required by the selected backend. Add
   environmental audio, sound effects or music only when supplied or explicitly
   requested by the user, or indispensable to plot, timing or transition.
   Include prop references whenever appearance or ownership matters.
    8. Assign every reference an explicit role and exact local path. Character,
    wardrobe, location and prop assets are visual references only; they do not
    define time zero or replace textual shot actions.
9. Map every approved local reference to an exact deterministic `{{Mixed N}}`
   package slot and mark it `package_slot_verified`. This verifies local file and
   role ownership, not a LibTV node connection. Stage 7 later replaces these slots
   with actual connected node placeholders.
10. When required references remain unresolved, TSC may compile a non-deliverable
    internal draft with deterministic `planned_unverified` placeholders. Unbound
    backend/model fields do not make an otherwise complete backend-neutral prompt a
    draft. The draft must contain the complete textual execution for its segment.
 11. Block final compilation when a visible-character reference or a user/backend-required
      speaking-character voice reference is missing or unapproved. An audio-reference audit timeout
      does not block an explicitly authorized video run; record the timeout and omit
      that external voice node from the run. Also block for a location, prop or
    other sound reference when the user explicitly required it, the approved plan
    already declared it, or it is indispensable to the story. A
    reference can be `not_applicable` only when the script and user decision make
    that category genuinely irrelevant.
     12. Have TSC compile final `prompt.txt` from the complete handoff. Run
      `node <auto-skill-root>/scripts/validate-video-prompts.cjs --project-root <project-root>`.
      Validate its
      verbatim script coverage, textual shot execution, reference coverage, exact dialogue,
    profile-governed prompt format, written ending-state continuity mapping and causal
    order without
     rewriting TSC prose.
     13. Before accepting the prompt set, verify every state-changing action has an
     explicit pre-action state, ordered causal steps and visible post-action state;
     verify the locked visual-style suffix is present at the end of every prompt.
     Verify every visual `{{Mixed N}}` is defined as `主体N` in `【角色清单】`, all
     later visual references use only that subject number, every timed field uses
      `主体锁`, and the ending contains the exact profile ending policy. The validator must pass for the complete
      configured segment set before packaging, approval or LibTV execution.

Do not emit a runnable command until the model display name and fields are known.

### Optional model-neutral segment export

When the user needs a filesystem handoff before LibTV model binding, define the
episode and per-segment asset order from
`../templates/episode-segment-package.json` and run
`../scripts/build-episode-segment-package.ps1`. Package characters, locations,
    props and sound references inside each segment.
Preserve a deterministic `{{Mixed N}}` slot for every declared asset, including
missing assets, and record missing status in `素材映射.txt` and episode-level reports.
This export must remain incomplete when it contains missing or unapproved required
references. A `/分集` package with all required references approved, every slot marked
`package_slot_verified`, final TSC prompts and passing pre-video validation is a
complete backend-neutral `final_prevideo` delivery. It is not runnable until a backend
and model are selected and a backend-specific compatibility check passes.

The package builder verifies the configured model duration range, exact first-line
duration, exact per-segment source section, complete textual execution and exact
episode reconstruction from the ordered segment source passages.

Do not declare optional ambience, room tone, reverb, foley, sound effects or music
just to make a package appear complete. Undeclared optional sounds receive no token,
prompt prose or missing-asset entry. Always declare and check visible-character
identity references. Declare speaking-character voice references only when supplied,
explicitly requested or required by the selected backend. For any other
story-critical sound declared without a supplied file, record the exact narrative
reason that makes it required.

## Stage 7: Explicit Video Authorization And Backend Adaptation

Do not enter this stage because bare `auto` completed, assets were approved or a
pre-video package exists. Require `auto video` or an equally explicit current-project
instruction to generate video. Atomically record the exact command and authorization
time, switch to a video-capable control mode and set `videoSideEffectsAllowed: true`
only after the package, selected backend, model, budget and applicable account gates pass.

If `videoBackend` is still `unselected`, ask for the backend/model choice at this stage,
create a backend-specific derivative contract and revalidate compatibility. Do not
rewrite or invalidate the backend-neutral pre-video package.

When LibTV is selected, use the commands in `libtv-runbook.md` with live-schema substitutions.

The standard Auto entry is `scripts/generate-segment-libtv.cjs`. It accepts any
`SEG###`, reads that segment's final TSC prompt and ordered asset mapping, checks
    the configured model's live schema, reuses existing named nodes, uploads only missing
assets, connects them in mapping order and waits synchronously when `--run` is
present. An existing incomplete node blocks rather than creating a duplicate. It is
dry-run by default:

```powershell
node <auto-skill-root>/scripts/generate-segment-libtv.cjs --project <canvas-uuid> --segment SEG002
node <auto-skill-root>/scripts/generate-segment-libtv.cjs --project <canvas-uuid> --segment SEG002 --run
```

For a related cross-Prompt continuation, copy the previous Prompt's complete written
`ending_state` into the next Prompt's `【站位与起始状态】`. The state must cover
blocking, pose, facing, eyeline, hand occupancy, props, contact and unfinished
action. Do not extract, upload or bind a video tail frame. A different physical
scene starts from its own written setup.

Upload the pilot segment's approved character, location, prop and sound references
only. If a voice upload reports an audio-audit timeout, record it and continue the
authorized run without that external voice node; do not wait for the audit. The
accepted observed end state is recorded as text for the next related segment; it is
not converted into an image input.
Create uniquely named nodes,
connect only declared references, run synchronously and save stdout terminal JSON
as `libtv-result.json`.

Review the actual clip and classify:

```text
accept | accept-with-deviation | reject | repair
```

Record actual start/end state, identity, wardrobe, geography, prop, camera,
dialogue/audio and deviations in `take-review.json`. The accepted observed end
state becomes the next clip's truth.

## Stage 8: Controlled Batch

After pilot approval, process clips in narrative dependency order. Independent
clips may be prepared in parallel, but paid video generations run only within
the approved concurrency and budget. Never auto-retry a failed clip.

After each accepted clip:

1. Update `auto-state.json`.
2. Update the next dependent clip's receiver-in state.
3. Recompile its prompt if the observed state differs.
4. Run its generation only after the contract remains valid.

After three failed attempts, redesign the shot rather than adding adjectives:
shorten, simplify, tighten, split, move action off screen,
or replace it with reaction/insert coverage.

## Stage 9: Download And Delivery

Download accepted LibTV nodes to `downloads/` with
`--without-ai-watermark --vip` whenever the account has valid membership rights.
Do not claim a local deliverable until the file exists, and do not silently
substitute a watermarked file if the no-watermark request fails. Optional assembly
may use a LibTV `video-clip` node only when requested and after accepted clips and
edit order are known.

Write `release-report.md` with verified paths, durations, attempt usage, failures,
accepted deviations, missing audio/subtitles/score and next repair actions.

## Resume Rule

`auto resume` reads `auto-state.json`, verifies referenced artifacts still exist,
and continues from the first blocked or unresolved gate. It never repeats an
accepted paid generation. When the unresolved stage requires a new approved image
batch, call `direct_image_run` directly; otherwise do not call the image provider.
