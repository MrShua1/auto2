# Auto 1.8.3 Review And Migration

## Fixed Defect Classes

- Source dialogue is extracted separately and reconciled with the handoff. Source
  narration cannot be labeled metadata simply to skip execution.
- Actual shot utterances are compared with reviewed source text, owner, delivery
  and order, rather than checking that the same string occurs somewhere in a prompt.
- Action evidence cannot consist only of a subject label or an appearance lock.
- Numbered shots retain ten fields, multiline field values and the existing
  project action-state contract. Speaker text is distinct from action actors.
- State sections reject tested speech/replay variants, including unquoted shouting.
  Named landmarks are not mistaken for speech. Natural environmental/action sound
  remains permitted; explicitly locked no-score policy only governs music.
- Chinese alias detection recognizes tested direct action usages without replacing
  substrings in unrelated words. It is not a general Chinese entity recognizer.
- Video budget reserves output count before uploads/run with an exclusive lock,
  durable reservation record and replay guard. A failed/unknown attempt stays charged
  against the attempt budget pending explicit reconciliation. A stale lock after a
  crash blocks execution; do not remove it before checking the prior process/job.
- Workbook entrypoints retain their input-validation gates and use the bundled
  OpenXML builder. It preserves image ratio and bytes, reopens both workbooks,
  records hashes and rejects stale/corrupt workbooks during final validation.
- Packager stdout is one JSON object; validator diagnostics use stderr. Formal
  staging/rollback behavior and no-video mode remain in force.

## Existing Projects

Do not regenerate approved assets or rewrite source scripts. Rebuild old workbook
results lacking workbookSha256/sourceInputSha256 through the official entrypoints;
old flags alone do not prove a workbook's current validity. Regenerate hash-bound
content evidence after changing any covered artifact. Persisted timed prompts retain
their old heading mode; new or explicitly revised prompts use numbered_fields_v1.
An unrecognized source-dialogue syntax is a review blocker, not permission to edit
the user's original text. This release does not repair existing Wild Tiger prompts
or change the 100-episode delivery from NEED_FIX to COMPLETE.

## Review Limits

Tests cover the reported concrete counterexamples, local budget accounting,
workbook image embedding/hash/reopen checks and backend-neutral final packaging.
No paid image/video calls are part of release testing. Natural-language validators
cannot establish unrestricted cinematic meaning, authentic reviewer identity,
all possible Chinese phrasing, image aesthetics or future video-model compliance.
Independent whole-source semantic reading and authorized take review remain required.
Do not describe passing regression tests as a mathematical zero-error guarantee.

The local OpenXML CLI is an implementation interface; production callers should use
the official PowerShell workbook entrypoints, which enforce the full registry and
approval input checks before invoking it.
