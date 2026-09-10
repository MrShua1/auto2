# Auto Image Preflight And Regeneration

Latest user policy: loosen image-stage gates and automatically regenerate failed
images. This overrides old Auto repair groups and image no-retry defaults, but not
final approval, tool availability, credentials, source fidelity or video gates.

Start an image batch when its prompts, source roles, route, supported settings and
bounded attempt budget are recorded. Do not require final TSC prompts, the full
series workbook, all other batches or a human selection pause to execute a ready
independent batch. Populate those audit/workbook artifacts before final packaging.
Unapproved generated candidates may be provisional dependency references; they are
never called human-approved. Preserve source material conflicts and exact-text review.

Default maximum: three total provider attempts per logical image job, including the
first attempt. One failed attempt produces ONE new attempt, not three candidates.
Use stable IDs JOB-A2 and JOB-A3, count every attempt in the budget/ledger before
submission, and keep all successful originals. Candidate-count policy is separate:
each genuinely requested candidate has its own logical job and attempt ceiling.

Retry transient network/provider failures after 5 seconds then 15 seconds. A clearly
correctable input error gets the minimum correction that preserves the story and
reference roles; unsupported settings must not be silently downgraded. Timeout or
interruption can have been billed: record charged_status=unknown, check local output
and available provider task status first, never launch a concurrent duplicate. The
user's Auto regeneration policy permits a sequential new attempt when the prior call
has ended without a usable local result; unknown attempts remain counted as spent.

Do not retry missing credentials/tools, 401/403, exhausted balance, unsupported
settings that cannot honor the user, or safety rejections without a compliant user-
intent-preserving change. Do not switch provider/model or evade content filters.
Three failed attempts stop that job and report the blocker; other independent jobs
continue. A user can change the attempt cap or hard cost limit explicitly.

`scripts/reserve-image-attempt.cjs` reserves attempts atomically. Execute each actual
attempt through direct_image_run, not an improvised API client. The tool itself need
not hide retries: the Auto orchestrator records and submits each new attempt openly.
Never regenerate a successful asset merely because later packaging or download-link
display failed. This policy does not authorize video generation or video retries.
