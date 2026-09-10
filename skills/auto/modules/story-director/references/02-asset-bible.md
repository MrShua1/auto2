# Asset Bible And Reference Locks

## Purpose

Create a canonical source of identity for people, locations, props, wardrobe states, and visual grammar. Generated video outputs are observations, not canonical identity references.

## Stable IDs

Use ASCII IDs:

- Characters: `C001`, `C002`
- Locations: `L001`, `L002`
- Props: `P001`, `P002`
- Wardrobe states: `W_C001_01`
- Scenes: `SC001`
- Clips: `CLIP001`
- Keyframes: `KF_CLIP001_START`, `KF_CLIP001_END`

Never rename an ID after generation begins. Add revisions instead.

## Character Lock

Record only features that distinguish identity on screen:

- Age band and build.
- Face geometry and two or three stable identifiers.
- Hair silhouette and color.
- Default wardrobe plus scene-specific wardrobe ID.
- Posture, movement rhythm, and habitual gesture.
- Voice language, register, and delivery speed if dialogue is generated.
- Forbidden drift: age change, hairstyle change, extra accessories, costume substitutions.

Use front, three-quarter, profile, and full-body references where the target surface allows them. Avoid overloading a request with redundant portraits.

## Location Lock

Record:

- Layout and spatial anchors.
- Entry/exit points and screen direction.
- Time of day and practical light sources.
- Materials, dominant colors, and weather state.
- Objects that must persist between clips.
- Forbidden drift such as window relocation or day/night change.

## Prop And Wardrobe State

Track stateful objects explicitly: unopened/opened letter, intact/broken phone, dry/wet coat, full/empty glass. State transitions belong in the clip contract and project state.

## Style Lock

Define observable rules, not artist-name imitation:

- Medium and texture.
- Contrast and color temperature.
- Lens family or perspective behavior.
- Camera stability and movement limits.
- Composition grammar.
- Atmosphere and weather behavior.
- Negative rules: no text, no logos, no watermarks, no identity morphing, no anatomy duplication.

If the user asks for a living artist/director style, translate it into high-level visual characteristics rather than copying signature shots.

## Per-Scene Reference Map

Each scene should list only the canonical references it needs. Re-anchor at a scene boundary or after chain depth reaches its cap. Do not promote a generated frame to the permanent character bible unless the user explicitly approves a canon revision.

## Text Canon Versus Media References

- A locked text canon is required for every project and is sufficient to plan all modes.
- `t2v` requires no media assets. It may proceed from locked text canon after the mode is explicitly selected; record the higher continuity risk.
- `first_frame`, `first_last_frame`, and `multimodal_reference` require the exact approved media roles defined by the endpoint constraint object.
- Draft prompts, candidate images, and unreviewed generated frames are not approved references.
- Use `templates/reference-plan.md` to record required roles, candidates, approval, and canonical paths.
- A project may pass planning G2 with text canon while remaining blocked for paid image-bearing generation until required media are approved.

## Clean Keyframe Rule

An I2V master should be one clean frame. A multi-panel storyboard grid is for review, not a video-generation reference. Do not bake subtitles, arrows, labels, frame borders, or shot numbers into clean keyframes.
