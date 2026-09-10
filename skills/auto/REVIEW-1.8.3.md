# Auto 1.8.3 Local Review

Superseded: a subsequent review reproduced five defects in 1.8.3. Do not use this
historical report as current approval. See REVIEW-1.8.4.md for repairs and scope.

The previously reported concrete counterexamples were rerun after repair:
source dialogue mislabeled as metadata, incorrect actual speaker, reversed spoken
fragments, appearance lock substituted for action, quoted undefined actor, unquoted
speech in opening state, and valid negative music wording. Invalid cases now fail;
the valid no-score/natural-sound case passes.

Verification includes the four node:test suites (content review, numbered shots,
package mapping and production safety), project-intake smoke and production-profile
smoke. The production smoke exercises both legacy and numbered formal packaging,
single-JSON stdout, actual OpenXML workbook generation, workbook reopening and
finalization. Image tests check embedded bytes, aspect ratio, hash changes and
rejection of unapproved input. Budget tests exercise reservation, replay rejection,
lock contention, invalid count and the no-video hard stop without any provider calls.

Dependencies are pinned with package-lock.json. npm audit reported zero known
vulnerabilities at local release verification. This is point-in-time evidence, not
a promise that later advisories will not appear. The exported Windows package may
include node_modules for direct use on this machine; another OS must install the
pinned runtime dependencies for that OS.

No paid image or video generation was executed for this review. No old screenplay,
confirmed asset, 100-episode delivery or approval was rewritten/reapproved. Desktop
auto A is a prior snapshot; auto B is the new reviewed local export.

Review result: no remaining blocker among the reproduced defect cases and tested
local production paths. General cinematic semantics, unrecognized screenplay syntax,
all possible natural-language phrasings, reviewer authenticity and future video
model results are outside a deterministic zero-error claim. Keep the required
independent source-to-prompt reading. Unsupported/ambiguous source syntax requires
review, not silent deletion. See references/release-1.8.3.md.
