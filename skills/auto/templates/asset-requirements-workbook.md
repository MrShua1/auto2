# Image Requirement Workbook Contract

Build `<PROJECT_ROOT>/生图需求全集.xlsx` from `asset-requirements.json` before paid
image generation. Keep one required asset version per row. Include only rows where
`generationRequired` is true, while the JSON remains the authoritative registry for
all required versions, including valid existing assets.

The workbook contains these sheets:

1. `生图需求全集`
2. `覆盖统计`
3. `问题`

The first sheet uses these literal columns in this order:

```text
资产类型 | 实体ID | 名称 | 版本ID | 人物源ID | 服装ID | 人物状态 | 场景时段 | 道具状态 | 集数 | 场次 | 剧本证据 | 已有文件 | 校验状态 | 生图提示词 | 生成状态 | 最终路径
```

Rules:

- `版本ID` is globally unique and stable.
- `集数`, `场次`, `剧本证据` and `已有文件` join multiple values with line breaks.
- A generation-required row must have exact script evidence and a final generation
  prompt before the workbook is accepted.
- For new character/wardrobe rows, the complete generation prompt must include
  `../references/character-asset-standard.md`'s left-one/right-two layout instructions,
  not just the reference filename. Keep one version per row and one composite per
  candidate; do not split the three views into additional requirements.
- `覆盖统计` records full-series and per-episode required, approved, missing,
  human-rejected and pending-human-review counts plus the registry `STATUS`.
- `问题` records every unresolved validation, generation and coverage issue.
- Auto performs no image-content review. It checks only whether each expected generated
  output file exists, records its path, then delivers every result directly for human
  review.
- Existing images that lack prior explicit human confirmation remain
  `pending_human_review`; generated images remain `generated_pending_human_review`.
  Only the human reviewer may set `approved_existing`, `rejected_invalid` or
  `approved_generated`.
- `STATUS=COMPLETE` is legal only when full-series and every episode have zero missing,
  zero rejected-invalid and zero pending-human-review versions, and every required row
  is `approved_existing` or `approved_generated`. Otherwise use `STATUS=NEED_FIX` and
  list every issue.
- Rebuild the workbook whenever the requirement registry, validation result,
  generation status or final path changes.
