# Auto Scripts

Auto 1.8.4 uses pinned local dependencies (`npm ci --ignore-scripts`). The official
PowerShell workbook entrypoints validate inputs then call `workbook-openxml.cjs`;
Microsoft Excel COM is no longer needed on the active path. Final validation reopens
workbooks and verifies their recorded hashes. Video execution reserves output-count
budget before side effects. See `../references/release-1.8.3.md` for migration.

Final delivery additionally requires `validate-content-review.cjs --project-root
<root>` and the episode-level `content-review.json` described in
`../references/content-review-contract.md`. The official packager checks this before
replacing output; the final validator rechecks current hashes and the packaged copy.
Old final packages missing this evidence require review, not silent reapproval.

## Final Video Generation

`generate-segment-libtv.cjs` is the optional Auto-to-LibTV segment adapter. It reads
the configured final TSC prompt and ordered assets, validates the live LibTV model schema,
reuses existing named nodes, uploads missing assets, connects exact references and
creates or reuses one completed video node. An existing incomplete node blocks
instead of creating a duplicate. It is a dry-run unless `--run` is explicitly
supplied. Draft packages are never runnable; `--run` also requires completed
pre-video validation and explicit video authorization outside `/分集`.
It accepts only packages with `videoBackend: libtv`; backend-neutral or custom packages
must first be adapted and validated for the selected backend.

```powershell
node generate-segment-libtv.cjs --project <canvas-uuid> --segment SEG002
node generate-segment-libtv.cjs --project <canvas-uuid> --segment SEG002 --run
node generate-segment-libtv.cjs --project <canvas-uuid> --segment SEG003 --run
```

The model key, display name, mode, ratio, resolution, output count and sound setting
are read from `episode-package-config.json` (CLI model and resolution flags may
explicitly override configured values). Related segment continuity is carried by
the written ending state in the prompt and handoff; no video frame is uploaded.

## Episode Segment Package Builder

`build-episode-segment-package.ps1` creates a reusable delivery tree from one JSON
configuration. It copies assets without modifying source files and writes the
episode script source, exact coverage report, and each segment's
verbatim script, complete storyboard execution, TSC handoff, prompt and asset map.

Each packaged `prompt.txt` starts with the configured generation duration, such as
`生成时长：16秒。`. The value comes from `durationSeconds`; an existing conflicting
duration line stops the build.

Start new episode configurations from
`../templates/episode-segment-package.json`. New projects use schema
`auto-episode-package/2.3`, which
requires ordered segment source passages that reconstruct the episode source
exactly. Use `packageMode: draft_model_neutral` for incomplete review packages and
`packageMode: final_prevideo` after all required references and prompts are complete.
`videoBackend: unselected` is valid for a complete backend-neutral pre-video package;
LibTV model fields and schema are required only when `videoBackend: libtv`. The
new schema requires a project-specific `productionProfile`; the built package includes
the same profile as `production-profile.json`. It also requires the recursive project
inventory, script preview, version-level asset registry and image-requirement workbook.
Existing 2.1 and 2.2 projects remain readable
under their legacy contract. Selected-model duration bounds are enforced when bound;
otherwise every duration must be positive and the episode total must match. Keep
each segment's assets in exact `{{Mixed N}}` order; missing asset source paths are
valid and become reserved slots. Missing script, storyboard or prompt coverage is
never valid.

Output shape:

```text
<outputRoot>/
|-- 第1集/
|   |-- SEG001/
|   `-- SEG002/
|-- 第2集/
|   `-- SEG001/
`-- 第X集/
    `-- SEG001/
```

Each Auto 2.3 `final_prevideo` episode folder contains its episode-level files and
canonical `SEG###` folders:

```text
<outputRoot>/
`-- 第1集/
    |-- 分集说明.txt
    |-- 全片缺失素材.txt
    |-- script-source.txt
    |-- script-coverage-report.md
    |-- production-profile.json
    |-- project-inventory.json
    |-- script-preview.md
    |-- asset-requirements.json
    |-- 生图需求全集.xlsx
    |-- asset-requirements-workbook-result.json
    |-- segment-progress.json
    `-- SEG001/
        |-- prompt.txt
        |-- script-verbatim.txt
        |-- storyboard-execution.txt
        |-- tsc-handoff.yaml
        |-- 素材映射.txt
        `-- 资产/
            |-- 人物/
            |-- 场景/
            |-- 声音参考/
            `-- 道具/
```

