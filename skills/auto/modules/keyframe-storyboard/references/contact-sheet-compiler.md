# Adaptive Contact-Sheet Compiler

## Purpose

Compile `N` approved 16:9 storyboard stills into a combined review board without forcing a 3x3 layout or inventing filler panels. Independent frames remain the authoritative keyframes.

Every source panel must remain exactly 16:9 inside the board. Scale proportionally only. Never crop, stretch, squash, expand, outpaint, or redraw a panel to fill a cell. Neutral whitespace is allowed and preferred whenever it is needed to preserve every panel's full 16:9 frame.

## Layout Selection

| Panel count | Layout | Canvas guidance |
|---:|---|---|
| 1 | single frame | 16:9 |
| 2 | 1 row x 2 columns | 16:9 board, two equal cells |
| 3 | 1 row x 3 columns | wide board or individual frames when readability matters |
| 4 | 2 rows x 2 columns | 16:9 board |
| 5 | individual frames preferred | If a 2x3 board is required, the sixth cell must be a neutral slate added in post, never a generated story beat |
| 6 | 2 rows x 3 columns | 16:9 board |
| 7-8 | 2 rows x 4 columns | wide board; unused cell for seven is a neutral slate added in post |
| 9 | 3 rows x 3 columns | 16:9 board |

Never ask the image model to fill an unused cell. Assemble odd-count boards from approved frames in post. Board cells are containers, not alternate crops: letterbox or leave neutral whitespace around a 16:9 panel when the cell ratio differs.

## Prompt Order

When model-generated contact sheets are explicitly requested, write the prompt in this order:

1. Canvas contract: one image, exact `N`, exact rows/columns, clear gutters, reading order.
2. Scene continuity: location, time, weather, light direction, event.
3. Character continuity: exact identity/wardrobe/props and reference role limits.
4. Visual grammar: medium, palette, contrast, composition, depth behavior.
5. Panel list: `PANEL 1` through `PANEL N`, once each.
6. Board behavior: progressive states, no duplicates, no drift.
7. Negative rules: no extra/missing/merged panels, accidental text, UI, logos, identity or continuity drift.

## Clean And Labeled Modes

- `clean` is the default: no generated words inside panels.
- `labeled` uses only short panel numbers in a consistent gutter and warns that generated text may fail.
- Exact labels, timecodes, and captions should be added after generation.

## Prompt Skeleton

```text
Create one single horizontal storyboard contact sheet with exactly [N] equal story panels in a [ROWS] by [COLUMNS] layout, clean neutral gutters, read left to right and top to bottom.

Scene continuity: [location, period, time, weather, light direction, event].
Character continuity: [identity, wardrobe, props]. Preserve the same character identity and scene geometry in every relevant panel.
Reference binding: [asset IDs, roles, preserve/ignore rules].
Visual grammar: [medium, palette, contrast, lens/composition behavior, texture].

PANEL 1: [one frozen state].
...
PANEL N: [one frozen final state].

The panels form one continuous clip. Preserve identity, wardrobe, props, location, time, screen direction, and light direction. [clean/labeled instruction].
Negative: no extra panels, no missing panels, no merged panels, no duplicate state, no identity drift, no accidental text, no logo, no watermark, no app UI.
```

## Preferred Assembly

When independent frames already exist, assemble the board deterministically from those files. Do not regenerate a combined sheet, because regeneration can alter faces, clothes, props, and scene geometry. Verify each embedded panel remains 16:9 and pixel-identical apart from proportional resizing; whitespace is not a defect.
