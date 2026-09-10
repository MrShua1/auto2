---
name: cinematic-storyboard-director
description: "电影级分镜板、镜头语言、逐镜提示词、人物服装连续性、LOOK锁和生图前质检。Use when generating or regenerating multi-shot cinematic storyboard frames/contact sheets and the task must coordinate story coverage, shot scale, lens, angle, composition, depth, lighting, identity, wardrobe, motion physics, anti-slop, IP safety, reference roles, and deterministic board assembly. Do not use for one unrelated concept image or video-only prompts."
license: MIT
compatibility: "Agent Skills-compatible hosts; Chinese-first; orchestrates installed storyboard, cinematic-director, cinematic still, and Seedance specialist Skills."
metadata:
  version: "1.1.0"
  updated: "2026-07-28"
  scope: "cinematic multi-shot storyboard orchestration"
---

# Cinematic Storyboard Director

Generate an edited cinematic sequence, not a set of similarly framed attractive
images. This Skill coordinates other installed Skills and blocks image generation
until every shot has a complete camera, continuity, reference, and LOOK contract.

## Trigger Boundary

Use for:

- 电影级分镜板、镜头语言、逐镜生图、连续分镜、contact sheet
- regenerating a storyboard whose style is attractive but coverage is flat
- multi-shot scenes requiring identity, wardrobe and location consistency
- prestige-drama, premium-streaming, Netflix-like, HBO-like or DP-inspired stills
- independent storyboard masters followed by deterministic board assembly

Do not use for:

- one isolated concept image with no edit relationship
- video-motion-only prompting after storyboard frames are already approved
- traditional screenplay formatting
- direct API operation with no creative/continuity decisions

## Orchestration Rule

Apply every installed Skill that is materially relevant to the current generation.
Do not claim that unrelated Skills were applied. Load and record the applicable
matrix from `references/applicable-skill-matrix.md` before prompt compilation.

Required for a character-bearing cinematic storyboard:

1. `ai-short-film-director` for narrative job, editorial coverage and transition.
2. `cinematic-director` for shot function, coverage, action-pivot cuts, shot-size progression, profile/reaction/reverse coverage and 180-degree/30-degree geometry.
3. `gpt-10s-nine-grid-storyboard` for minimum sufficient states, independent 16:9 masters, reference manifest and board assembly.
4. `cinematic-prompt-engine` for observable still-image camera/LOOK layers and model-aware anti-slop, subject to its separate restricted license.
5. `seedance-camera` for explicit shot scale, angle, camera relationship and future movement endpoint.
6. `seedance-characters` for identity role isolation, named blocking, wardrobe and anatomy stability.
7. `seedance-lighting` for physical source, direction, temperature, fill, falloff and reflections.
8. `seedance-style` for brand-safe production descriptors and layered visual style.
9. `seedance-antislop` for removal of vague filler and replacement with observable production language.
10. `seedance-motion` when the frozen frame samples an action or physical consequence.
11. `seedance-copyright` when named IP, studios, films, characters, logos, songs or likeness-sensitive assets appear.

Skills such as audio, VFX, filter troubleshooting, pipeline operations and language
vocabularies are conditional. Mark them `N/A` when their domain does not affect a
still storyboard request; do not inject irrelevant rules into prompts.

## Non-Negotiable Gates

1. **User shot directions are immutable.** Explicit user-supplied shot order, subject, scale, viewpoint, angle, screen direction and action instant are `LOCKED`. Automated coverage may fill open fields or report a conflict, never silently rewrite a lock.
2. **Coverage before generation.** Define the edited sequence and each shot's unique editorial job before writing image prompts.
3. **One shot, one visual argument.** Every shot has one visual center, one primary depth mechanism and one dominant camera intent.
4. **Scale progression has meaning.** Do not repeat the same wide/medium framing across a board unless the repetition is an intentional match.
5. **Camera language is literal.** Shot scale, focal length, aperture/depth behavior, camera height, angle, composition, subject placement and screen direction are mandatory.
6. **Frozen state is physical.** Name actor/object, action threshold, force, consequence and visible endpoint. A still depicts one instant, not a sequence.
7. **Identity and wardrobe are separate.** Original identity images control face, hair, age and build. Written wardrobe and approved continuity frames control clothes. Name forbidden source garments.
8. **Lighting is motivated.** Name source, direction, temperature, fill, shadow behavior and reflections. Atmosphere exists only when physical medium and source justify it.
9. **LOOK cannot flatten coverage.** Keep camera response, tonal curve, skin rendering and texture coherent while allowing lens, scale, angle and composition to vary by editorial job.
10. **Generate individual masters first.** Every panel is an independent 16:9 image. Contact sheets are deterministic layouts of approved masters with neutral whitespace when needed.
11. **Metadata is not approval.** API success, image count and reference hashes never replace human identity, wardrobe and visual review.

