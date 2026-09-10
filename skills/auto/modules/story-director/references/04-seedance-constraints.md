# Seedance 2.0 Constraint Matrix

## Status And Authority

Treat this as a dated compiler baseline, not eternal truth. Before API execution or a hard platform claim, verify the exact target surface and current official documentation.

`as_of: 2026-07-24`

Authority order:

1. Current Volcengine Ark or BytePlus ModelArk documentation for the chosen region/model ID.
2. Current Jimeng/Dreamina UI controls for UI-only workflows.
3. High-fidelity provider schema, clearly labeled as a fallback.
4. Community skills only for prompt craft, never as final API truth.

## Conservative Compiler Baseline

| Field | Conservative rule | Confidence |
|---|---|---|
| Duration | 4-15 seconds per generation | High across current serious sources |
| Ratio | `16:9`, `4:3`, `1:1`, `3:4`, `9:16`, `21:9`, or `adaptive` | High for Ark-like surfaces |
| Resolution | Standard may expose 480p/720p/1080p; fast/mini cap at 720p unless current surface proves otherwise | Medium-high, endpoint-dependent |
| Frame rate | 24 fps reported on Ark-like surfaces | Medium-high |
| Assets | Up to 9 images, 3 videos, 3 audios, 12 files total | High across current sources |
| Video refs | Up to 3; total referenced duration no more than 15s | Medium-high |
| Audio refs | Up to 3; audio-only reference request is invalid on known Ark-like schemas | Medium-high |
| Prompt budget | Aim for <=500 Chinese characters for quality; do not assume >2000 is portable | Quality guidance high, hard cap unresolved |
| Native audio | Endpoint/model dependent; record `generate_audio` explicitly | High that it varies |

## Exclusive Generation Modes

Choose exactly one image-bearing mode:

1. Text-to-video.
2. First-frame I2V.
3. First-and-last-frame I2V.
4. Multimodal references.

Do not combine first/last-frame roles with multimodal `reference_image` roles in one API request. In a UI, `@图片N`, `@视频N`, and `@音频N` are prompt-side bindings; they do not make an invalid asset combination legal.

Mode cardinality:

- `t2v`: text only; no image, video, or audio reference roles.
- `first_frame`: exactly one image with role `first_frame`; no `last_frame` or multimodal reference roles.
- `first_last_frame`: exactly one `first_frame` image and one `last_frame` image; no multimodal reference roles.
- `multimodal_reference`: at least one `reference_image` or `reference_video`; audio cannot be the only reference; obey the per-type and 12-file caps.

Each `asset_role_map` entry must state:

```yaml
- asset_id: ASSET_ID
  type: image | video | audio
  role: first_frame | last_frame | reference_image | reference_video | reference_audio
  prompt_tag: "@图片1"
  purpose: identity | location | style | motion | audio | endpoint
```

## Do Not Emit

- `ratio: 2.35:1` as an API value. Use `21:9` or treat 2.35:1 as aesthetic language only.
- 2K/4K unless the selected console/model explicitly offers it.
- 1080p for fast/mini without current proof.
- `frames`, `camera_fixed`, `service_tier`, or legacy `/videos/generations` fields as universal Seedance 2.0 truth.
- A 30-300 second single-call request.
- First/last frames plus a full multimodal reference pack in one request.
- Photoreal real-person face references unless the selected surface explicitly authorizes them.

## Extension Rules

- An extension creates a new segment; its duration is not the total film duration.
- Bound extensions by runtime chain depth: default 2, hard 3.
- Re-anchor from canonical references at scene boundaries or after the cap.
- `return_last_frame`, status strings, paths, and model IDs are API-surface fields. Verify them before execution.

## Compiler Output Must State

```yaml
surface: jimeng-ui | volcengine-ark-cn | byteplus-modelark | unknown
surface_confidence: high | medium | low
model_variant: standard | fast | mini | unknown
mode: t2v | first_frame | first_last_frame | multimodal_reference
duration_s: 4-15
ratio: supported enum
resolution: endpoint-supported value
generate_audio: true | false | unknown
asset_role_map:
  - asset_id: ASSET_ID
    type: image | video | audio
    role: endpoint-specific role
    prompt_tag: surface binding or empty
    purpose: why this asset is required
```

If any required value remains unknown, return a planning prompt plus a validation warning, not fabricated API JSON.
