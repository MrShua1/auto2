# LibTV Runbook

The installed `libtv` executable is authoritative. Do not load an external LibTV
Skill. Check live `--help` and model schema before use.
Run commands in the bound production-package directory.

## Preflight

```powershell
libtv --help
libtv account info
libtv project
libtv model search --type video
libtv model <exact-model-key>
```

Do not proceed on `401`, a missing `projectUuid`, an ambiguous model, or an
unverified schema. Use `libtv login web` or `libtv login phone` only when the
user is ready to authenticate. Select the intended workspace/canvas with the
documented `workspace use` and `project use` commands.

## Upload Clean Inputs

Use unique, traceable names. The standard Auto segment command
`../scripts/generate-segment-libtv.cjs` performs this upload and mapping step and
should be preferred for normal segment generation.

```powershell
libtv upload "SEG001-M01-character" -t image --resource ".\assets\character.png"
libtv upload "SEG001-M02-location" -t image --resource ".\assets\location.png"
```

Save returned `nodeKey` values in `auto-state.json`. Do not upload a contact
sheet as the primary I2V input.

## Create And Run Video Node

The following is a shape, not a fixed model contract. Substitute only fields
present in the fetched schema. `model` takes the exact display name, not key.

```powershell
libtv node create "CLIP001-video-v01" -t video `
  --left "CLIP001-start-v01" `
  --prompt "<compiled motion prompt>" `
  -s "model=<exact modelName>" `
  -s "modeType=<schema-supported mode>" `
  -s "ratio=<schema-supported project ratio>" `
  -s "duration=<verified seconds>" `
  --run
```

For multi-reference mode, obey input type and count rules. Cross-segment continuity
never uses an extracted or generated video tail frame; it uses the accepted written
ending state.

`--run` blocks until terminal state. Wait for exit and preserve stdout JSON. Do
not add external polling, background execution or a short timeout.

## Prompt Placeholders

When a model prompt must explicitly bind connected assets, use unique quoted
display names:

```text
{{Node "CLIP001-start-v01"}}
```

Use `{{Node <nodeKey>}}` when names are duplicated. A placeholder is valid only
when that node is connected to the target video node.

## Query And Download

```powershell
libtv node "CLIP001-video-v01"
libtv download -n "CLIP001-video-v01" --without-ai-watermark --vip -o ".\downloads"
```

For every future accepted image or video download, use
`--without-ai-watermark --vip` when the logged-in account has valid membership
rights and the user has authorized no-watermark delivery. Verify the local file
after download. If the account cannot honor the preference, report the failure;
do not silently deliver a watermarked substitute.

Cross-segment continuity uses the accepted written ending state only. Every submitted
reference must be a declared character, location, prop or required sound asset.

## Optional Assembly

Use `video-clip` only after all source clips are accepted. Simple assembly can
connect videos in order and run. Precise editing requires valid
`clipTimelineData` at the node's `data` level via `-u`, not guessed `-s` model
settings. Preserve exact source node IDs and time ranges.

## Failure Handling

- Authentication failure: stop at `libtv-login`.
- Missing canvas binding: stop at `libtv-canvas`.
- Schema rejection: refetch schema and repair settings; do not switch models silently.
- Compliance rejection: surface the exact image/node and required action.
- Generation failure: record terminal JSON and consume one attempt; do not retry.
- Download failure: keep the accepted remote node recorded and mark local delivery blocked.
