# Internal Image Execution Rules

Auto D latest override: read auto-d-image-retry.md. Ready independent image batches
may begin before whole-series workbooks/final prompts are complete. Failed jobs
receive at most three total sequential attempts, not mandatory three-child repair
groups. Mandatory tool/credential/source-text and final-approval gates remain.

When `asset-requirements.json` contains `generationRequired: true` rows, Auto uses the
installed `direct_image_run` execution tool as a tool, not an external Skill. If no row
requires generation, this tool is not required and its absence is not a blocker. Never
load or read an image-generation Skill during an Auto task.

## Route

- Use the user's selected route; use `st2` only when no route is selected.
- `stx` uses Grsai gpt-image-2, 1K and automatic quality only. Never substitute VIP.
- Read `auto-d-portability-and-materials.md`. Supplied materials must be role-bound
  reference inputs to relevant scene/prop jobs, not archive-only or blank placeholders.
- Preserve the planned resolution, aspect ratio and output format.
- Submit text-only tasks as `prompts`; submit stable IDs or references as `jobs`
  containing `jobID`, complete `prompt` and per-task `referencePaths`.
- Reference paths must remain under the supplied Auto `projectRoot` or the current
  session's generated-output root.
- Attach only references declared by that task's contract, up to route limits.

## Batching And Execution

STX runtime reliability update: completed images are persisted individually before
batch completion. Each job has a separate 10-minute generation timeout after acquiring
its provider slot, then an independent 2-minute download/validation/conversion budget;
the provider cap remains 10. Prefer manageable independent batches for interactive
progress, not hundreds of prompts in one long host call. Do not mistake batch size
for concurrency. User cancellation stops queued submissions and active requests.
Read per-job status JSON and tool jobResults to distinguish not_submitted,
provider_failed, generation_timeout, download_timeout, download_failed, invalid_image,
conversion_failed, generated_not_saved, saved and submission_outcome_unknown before any
Auto retry reservation. An already-generated image's transient GET download may be
retried up to three times by the tool; these are not new paid generation attempts.
Never regenerate a saved job (including saved with cancelled=true), or automatically
replay a local download/validation/conversion/save failure or timeout as a new POST.
Host interruption may still leave unknown charged work; status is evidence, not a
refund guarantee. Asset-only prompts should contain necessary visible requirements,
not unrelated screenplay events or gratuitous negative sensitive keywords; preserve
the actual user intent and safety boundaries without trying to evade moderation.

STX validates complete image decoding while retaining original bytes when the
format matches. Filename collisions (including Windows case folding and truncated
IDs) block before paid submission; choose distinct task IDs. Existing saved files
are never replaced: atomic hard-link publication falls back to non-atomic exclusive
copy on unsupported filesystems. A crash can leave a partial copy; file existence
without a completed saved status does not prove successful archival. A
generated_not_saved result includes save errors and must not count as archived.
Native image processing is checked for cancellation/timeout after completion, not
forcibly interrupted. Cancellation during an in-progress save preserves completed
files and records cancelled=true separately from the saved phase.

- Call `direct_image_run` directly with the selected route, `projectRoot`, settings,
  and either `prompts` or `jobs`. No authorization token, marker, continuation
  token, or separate user `st2` command is required.
- Never expose provider credentials.
- The finalized manifest defines total task count. Maximum provider concurrency
  is 10 globally and does not cap the total image count or Auto's number of calls.
- Auto decides batch boundaries and may call the tool again whenever the finalized
  task graph has more independent or newly unblocked image work.
- Do not pause for human review between in-scope image batches.

## Base Asset Candidates

- Before every new character/wardrobe image job, read `character-asset-standard.md`
  and include its mandatory left single portrait/right two stacked views in the
  actual prompt. The right-top clothing view excludes head and neck by framing;
  the right-bottom back view includes the head and rear hairstyle. One composite
  remains one candidate/job, and all candidates use the same required layout.
- For each canonical character, wardrobe state, location or prop that requires
  generation, use the effective candidate count recorded by the production plan:
  three when the user gave no count, otherwise the exact user-specified count.
- Submit each base candidate as an independent stable job named
  `<ASSET-ID>-V#`. Do not use a provider `copies` option as a substitute for
  separately identified jobs and result records, and never duplicate one saved
  output file to fill multiple base-candidate slots.
- Count every base candidate job in the finalized manifest and `imageLimit` before
  calling the provider. Failure-repair jobs are recorded separately and do not
  retroactively change the planned base-candidate count.
- Generate all planned base asset candidates before dependent state edits. Until
  human review, downstream work may use the first mechanically
  valid candidate in declared manifest order only as a provisional reference;
  mark that binding `provisional_unapproved` and never describe it as selected or
  approved.
- Preserve every successful candidate for aggregate human review. The user may
  approve one or more variants for a canonical asset.

## Failure Repair

- Preserve successful outputs from a partial batch.
- Every failed original image task creates exactly one repair group with three
  corrected jobs named `<original>-R1`, `<original>-R2`, `<original>-R3`.
- Execute that group with maximum concurrency 3 regardless of whether the failed
  original was charged.
- Apply the smallest practical correction while preserving identity, story state,
  continuity, framing purpose and reference roles.
- Never replay the failed original request automatically.
- A failed repair candidate is recorded and does not create another repair group.

## Mechanical Verification

For every result record task ID, clip ID, source batch and exact local path. A missing
required output file blocks complete pre-video delivery. Do not decode or otherwise
inspect the image.

## Requirement And Delivery Verification

- Before generation, every job must correspond to one `asset-requirements.json` row
  with `generationRequired: true`; valid existing rows never become jobs.
- Never choose an existing valid file as an output path. Never overwrite, rename,
  move or delete a valid asset.
- After generation, check only whether each expected generated output file exists. Do
  not decode, inspect or judge image content.
- Deliver every generated result directly for the aggregate human decision without
  ranking, filtering, describing, approving or rejecting it.
- Reconcile full-series and per-episode version coverage. Keep `STATUS=NEED_FIX` until
  missing, human-rejected and pending-human-review counts are zero everywhere.
