# Cinematic Still LOOK Interoperability

## Purpose

Use one stable photographic LOOK across independent storyboard/keyframe masters
without allowing style language to overwrite narrative continuity. This protocol
routes still-image photography work to the separately installed
`cinematic-prompt-engine` Skill when available and permitted by its license.

## Rights Boundary

`cinematic-prompt-engine` is a distinct third-party Skill by Leo414x, distributed
under a restricted license. See its own `LICENSE` and `UPSTREAM.md`. Personal,
non-commercial Agent use is allowed by that license; commercial integration or
commercial production use may require the author's written permission. Do not
copy its full rules into this MIT package, remove attribution, or present them as
original work.

If that Skill is unavailable or the intended use is outside its license, build a
minimal original LOOK lock from observable production facts instead of importing
its text or preset system.

## Responsibility Split

The director/shot contract owns:

- story moment and frozen visible state
- identity and age presentation
- wardrobe contract and source-clothing exclusions
- blocking, screen direction, props, location and weather
- shot scale, editorial job, handoff and continuity

The cinematic still LOOK owns only:

- camera-body realism anchor and lens family
- one motivated depth mechanism
- motivated light source, direction, fill and falloff
- palette, saturation, tonal density and restrained texture behavior
- subject-aware photographic realism
- one model-aware anti-slop treatment

When they conflict, the director/shot contract wins. The LOOK must be recomposed
around the canonical subject rather than changing the subject.

## LOOK Lock Contract

Before generating the first keyframe, record:

```yaml
look_lock_id: PROJECT-LOOK-01
camera_family: observable camera response, not marketing copy
lens_family: focal lengths and distortion behavior
depth_rule: exactly one motivated primary depth mechanism
lighting_rule: source, direction, softness, fill and falloff
color_rule: palette, saturation, skin anchor and scene-temperature allowances
tonal_rule: highlight shoulder, midtone density, black level and shadow detail
texture_rule: grain/halation/bloom budget
realism_rule: skin, material and optical clarity anchors
anti_slop_bucket: one genre-appropriate treatment
model_adapter: target still-image model and verified constraints
```

Keep the lock stable across the sequence. Scene color temperature may change
only when physically motivated; camera response, skin rendering, lens family,
tonal curve, texture scale and production realism remain coherent.

## Per-Frame Compilation

Compile in this priority order:

1. Frozen scene state and visual center.
2. Framing, blocking and continuity constraints.
3. Identity reference roles and wardrobe contract.
4. One motivated depth mechanism.
5. Camera and lens behavior.
6. Motivated lighting.
7. Color, tonal density and texture.
8. Subject-aware realism.
9. Model-aware anti-slop clause.
10. Output format and endpoint settings outside creative prose.

Never stack generic fog, haze, bloom, diffusion, shallow focus, grain and
halation at full strength. Preserve the subject and background structure before
adding atmosphere.

## Review Gate

Reject or repair when:

- style changes identity, age, wardrobe, body count or blocking
- source-reference clothing leaks into scene wardrobe
- unrelated fog or visible shafts appear without a physical medium and source
- skin becomes waxy, airbrushed, cyan or globally orange
- blacks are crushed without intent or lifted into gray noise
- background structure is smeared to simulate depth
- every scene is forced into one hue despite changing time, place or weather
- a contact sheet is redrawn instead of assembled from approved masters
