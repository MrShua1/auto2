# `/分集` Control Mode

`/分集` means: take one complete screenplay through every Auto stage required before
video generation, deliver a fully validated pre-video episode package, and stop. It
is Auto's `episode_prevideo` mode, not a synonym for splitting text only.

## Input Boundary

- One invocation owns one explicit `PROJECT_ROOT`, one complete screenplay scope and
  one episode boundary.
- `$ARGUMENTS` may contain a screenplay path, an already attached screenplay, an
  existing Auto project root to resume, and explicit overrides.
- When no source is named, use one unambiguous screenplay in the current context. Ask
  one concise question when there is none, more than one, or the source contains more
  than one possible episode.
- There is no default aspect ratio, video backend, target model, segment duration
  range, genre or LOOK. Derive and lock a project `productionProfile` from the script
  and user context. Leave `videoBackend: unselected` when the user has not chosen an
  execution backend. Ask one concise question only when a missing choice changes
  format, rights or paid cost. Never guess rights.
- For a new project, default the working root to `<script-stem>-Auto` and delivery
  root to `<script-stem>-制作包` beside the source unless the user provides paths.
- Before all generation, check recorded user-confirmed assets, always preview the
  requested script portion, recursively scan `PROJECT_ROOT`, fully read all scripts,
  manifests and wardrobe tables, and list image candidates without content inspection.

## Authorization And Hard Stop

Invoking `/分集` authorizes Auto to execute the finalized non-video image manifest
through `direct_image_run` on route `st2`. The exact finalized manifest count becomes
`budget.imageLimit`; never exceed it. An explicit user cap overrides this authorization
and blocks execution when the planned count is higher.

Initialize and preserve these state values:

```json
{
  "control": {
    "mode": "episode_prevideo",
    "invokedBy": "/分集",
    "terminalStage": "pre_video_delivery_complete",
    "videoSideEffectsAllowed": false,
    "readOnlyLibTVPreflightAllowed": true
  },
  "budget": {
    "videoLimit": 0,
    "videoUsed": 0,
    "hardStopPolicy": "no_video_side_effects"
  },
  "video": {
    "inScope": false,
    "generated": 0,
    "status": "excluded_by_control_mode"
  }
}
```

The following are always forbidden in this mode:

- `libtv upload`
- any `libtv node create`, `libtv node update` or node run
- `generate-segment-libtv.cjs --run`
- video download or assembly
- any image-to-video, text-to-video or video-edit provider call

Read-only `libtv --help`, account, project and model-schema queries are allowed only
when LibTV is the selected or requested backend. They must not upload media or mutate a
canvas. Missing LibTV or its schema is not a pre-video blocker while
`videoBackend: unselected` or `custom`; do not invent compatibility.

## Execution Sequence

New or explicitly revised prompts use `numbered-shot-contract.md`: numbered-only
shot headings, ten mandatory fields and physical-only start/end inheritance. Keep
the existing segment duration/shot-count locks and the fixed package layout.

Read `content-review-contract.md` before segmentation or repair. Independently read
every completed segment and write hash-bound `content-review.json` at episode level
before formal packaging. Missing/stale evidence blocks completion but does not alter
user locks, approved assets, source text, sound policy or video authorization.

1. Initialize or resume `auto-state.json` in `episode_prevideo` mode. A resume must
   keep the same terminal stage and video hard stop.
2. Preview the requested script portion, extract the complete source to
   `script-source.txt`; establish canon, rights,
   duration and aspect ratio, then lock the project production profile. Record the
   selected video backend/model when known; otherwise keep it explicitly unbound.
3. Create contiguous generation segments and complete textual shot execution. Ordered
   `script-verbatim.txt` files must reconstruct the source exactly and coverage must
   be 100 percent.
4. Build the version-level asset universe and `生图需求全集.xlsx`. Reuse only exact
   files previously confirmed by the user with unchanged hashes; preserve them and
   deliver every other candidate for review. Generate only missing or human-rejected versions.
