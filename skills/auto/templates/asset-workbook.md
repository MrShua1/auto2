# Asset Workbook Contract

Generate `<output-root>/资产总表.xlsx` after character, location and prop asset
images have explicit human approval. This workbook is a fixed `auto` deliverable.

## Required Sheets

Create these sheets in this order:

1. `人物`
2. `场景`
3. `道具`
4. `_索引` (hidden)

Create all four sheets even when a visible category has no approved assets.
When the approved project intentionally has no visual reference assets, use an empty
`assets` array, retain the aggregate human decision and timestamp, and generate a
valid empty workbook with the same four-sheet contract.

## Visible Sheet Layout

- One asset per row, ordered by first appearance in the screenplay.
- Column A contains the canonical asset name and remains frozen while scrolling.
- Columns B onward contain that asset's human-approved images arranged
  horizontally: primary reference first, then turnarounds, expressions, wardrobe,
  alternate states or additional views in canonical order.
- Embed image bytes in the workbook. Do not use URLs, formulas or local paths as
  substitutes for visible images.
- Preserve image aspect ratio, center each image in its cell area, and set stable
  row heights and column widths so images do not overlap adjacent cells.
- Use compressed preview copies inside the workbook when necessary to control
  file size. Never alter or overwrite the approved source images.
- Do not embed rejected, superseded, unreviewed or missing images.
- Do not treat storyboard approval as asset approval. Storyboard images are not
  video inputs and may appear only when separately approved as a canonical
  character, location or prop reference in `assetImages.humanReview.approved`.

## Hidden Index

The hidden `_索引` sheet has one row per embedded image with these columns:

```text
asset_id | category | asset_name | image_role | source_path | approval_status | approved_at | visible_sheet | visible_cell
```

Rules:

- `asset_id` uses the canonical `CHAR###`, `LOCATION###` or `PROP###` ID.
- `category` is `人物`, `场景` or `道具`.
- `source_path` records the existing approved local original; do not copy or move
  the original solely for workbook creation.
- `approval_status` must be `approved`.
- `visible_cell` points to the image's anchor cell in the visible sheet.

## Validation

Before marking the workbook complete:

1. Open the saved `.xlsx` through the workbook library and verify all four sheet names.
2. Verify `_索引` is hidden.
3. Reconcile embedded image count with `_索引` row count and the approved asset manifest.
4. Verify every indexed source path exists and every visible asset name matches canon.
5. Record path, generation time and approved asset count in `auto-state.json`.
