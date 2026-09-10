---
name: multi-image-generation
description: 生图、文生图、图生图、图片编辑、参考图生图、4K 生图。Use when the user says st, st1, st2, st3, or st4, attaches reference images, or requests fast image generation.
compatibility: OpenCode fast image plugin.
metadata:
  providers: st1,st2,st3,st4
---

# Fast Image Generation

Explicit `st`, `st1`, `st2`, `st3`, or `st4` at the start of the current user
turn starts one direct image operation. A final Chinese directive such as
`根据完整剧本出四张分镜板，用 st2 并发4` delegates preparation to the normal
agent, which submits final standalone tasks directly to `direct_image_run`.
No authorization token, continuation token, or prior marker is required. The plugin calls
the selected API in process and returns assistant-side previews from inline
image data or a validated public HTTPS provider URL. Successful originals
are also written under OpenCode's local data directory. The assistant result
renders local loopback previews and original-image links; the plugin never adds
image parts to the user's `st*` request message. Delivery does not create another
model turn. The adapter does not use PowerShell, Python, SQLite, request files,
status polling, recovery, route fallback, or automatic retries.

The installed `auto` orchestrator uses the same direct tool. Bare `auto`,
`auto images`, and `auto resume` may call it for every finalized in-scope image
task without asking the user for a separate `st2` command and without waiting for
plugin-issued authorization. Auto decides grouping and call count from project
state. Each call accepts at most 100 tasks; this payload bound does not cap the
project total.

## Routes

| Route | Endpoint | Model | Default |
| --- | --- | --- | --- |
| `st` / `st1` | `sub.g-aisc.com` | `gpt-image-2` | 1K |
| `st2` | `aihub.top` | `gpt-image-2` | 1K |
| `st3` | `sub.g-aisc.com` | `gpt-image-2` | 4K, JSON reference edits |
| `st4` | `sub.g-aisc.com` | `gemini-3-pro-image-preview` | 2K, up to 14 references |
| `stx` | `grsai.dakka.com.cn` | `gpt-image-2` | 1K only, automatic quality |

`stx` also uses `direct_image_run`. Its synchronous Grsai protocol is
`POST /v1/api/generate` with `replyType=json`; no polling or retries.
Credentials use `IMAGE_API_STX_KEY`, otherwise `IMAGE_API_STX_CONFIG` or
`%USERPROFILE%\Desktop\gaisc.json`. See the `stx` skill for route constraints.

Credentials come from `IMAGE_API_ST1_KEY`, `IMAGE_API_ST2_KEY`,
`IMAGE_API_ST3_KEY`, and `IMAGE_API_ST4_KEY` in the OpenCode process environment.
Never print or place keys in prompts or command arguments.

## Commands

```text
st1 A cinematic product photograph, 1:1
st2 2K 16:9, a rainy neon street at night
st3 4K 3:2, detailed editorial architecture photograph
st4 2K 9:16, reference 1 controls identity, reference 2 controls wardrobe
st2 并发5，一座云海中的未来城市
st2 一座云海中的未来城市，5并发
st2，10并发，根据完整剧本将001-031分别生成独立16:9分镜，再按场景拼成4张分镜板
```

`5并发`, `并发5`, `5并行`, `并行5`, and `parallel 5` request five independent
images. A call accepts 1-100 tasks, while actual provider concurrency is hard-capped
at 10 across simultaneous tool calls. One failed child does
not cancel successful children. Ordinary explicit `st*` requests are not retried.
In an Auto workflow only, each failed image task automatically becomes one bounded
three-candidate repair group (`-R1`, `-R2`, `-R3`) executed with concurrency 3,
regardless of whether the provider charged for the failed attempt.

For an ordinary image request, a parallel count is also the requested image
count. For a numbered storyboard range, it is only the maximum in-flight
provider concurrency. `001-031` defines 31 distinct jobs; `10并发` limits
those jobs to ten at a time. It must never truncate the total to ten or repeat
one generic prompt ten times.

A bare final `并发` without a number is treated as one request. State the count
for predictable cost. In delegated suffix form, bare `并发` lets the agent
choose the minimum sufficient batch size from 1-10 based on the requested
deliverables. Prefix form remains a direct route and does not expand prior context.

Exception: a prefix command that combines `分镜`, a three-digit shot range, and
`分别`, `逐镜`, or `独立` is a strict storyboard batch. It routes through the
normal reasoning agent so the full script and numbered shot list can be resolved.
The agent must submit ordered `jobs` with one distinct standalone 16:9 prompt per
shot. If board assembly was requested, it must also submit `boards` that cover
every requested shot exactly once and in order. The plugin validates all of
this before contacting a provider.

Supported aspect ratios are `1:1`, `3:2`, `2:3`, `16:9`, `9:16`, `4:3`,
`3:4`, `5:4`, `4:5`, and `21:9`. Supported tiers are `1K`, `2K`, and `4K`.
Output formats are PNG, JPEG, and WebP where the selected provider honors them.
Unsupported counts, resolutions, and aspect ratios are rejected before any paid
API request is sent.

## References

- Treat image attachments in the same explicit `st*` turn as approved references.
- Send pasted image bytes directly from memory. Do not search for paths, cache,
  copy, inspect, re-save, or materialize the images first.
- `st1`, `st2`, and `st3` accept up to four references; `st4` accepts up to 14.
- State each reference role explicitly in the prompt when using multiple images.
- `st mid` and `st1/st2/st3 mid` require exactly one source image and append a
  strict preserve-non-target instruction. `st4 mid` uses the `st1` edit route.

## Execution Contract

1. Preserve the user's route, dimensions, references, and exclusions. Preserve
   exact prompt text for direct prefix form; expand context only for delegated
   suffix form.
2. Let prefix form route to the no-reasoning image executor. For delegated work,
   prepare complete standalone prompts before execution. Strict storyboard work
   uses `jobs` with `shotID` and optional deterministic `boards`; Auto work uses
   `jobs` with stable `jobID` and optional per-task `referencePaths`. Pass
   `projectRoot` whenever local reference paths are used.
3. Call `direct_image_run` directly with `route`, one of `prompt`, `prompts`, or
   `jobs`, and any explicit dimensions or format. It requires no `request` token,
   prior marker, continuation token, or session authorization. Auto may make as
   many sequential calls as its finalized task graph requires. Concurrency is
   enforced separately from task count and never exceeds 10 globally.
4. Save full originals in OpenCode's local data directory. Render every image
   through the loopback-only local preview service in the same assistant result,
   with a link to the local original. Never mutate the user's request message.
   Bound unsaved inline previews to avoid writing large base64 payloads into
   session history. Use native tool attachments only when no visible delivery is
   possible. Do not perform visual review unless the user asks.
5. On failure, report the sanitized provider reason and a practical correction.
   For ordinary explicit `st*` requests, never retry, switch routes, or replay an
   ambiguous timeout automatically. Auto records failed task IDs and decides any
   bounded repair call from its own workflow rules; the plugin does not replay a
   failed paid request automatically.
Messages such as `continue`, `打开图片`, `什么意思`, or `再试试` are ordinary
conversation and must not contact an image provider.
