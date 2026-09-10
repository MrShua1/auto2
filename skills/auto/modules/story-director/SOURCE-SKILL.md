---
name: ai-short-film-director
description: "AI短片剧本、AI电影、AI漫剧、文生视频、图生视频、分镜脚本与Seedance/即梦工作流。Use when creating or revising a 1-10 minute AI-generated narrative from story brief through timed scenes, asset bibles, shot contracts, keyframes, model-ready prompts, continuity state, EDL, pickups, audio post, and release QA. Do not use for traditional screenplay formatting, novels, or live-action-only shooting scripts."
license: MIT
compatibility: "Agent Skills-compatible hosts; Chinese-first; model-agnostic core with a Seedance/即梦 adapter."
metadata:
  version: "1.1.0"
  updated: "2026-07-28"
  scope: "ai-generated narrative shorts"
---

# AI Short Film Director

Create production-ready AI narrative shorts, not traditional screenplays and not a pile of generic cinematic prompts.

## Non-Negotiable Rules

1. Plan globally, generate locally. Build the full story and shot map, but compile only the next unresolved clip.
2. Treat every generation as an observed take. The accepted take's actual end state overrides the planned end state.
3. Use scenes as re-anchor units. Never extend one generated video indefinitely; default chain cap is 2, hard cap is 3.
4. Lock canonical character, location, prop, wardrobe, and style definitions before shot planning. Before paid generation, also approve every visual/audio reference required by the selected mode; text-only T2V may use locked text canon without media assets.
5. Give each clip one primary narrative job and one dominant visible action. Avoid action stacks and abstract emotion-only direction.
6. Keep technical endpoint constraints outside creative prose. Validate the target surface before compiling prompts.
7. Keep score, subtitles, and final mix in post unless the target endpoint and user explicitly require native generation.
8. Budget for failed takes. Estimate 1.5-2.0 attempts per primary clip and stop at the agreed hard limit.
9. Never claim continuity from prose such as "keep the same character" alone. Track state, references, and handoffs explicitly.
10. Do not reproduce copyrighted films shot-for-shot. Preserve high-level themes only unless the user owns adaptation rights.
11. Build editorial coverage, not action-state diagrams. A scene needs purposeful changes of scale and viewpoint: environment or tactile detail, spatial relation, performance/reaction, and an afterimage when the story needs them. Every insert must establish space, pressure, time, causality, transition, or character choice.
12. Dialogue must alter the relationship, expose a mismatch, force a choice, or leave a consequential non-answer. Do not use dialogue to narrate visible actions. Put sync dialogue in stable close or medium framing; use off-screen dialogue, voiceover, silence, or ambience during complex movement.
13. Generate storyboard masters as independent 16:9 frames. Contact sheets are deterministic layouts of approved frames and may use whitespace; never crop, stretch, outpaint, or redraw frames to fill a board.
14. Original identity references outrank storyboard frames, pose, environment, wardrobe, and style references for face geometry, features, hairline, hairstyle, age presentation, and body proportions. Uploaded-reference metadata is not visual approval; visibly wrong faces must be rejected.
15. Lock one observable still-image LOOK before keyframe generation. When the user requests prestige-TV, Hollywood, Netflix-like, HBO-like, named-show, DP-inspired, or LOOK-transfer treatment, route the photography layers through the separately installed `cinematic-prompt-engine` Skill. Its camera, depth, lighting, color/texture, realism, and anti-slop layers may refine rendering only; they never override story state, identity, wardrobe, blocking, props, geography, or continuity.

## Route The Request

| Request | Load | Deliver |
|---|---|---|
| Vague idea or adaptation | `references/01-story-design.md`, `references/02-asset-bible.md` | Brief, story spine, scene map, adaptation boundary |
| Full 1-10 minute plan | `references/01-story-design.md` through `references/05-runtime-continuity.md`, `references/09-cinematic-coverage-dialogue.md`, plus `references/07-qa-repair-budget.md` | Story, dialogue script, bibles, timed shotboard, project-state seed, budget plan |
| Storyboard or shot list | `references/03-shotboard.md`, `references/09-cinematic-coverage-dialogue.md`, `templates/shotboard.csv` | Timed clips with editorial shot coverage, handoffs, dialogue, and audio intent |
| Image/keyframe prompts | `references/02-asset-bible.md`, `references/03-shotboard.md`, `templates/reference-plan.md` | Reference plan and clean start/key/out frames, not storyboard grids as I2V masters |
| Cinematic still LOOK or LOOK transfer | `references/10-cinematic-look-interop.md`, then the separate `cinematic-prompt-engine` Skill when installed and licensed for the intended use | One approved LOOK card/lock plus per-frame photography layers that preserve narrative and continuity contracts |
| Seedance/即梦 prompt | `references/04-seedance-constraints.md`, `references/06-prompt-compiler.md` | One linted current-clip paste pack |
| Continue an existing clip | `references/05-runtime-continuity.md` | Take review, observed-state update, next contract or re-anchor |
| Bad output or regeneration | `references/07-qa-repair-budget.md` | Failure diagnosis, smallest repair, budget decision |
| Editing, pickups, delivery | `references/08-edit-audio-delivery.md` | EDL, pickup queue, post-audio map, release QA |

