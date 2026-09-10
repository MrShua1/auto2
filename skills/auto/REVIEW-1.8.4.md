# Auto 1.8.4 Repair And Review

## Changes

- Reject leftover unparsed speech after extracting known utterances. Numbered
  dialogue fields are fully consumed; speech in other fields cannot substitute.
- Derive source event types separately. Action cannot be relabeled screen_text,
  sound or transition to skip action evidence checks.
- Retain multiline source utterances, including blank-line continuations, with
  exact newlines. A missing continuation fails the handoff comparison.
- Distinguish offscreen O.S./OS from VO/internal voiceover. Ambiguous two-subject
  speech instructions require explicit ownership instead of guessing.
- Restore row-level validation issues, unresolved statuses, failed-generation
  issues and per-episode COMPLETE/NEED_FIX cells in the OpenXML requirement table.

## Verification Scope

Local verification: 95 node:test cases passed; production-profile and project-intake
smokes passed. The five original counterexamples were rerun: invalid content now
fails, valid O.S. passes, and the generated workbook includes computed issues and
per-episode status. Re-review also added blank-line continuation and ambiguous
speaker-owner cases before closing the reported findings.

Regression coverage includes legacy and numbered content gates, positive multiline
and offscreen speech cases, leftover speech, action reclassification, missing source
continuations, blank-line boundaries and literal screen-text quotes. Production
smoke invokes the official packager in both heading modes with invalid content,
verifies the specific rejection and checks the existing formal prompt is unchanged.
The official workbook smoke reopens the XLSX to check row-level issues and per-episode
status. Existing budget, image-byte/ratio/hash, package and finalization tests remain.

The source parser is a documented grammar, not unrestricted natural-language
understanding. Unmarked narration following dialogue is ambiguous and cannot be
silently guessed as action. Unsupported source syntax needs explicit review and a
tested parser adaptation without rewriting the original. Existing independent
semantic review requirements remain; tests do not prove reviewer authenticity or
cinematic correctness. No paid generation or real-series repair is part of testing.

Version 1.8.3's five reported findings are superseded by these fixes. The existing
100-episode delivery remains NEED_FIX. Restart OpenCode to load the updated Skill.