## Workflow

### 1. Restore The Edit

Load the director shotboard and write a sequence coverage map:

- tactile/mechanical detail
- spatial establish
- subjective/information view
- performance/reaction
- afterimage or transition

Use only views whose removal would lose space, pressure, information, relationship,
causality or transition. Delete decorative inserts.

### 2. Build The Skill Matrix

Load `references/applicable-skill-matrix.md`. Record `APPLIED`, `CONDITIONAL`, or
`N/A` with a concrete reason. If a required Skill cannot load, read its local
`SKILL.md` directly and record the fallback; do not silently omit it.

### 3. Lock Canon

Create:

- user-authored shot lock with sequence order and per-shot locked fields
- identity role map
- per-character wardrobe contracts
- forbidden source garments
- location geometry and weather anchors
- prop ownership/state
- screen-direction rule
- project LOOK lock
- approved continuity anchor frames

Identity references outrank LOOK for identity. Written wardrobe outranks clothing
visible in identity sheets. Story state outranks all rendering references.

### 4. Write Shot-Language Contracts

Instantiate `templates/shot-language-contract.yaml` once per independent frame.
Every field marked `REQUIRED` must be concrete before generation.

Copy user-supplied directions into `user_direction_lock` before adding director
choices. Suggestions may populate only fields not listed in `locked_fields`.
Audit the compiled prompt against the lock; a mismatch is a hard block.

The contract must explain why the cut exists and what changes from the preceding
shot. A focal length or angle is invalid if it is selected only because it looks
cinematic.

### 5. Lint Coverage And Prompts

Load `references/pre-generation-lint.md`. Block generation for:

- missing editorial job or cut relationship
- a generated shot that changes any user-locked field or sequence position
- repeated scale/angle without a reason
- vague `cinematic`, `epic`, `beautiful`, `dynamic` language replacing decisions
- missing focal length, camera height, composition or depth mechanism
- conflicting movement stack
- unassigned character action or ambiguous pronouns
- missing wardrobe item or forbidden source garment
- unmotivated fog, particles, shafts, fill or reflections
- style/IP shorthand without descriptive production translation
- contact-sheet generation before independent-frame approval

### 6. Generate In Anchored Phases

Default sequence:

1. Generate high-risk identity/wardrobe/location anchors first, normally 3-4 candidates each.
2. Human-review and select anchors.
3. Generate remaining independent frames in parallel from approved contracts.
4. Generate 2-3 candidates for fragile shots; one for low-risk details only when the user accepts that risk.
5. Review every frame against its contract and adjacent shots.
6. Promote selected candidates to official masters; archive rejects.
7. Assemble contact sheets deterministically from masters.

Parallel generation is allowed only after each job has its own complete contract.
Parallelism does not justify one generic prompt shared by every shot.

### 7. Review The Edit, Not Only Frames

Review at three levels:

- **Frame:** identity, wardrobe, anatomy, prop, light, focus, material, output size.
- **Cut:** scale contrast, eye trace, screen direction, action match, visual/sound bridge.
- **Sequence:** coverage diversity, location comprehension, emotional progression, LOOK continuity and redundant shots.

Reject technically clean images when they weaken the edit.

## Prompt Assembly Order

For each independent still, compile concise natural prose in this priority:

1. Frozen narrative state and visual center.
2. Exact shot scale, angle, camera height, focal length, composition and screen position.
3. Identity role map, character count, blocking and wardrobe contract.
4. One physical action threshold and visible consequence.
5. One motivated depth mechanism.
6. Physical lighting source, direction, temperature, fill, shadow and reflections.
7. Stable LOOK layers: color, tonal density, texture and realism.
8. Model-aware anti-slop in prose.
9. Output format and reference-role exclusions.

For GPT Image, stay concise. Remove repeated adjectives before removing identity,
wardrobe, camera, action or lighting facts.

## Output Contract

Return and save:

1. `applicable-skill-matrix.md`
2. `user-shot-lock.yaml`
3. `coverage-map.md`
4. `look-lock.md`
5. `reference-manifest.yaml`
6. `shot-contracts/SHOT_ID.yaml`
7. `prompts/SHOT_ID.txt`
8. independent candidates and selected masters
9. `take-review.json`
10. deterministic contact sheets
11. `storyboard-qa.md`

## Rights And Attribution

This orchestration Skill is MIT licensed. It does not copy or relicense the
third-party `cinematic-prompt-engine` Skill. That Skill remains copyright (c)
2026 Leo414x under its own restricted `LICENSE`; use it only within that license
and preserve its attribution. Named platform or studio shorthand must be
translated into observable production descriptors and must not imply affiliation.