Use the same `outputRoot` for every episode config. Set `episodeFolder` to `第1集`,
`第2集`, and so on; set every final segment `folder` to its exact `id`. Draft and
legacy package folder naming remains unchanged.

Run:

```powershell
powershell -ExecutionPolicy Bypass -File build-episode-segment-package.ps1 -ConfigPath <episode.json>
```

Use `-Force` to rebuild only the configured episode folder. The script preserves
stable `{{Mixed N}}` slots for missing assets so adding one file does not renumber
later references.

Before rebuilding, the script verifies ordered segment source passages reconstruct
the episode source exactly; each prompt contains storyboard optimization and asset
binding sections; each duration is within the configured range; and every
segment has contiguous and unique
`{{Mixed N}}` slots with exact prompt coverage. Every copied asset is verified
against its source with SHA-256. Missing source assets are reported without
shifting later token numbers.

## Segment Progress Audit

`audit-segment-progress.cjs` treats only unique configured `SEG###` entries as video
segments. It rejects duplicate/non-contiguous IDs, a mismatched `declaredSegmentCount`
or target-duration total, and reports missing `script-verbatim.txt`,
`storyboard-execution.txt`, `tsc-handoff.yaml` and `prompt.txt` counts separately.

```powershell
node audit-segment-progress.cjs --project-root <Auto-project-root>
```

## Video Prompt Validation

`validate-video-prompts.cjs` is the reusable Auto-owned validator for all configured
source `prompt.txt` files. Run it after TSC compiles or recompiles the complete prompt
set and before packaging or LibTV execution:

```powershell
node validate-video-prompts.cjs --project-root <Auto-project-root>
```

It validates duration and section order, the production profile's timed-range bounds,
`{{Mixed N}}` to `主体N` definitions, per-range subject locks, the no-tail-frame and
project sound-policy sentence, configured visual-style suffix, absence of internal
`C###`/`SHOT###`/`镜头N`/`clipId` identifiers, and literal continuity-snapshot payload
inheritance between adjacent configured prompts.

## Project Intake Inventory

`scan-project-root.cjs` recursively inventories candidate scripts, images, asset
manifests and wardrobe tables before generation. The inventory records paths, hashes,
sizes and modification times. The Agent fully reads text/table candidates but does not
decode or inspect image content. Existing images are listed for human review unless an
unchanged hash already has explicit human confirmation.

```powershell
node scan-project-root.cjs --project-root <PROJECT_ROOT>
```

## Image Requirement Workbook

`build-image-requirements-workbook.ps1` validates `asset-requirements.json`,
recomputes full-series and per-episode coverage and writes `生图需求全集.xlsx` plus
`asset-requirements-workbook-result.json`. It rejects duplicate versions, missing
script evidence, stale script hashes, missing approved/generated files, changed
human-approved file hashes and false `COMPLETE` status. It does not inspect images.

```powershell
powershell -ExecutionPolicy Bypass -File build-image-requirements-workbook.ps1 -ProjectRoot <PROJECT_ROOT> -Force
```

## Final Pre-Video Validation

`validate-prevideo-delivery.cjs` is the final `/分集` gate. It checks the locked
`episode_prevideo` state, aggregate human approval, image and sound manifests,
workbook result, every 2.1 TSC handoff, packaged mappings, fixed directory shape,
working/package text identity and absence of video-stage artifacts. It never creates
or uploads media. Use `--finalize` only after a normal validation pass; it then
atomically marks the source and formal-package state as complete.

```powershell
node validate-prevideo-delivery.cjs --project-root <Auto-project-root>
node validate-prevideo-delivery.cjs --project-root <Auto-project-root> --finalize
```

`build-asset-workbook.ps1` requires per-image approval and a matching aggregate
approval timestamp. It uses local OpenXML, embeds approved images, reopens the workbook
for validation and writes the fixed `资产总表.xlsx` plus its result JSON.