Do not load every reference for a single-clip request. Use progressive disclosure.

## Workflow Gates

| Gate | Required result | Stop condition |
|---|---|---|
| G0 Brief | Duration, aspect, audience, platform, model surface, rights mode, budget | Unknown rights boundary; missing approved budget unit/hard stop before paid generation; unknown exact surface blocks executable settings/API JSON but permits a labeled planning prompt with a validation warning |
| G1 Story | Logline, emotional promise, ending, 5-8 scenes for a five-minute film | No causal escalation or decisive ending |
| G2 Assets | Canonical IDs and locked text definitions; approved media for every selected image/audio-bearing role; one observable still-image LOOK lock when keyframes will be generated | Missing text canon; before generation, any mode-required media is absent or unapproved; keyframe generation has only vague brand adjectives and no observable LOOK lock. T2V needs no media roles |
| G3 Sequence | Scene and clip map; durations sum to target; chain flags | Any clip exceeds endpoint limit or has no narrative job |
| G4 Current contract | Planned start/action/end, refs, audio, transition | A declared dependency lacks an accepted state; not applicable to `CLIP001` with no dependencies |
| G5 Prompt lint | Endpoint-valid, concrete, compact prompt | Conflicts, unsupported parameters, vague filler |
| G6 Take review | Accept, accept-with-deviation, reject, or repair-tail | No actual endpoint observation |
| G7 Canon update | Revision increment and next start state | Planned state overwrites observed state |
| G8 Picture lock | EDL from accepted takes; pickups resolved | Missing clip, bad boundary, or continuity blocker |
| G9 Release | Post score/subtitles/mix and final QC | Rights, duration, audio, text, or identity failure |

## Default Five-Minute Scale

- 5-8 scenes.
- 25-40 primary clips, normally 4-15 seconds each.
- 3-5 clips per scene, then a deliberate cut or reference re-anchor.
- Estimate attempts as `ceil(primary clips x attempt multiplier) + ceil(pickup reserve clips x pickup attempt multiplier)`; do not use a fixed attempt range.
- Compile only Clip 01 initially. Compile Clip N+1 after Clip N is accepted and observed.

## Artifact Contract

For a full production request, produce these artifacts in order:

1. `production-brief.md`
2. `story-spine.md`
3. `asset-bible.yaml`
4. `dialogue-script.md` when characters speak or voiceover carries story
5. `reference-plan.md` when visual/audio references must be created, acquired, or approved
6. `shotboard.csv`
7. `project-state.json`
8. `budget-plan.md`
9. `current-clip-contract.yaml` instantiated from `templates/current-clip-contract.yaml`
10. `current-clip-prompt.md`
11. `take-review.json` after generation
12. `edit-decision-list.csv`, `pickup-queue.md`, `audio-post-map.md`, and `release-qa.md`

Use the templates under `templates/`. If the user wants only a concept, script, or storyboard, stop at the corresponding gate rather than emitting empty downstream files.

## Output Style

- Default language: Chinese. Keep IDs, schema keys, filenames, and model parameters in ASCII.
- Separate story intent, still-image prompt, video-motion prompt, audio intent, and endpoint settings.
- Use exact seconds and visible state changes. Do not use "cinematic", "masterpiece", or "high quality" as substitutes for composition, light, blocking, motion, or texture.
- State assumptions and confidence for model constraints. Never present one provider's proxy fields as universal API truth.
- Translate brand shorthand such as `Netflix级`, `HBO感`, or `电影感` into observable camera, lens, depth, motivated-light, color, tonal-density, texture, and anti-slop decisions. Do not imply affiliation with a named studio or reproduce a copyrighted frame.
- Return production artifacts before explanatory commentary.

## Exclusions

Do not use this skill for:

- Fountain/FDX formatting, script coverage, novel prose, or long-form writers' rooms.
- Pure live-action scheduling, call sheets, lens packages, or actor blocking without AI generation.
- Pure API execution, paid generation, credential handling, or model pricing comparisons.
- Unlicensed prompt archives or shot-for-shot imitation.
- Generating every clip prompt before observing prior accepted footage.

## Provenance

This is a deduplicated synthesis of licensed AI-video production methods. See `THIRD_PARTY_NOTICES.md` for pinned sources, license boundaries, retained ideas, and explicitly excluded material.
