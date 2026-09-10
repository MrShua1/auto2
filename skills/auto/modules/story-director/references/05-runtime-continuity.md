# Runtime Continuity And Observed State

## Source Of Truth

`project-state.json` is the runtime canon. It stores the global plan, current revision, accepted clips, reserved beats, references, and observed endpoints.

The plan is provisional. Accepted footage is evidence.

## Compile-Next-Only Loop

1. Select the first unresolved clip whose dependencies are accepted.
2. Read only the project-state capsule, the current row from `story-spine.md`'s scene map (the scene card), current contract, and needed references.
3. Compile and lint that clip.
4. Authorize one attempt only if the clip attempt cap and project hard stop both allow it.
5. When the generation job is submitted, increment project `budget.attempts_spent` and clip `attempts_spent`. Also increment project `budget.spent` by the attempt count or estimated credit/currency charge, whether the take later succeeds or fails.
6. Generate the take outside this skill.
7. Review the selected take.
8. Record `accept`, `accept_with_deviation`, `reject`, or `repair_tail`.
9. If accepted, write the actual visible/audio end state.
10. Increment state revision.
11. Compile the next eligible clip from the observed state.

Never paste the entire film's prompt history into every turn.

## Take Decisions

- **accept:** intent and endpoint are usable.
- **accept_with_deviation:** footage is good, but observed state differs. Update canon; do not force the old plan.
- **reject:** identity, action, endpoint, or technical output is unusable. Regenerate under the budget policy.
- **repair_tail:** most of the take is usable; generate a short pickup/bridge or trim around the defect.

## Chain Policy

- Default `max_chain_depth: 2`.
- Hard maximum `3`.
- Do not seamlessly continue across scene boundaries.
- Re-anchor if identity, wardrobe, weather, layout, lens behavior, or motion quality drifts.
- Never use a fourth output-sourced extension.
- Record the source take for every extension. At a scene boundary, chain cap, or listed drift condition, apply the contract's `reanchor_rule` instead of extending again.

## Budget Authorization

- `budget.unit`, `budget.hard_stop`, and `budget.authorization_status: approved` must be set before a paid generation. A generated default is a proposal, not user authorization.
- For `generation_attempts`, increment `budget.spent` by 1 at submission.
- For `credits` or `currency`, record a dated `next_job_estimate`, block when it is unknown, and ensure `budget.spent + next_job_estimate <= hard_stop`; reconcile estimated spend with the provider's actual charge afterward.
- Do not submit if `attempts_spent + 1` would exceed the current clip's `attempt_cap`.
- Increment project `budget.attempts_spent` and clip `attempts_spent` by 1 for every submitted job. A failed, rejected, cancelled-after-submit, or accepted attempt still consumes project budget unless the provider confirms no charge.
- Crossing `warning_fraction` requires an explicit remaining-work review; crossing the hard stop blocks generation.

## Reserved Beats

Mark story actions completed by accepted clips. The next clip must not replay them. If a take accidentally completes a later beat, either accept the deviation and update dependencies or reject the take; do not let two clips repeat the same reveal.

## Context Capsule

For each compile turn, load only:

- Project ID, revision, target endpoint.
- Current scene and clip IDs.
- Relevant canonical refs.
- Completed/reserved beats.
- Last accepted observed end state.
- Current contract and chain depth.
- Budget remaining.

This keeps a 25-40 clip project stable across sessions.

## Take Review Retention

Store every review without overwriting earlier attempts:

```text
take-reviews/<scene_id>/<clip_id>/<take_id>.json
```

Keep rejected and superseded reviews for budget accounting and failure history. `templates/take-review.json` is the schema for each stored review.