5. In parallel, execute finalized image batches through `direct_image_run` route
   `st2` and build asset-independent segment project files. Apply
   bounded failed-task repairs, mechanically verify outputs and build
   `image-delivery-manifest.json`.
6. Check only whether every expected generated output file exists. Present all
   candidates directly for aggregate human
   selection; keep `NEED_FIX` until all missing, rejected and pending-review counts are
   zero. Persist the decision
   before continuing. File existence, provider success or Agent preference is not
   approval.
7. Resolve every required visible-character, location, plot-critical prop and
   explicitly required/story-critical sound reference. External speaking-character
   voices are optional unless the user or selected backend requires them.
   Missing or unapproved required references block completion.
   Compile character and wardrobe visual locks autonomously from textual project data
   or bind a `reference_preservation` lock to each exact approved reference. Never
   introduce a bulk `character_visual_lock_review` questionnaire for already approved
   versions.
8. Build and reopen-validate `资产总表.xlsx` with
   `scripts/build-asset-workbook.ps1` after approval.
9. Build every `tsc-handoff.yaml`; compile all prompts only through
   `modules/tsc/MODULE.md`; run `scripts/validate-video-prompts.cjs` for the complete
   configured set.
10. Build the fixed delivery tree with `scripts/build-episode-segment-package.ps1
    -Force`. Missing slots may be reported by the packager, but any missing required
    slot prevents `/分集` completion.
    For Auto 2.3 final delivery, all episode configs share one `outputRoot`; use
    `episodeFolder: 第1集`, `第2集`, and so on, with exact `SEG###` folders inside each
    episode. Do not append story titles to final segment directory names.
11. Set `preVideoDelivery.status` to `ready_for_validation`, run
    `scripts/validate-prevideo-delivery.cjs`, then set it to `complete` only after the
    validator passes. Stop without entering Stage 7.

## Human Decisions And Resume

Do not pause between internal planning, generation or mechanical-validation batches.
Pause only when Auto cannot truthfully choose:

- source/episode ambiguity
- rights ambiguity
- an explicit cost cap conflict
- aggregate asset selection or rejection
- a required voice/sound/reference that cannot be generated under the approved plan

Before pausing, write every completed artifact atomically, update `stage`, `status`,
`blockers` and `updatedAt`, and show the exact files or candidates involved. A later
`/分集 <same-project-root>` continues the first unresolved gate and never repeats an
accepted paid image job.

## Control Operations

The argument after `/分集` may be a screenplay path or an existing Auto project root.
These operations preserve the same `episode_prevideo` lock:

- **New project**: provide one complete screenplay; initialize the project and begin
  at intake.
- **Continue**: provide the existing project root; resume the first unresolved gate.
- **Status**: report `stage`, `status`, blockers, artifact paths and video counters
  without advancing a gate.
- **Revalidate**: rerun applicable mechanical validators without inferring approval
  or marking completion.
- **Stop/cancel**: record the paused or cancelled decision, retain completed artifacts
  and require an explicit later continuation decision.

No operation bypasses aggregate image approval, required sound/reference approval,
the workbook result, prompt validation or `validate-prevideo-delivery.cjs`. `/分集`
never changes its video hard stop to make a request runnable.

## Completion Definition

`/分集` is complete only when all of these are true:

- source reconstruction and textual execution coverage are 100 percent
- every required reference exists and has explicit human approval
- all image failures and bounded repairs are recorded
- sound references are complete
- `资产总表.xlsx` and its validation result pass
- every segment has the exact six-entry package layout
- every TSC handoff and final pre-video prompt is complete
- prompt-set validation passes with no internal planning identifiers
- the formal delivery contains no missing required mapping
- `validate-prevideo-delivery.cjs` passes
- state records zero video usage and the no-video hard stop

Prompt validation, a successful package copy, or a directory path alone never means
`/分集` is complete.
