# Character And Scene Reference Workflow

## Purpose

Bind user-supplied images to explicit visual roles so the nine panels preserve identity and environment without copying irrelevant content.

## Inspect Before Prompting

For every supplied image, record:

- File/attachment ID and assigned asset ID.
- Role: `character_identity`, `wardrobe`, `prop`, `location_layout`, `location_material`, `lighting`, or `visual_style`.
- Features to preserve.
- Features to ignore.
- Which panels use the reference.
- Priority when two references conflict.

Do not identify an unknown real person or infer ethnicity, health, religion, sexuality, or other sensitive traits. Describe only visible production-relevant features.

## Role Boundaries

### Character Identity

Preserve visible face geometry, hair silhouette, age presentation, body build, and stable distinguishing features. Ignore the source background, pose, expression, and incidental objects unless separately assigned.

Source clothing is incidental by default. Preserve it only when the manifest also assigns that image a `wardrobe` role for the current panel. If scene wardrobe differs, explicitly name the source garments to ignore and the replacement garments to render.

### Wardrobe

Preserve garment type, silhouette, material, color, wear, and accessories. Do not let a wardrobe image replace the identity reference.

### Scene / Location

Preserve layout, architectural anchors, materials, palette, practical light sources, and spatial relationships. Ignore people, text, logos, temporary clutter, and vehicles unless the user assigns them as story elements.

### Visual Style

Transfer medium, texture, contrast, color behavior, and composition grammar. Do not copy a recognizable copyrighted frame shot-for-shot or import subjects from the style image.

## Conflict Priority

Default priority:

1. User's explicit written instruction.
2. Per-panel written wardrobe/blocking contract for clothing, visible body count, and screen position.
3. Character identity reference for face/body, excluding source clothing unless separately assigned.
4. Wardrobe/prop or approved continuity-frame reference for assigned items.
5. Location reference for layout/material/light.
6. Style reference for rendering language only.
7. Generated assumptions.

If two same-priority references conflict, ask the user or label a chosen canonical image. Do not blend faces or costumes arbitrarily.

## Prompt Binding

The image tool may accept attachments, image URLs, asset tags, or a multimodal message. Use the supported binding method, but keep the creative prompt explicit:

```text
Use REF_CHAR_A only for Character A's identity and hair. Do not copy its background or pose.
Use REF_WARDROBE_A only for Character A's clothing in all nine panels.
Use REF_LOCATION_01 for the room layout, window position, wall material, and light direction. Remove all people and visible text from that reference.
```

Repeat short continuity anchors in the panel list; do not rely solely on “same person” or “same scene.”

When an identity sheet visibly conflicts with scene wardrobe, use explicit replacement syntax:

```text
IMAGE 2 controls Takaki's identity and body proportions only. Ignore and do not reproduce its yellow hoodie and blue jeans.
For this panel Takaki wears exactly: white collared school shirt, plain navy cardigan, charcoal straight school trousers, black socks, black leather school shoes, dark navy school bag.
```

For face-free or partial-body inserts, enumerate anatomy and costume per screen side. State the total visible character, leg, hand, or foot count when duplication would change character identity or story continuity.

## Multi-Character Boards

- Assign one identity asset per character when possible.
- State character positions and screen direction in each relevant panel.
- Prevent face swapping: `Character A always [anchor]; Character B always [anchor]`.
- Avoid more characters than the scene needs; crowd references increase drift.
- Give every visible character a separate wardrobe line in every panel, even when faces are outside frame.
- If one supplied identity image contains an off-scene costume, repeat `identity only; ignore [named source garments]` in each affected panel prompt.

## Delivery And Privacy

- Include the reference manifest in the result.
- Report which references were actually sent to the image model.
- Do not expose local credential paths.
- Do not upload/reuse the images beyond the requested generation.
- If generation is not executed, say so and still provide the manifest and prompts.
