# Character Asset Standard

## Scope And Priority

Mandatory for every newly generated Auto character asset, including each wardrobe
or visible-state version and each base candidate or authorized regeneration.
This contract overrides generic single-view/no-grid asset instructions and older
module defaults for character assets only. Locations, props and story frames do
not inherit this layout. Preserve the project's medium, LOOK, identity, wardrobe,
route, resolution and planned overall aspect ratio.

The user-requested `1*1` and `1*2` describe panel arrangement: left one panel;
right one column with two stacked panels. They do not impose a square overall
image or a 1:2 overall aspect ratio. Do not replace this with three equal columns,
a side-profile turnaround, three separate outputs or three different characters.

## Required Layout

| Position | Framing | Reference purpose |
|---|---|---|
| Left, single full-height panel (1*1) | Front-facing upper body, face looking straight at camera, eye-level straight-on camera; include the whole head and clear facial features | Primary identity, face and facial-feature reference; highest visual priority |
| Right top (right column, first of 1*2) | Front standing view, with head and neck outside the crop; show clothing from the shoulder/collar area through the footwear | Front wardrobe silhouette, layers, material and details |
| Right bottom (right column, second of 1*2) | Back standing view, including the whole head, rear hairstyle and body through the footwear; no looking back toward camera | Rear hairstyle and back wardrobe reference |

All three panels show the SAME character and SAME wardrobe/state version. Match
body proportions, garment colors/materials/layers, accessories and hairstyle
where visible. Use neutral standing display poses and legible lighting; do not
invent an action scene. The front clothing crop excludes the head and neck through
camera framing only, not anatomical removal; retain the garment neckline and
shoulders. Do not use a mannequin, detached head or an empty neck opening as a
substitute. Do not apply that crop to the left portrait or the rear view.

Keep panel boundaries clean and views separate, with a simple unobtrusive background.
No extra panels, captions, labels or watermark. Preserve original required garment
text and user-specified markings. Panel layout is functional, not a new global LOOK.

## Prompt Block

Write the concrete character identity and wardrobe/state facts from the authorized
source, then include this layout instruction in each complete image prompt. Append
the locked project LOOK suffix last. Never send only a layout-contract ID in place
of the instructions or claim that the image model automatically knows this file.

The layout block is not the whole prompt. Retain the applicable requirements of
`internal-production-rules.md`: specify shot scale, angle, camera height, lens and
composition for each view, one character's identity and wardrobe roles, physical
light direction/softness and subject-background separation, concrete garment
materials and project-appropriate realism, plus relevant identity/anatomy exclusions
and the planned output aspect ratio. Keep these choices compatible with the required
front/back views and simple background; do not invent story action for the display.

```text
生成人物资产参考图，一张图内固定三视图区：左侧1*1单格，右侧1*2上下两格。三格均为同一人物、同一服装和同一外观状态，不是三个人。
左侧：人物正面正视、平拍上半身，镜头与眼睛等高，完整保留头部，面部和五官清晰，作为最重要的人物身份参考；不要侧脸、俯拍或仰拍。
右上：人物正面自然站姿服装展示，以画面裁切使头部和脖子均不入镜，保留衣领、肩部至鞋履的完整服装展示；只是取景裁切，不表现身体缺失，不使用人台替代。
右下：人物背面自然站姿，完整保留头部和背面发型，并展示背面服装至鞋履；不要回头，不要裁掉头部。
三个视图中的体型、服装款式、颜色、材质、配饰与可见发型保持一致。分区清晰、背景简洁、照明便于辨认；不增加其他视图、标题、标签或水印，保留原服装必要文字。版式仅用于资产参考，不是剧情画面。
```

## Preflight And Approval

Before submitting a character image job, verify its actual prompt states all three
positions, frontal eye-level portrait, head/neck exclusion ONLY in the front clothing
panel, head inclusion in the rear panel, and same identity/wardrobe across panels.
Resolve contradictory instructions such as no grids, a full-body front view with
head in the right-top panel, or three equal columns before submission. This small
per-job check does not require whole-series completion or a new human data-entry gate.

One three-panel image is ONE candidate, ONE output and ONE logical image job. Keep
the existing candidate-count and attempt-budget rules. Record the complete prompt
in the requirement registry/workbook and image job record. Three panels do not
create three asset rows, three candidate slots, three Mixed references or extra SEGs.

This is an explicitly requested character asset, not a delivery preview/gallery.
After generation, retain the normal mechanical checks and aggregate human approval;
prompt compliance does not prove pixel compliance. Do not automatically approve or
regenerate successful images based on an unperformed visual review. Existing supplied
or human-approved assets are not retroactively reformatted or regenerated without
an explicit revision request. This rule change alone authorizes no paid generation.

## TSC Reference Instruction

When the approved composite is used by TSC, its panels constrain one character's
identity, front wardrobe and rear hair/wardrobe only. For every such reference in
a new or explicitly revised video prompt, TSC MUST write the following instruction
once in the actual `【资源引用】` section of `prompt.txt`, replacing N with that
reference's assigned Mixed/subject number. Keeping this rule only in the handoff,
metadata or Agent instructions is insufficient; the video model must receive it.

```text
{{Mixed N}} 的三格均为同一主体N：左格提供面部与五官，右上格提供正面服装，右下格提供背面发型与服装；仅作外观参考，剧情画面不继承分格、重复人物、头颈裁切或展示站姿，人物数量、构图和动作按本段镜头执行。
```

Do not add this instruction to unrelated single-view references or silently rewrite
already delivered prompts. Keep one Mixed slot per approved character composite;
do not infer three visible characters or force a single-character story scene.
