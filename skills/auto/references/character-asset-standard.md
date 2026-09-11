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
三个视图中的体型、服装款式、颜色、材质、配饰与可见发型保持一致。分区清晰、背景简洁、照明便于辨认；严禁画面出现任何文字、标题、标签、水印、字母、数字、汉字或伪字符，服装、道具与背景表面均保持纯净无字（strictly no text, no letters, no words, no numbers, no Chinese characters, no labels, no watermarks, no typography）。版式仅用于资产参考，不是剧情画面。
```

### 全资产图片绝对禁止文字铁律（Strict Zero-Text in Images Gate）
所有人物卡、场景空镜板、道具特写板等资产图片，**绝对严禁画面出现任何文字、字母、数字、汉字、标题、标签、品牌Logo、水印或乱码伪字符**。
衣服与道具材质必须为纯色/纯纹理，严禁生图大模型在衣服胸口、袖口、帽子或道具上自动脑补印刷英文字母或乱码文字。提示词末尾必须无条件包含：`strictly no text, no letters, no words, no numbers, no labels, no watermarks, no typography, pure visual imagery with zero writing on image`。

### 1. 角色服装绝对具象化与去泛化防撞衫（Costume Anti-Generic & Distinct Wardrobe Gate）
- **严禁模板泛化提示词**：严禁在提示词中使用“适合沿海短剧的真实服装”、“现代职场装”、“工作服”等泛化抽象词，指望文生图模型随机产生差异！这必然导致相邻角色千篇一律大面积撞衫（如大批男性全变成深蓝工装夹克）；
- **全员服装三维具象物理定义**：每一个出场角色的每一套服装，必须具备排他性的具象物理描述：
  * ① 版型与款式：双排扣戗驳领西装 / 连体橡胶防水胶衣 / 粗布对襟短衫 / 复古夏威夷印花短袖 / 海事制服；
  * ② 材质与质感：重磅精纺羊毛 / 涂层防撕裂尼龙 / 粗织棉麻 / 缎面生丝 / 仿旧机车硬质牛皮；
  * ③ 独特色盘与点缀：高对比度专属色系（如亮橘色、孔雀蓝配明黄、藏青粉笔条纹、深棕配紫红格纹），搭配专属配饰（金硬肩章、怀表、翡翠扳指、串珠手链、面颊刀疤），彻底杜绝视觉雷同。

### 2. 同角色换装“人物母图垫图锁脸”铁律（Master-Anchor Image-to-Image Identity Lock Gate）
- **严禁多套服装独立文生图**：同一角色的不同服装版本（如落魄出海装、赶海装、潜水服、首富西装、晚礼服、VO角色），绝对严禁分别使用独立纯文本生图！独立生图必然导致“换一套衣服换一张脸、一人四貌”的严重穿帮事故；
- **母图确立与垫图图生图流水线（Master-Anchor Image-to-Image Pipeline）**：
  * ① 确立人物母图（Master Anchor）：对每一位有换装需求或高频出场的核心角色，必须先生成一张 100% 确立标准五官骨相的三视图【人物母图】归档保存；
  * ② 垫图换装：后续所有变体服装、特殊状态（如常态黑眸版、水眼金睛/金晶开眼版、VO 配对），必须以人物母图作为基础参考（`images: [data:image/png;base64,母图]`），结合具体服装提示词进行图生图；
  * ③ 提示词强制注入锁脸咒语：`Maintain 100% exact same facial identity, bone structure, eye shape, nose, mouth, skin tone, and authentic Chinese heritage from the reference image. Strictly preserve the exact same actor and face. ONLY change outfit and styling to [...]`。

### 3. 人种血统绝对东方面孔与去西方先验铁律（Default Authentic Chinese Face & Western Prior Purge Gate）
- **默认 100% 纯正中国人面孔**：除非剧本明确注明角色为外籍人士，全剧全员无论主角、配角、群演、富豪、千金，必须 100% 呈现纯正东方中国面孔（Authentic Chinese / East Asian facial structure）；
- **高定/晚礼服严防“西方/老外先验劫持”**：文生图大模型在遇到“晚礼服（evening gown）”、“千金（heiress）”、“豪华西装（luxury suit）”、“酒会”等奢华词汇时，极易被西方名流语料劫持，生成蓝眼、高鼻、金卷发的欧美洋人脸（如林静被生成为外国脸）；
- **双向强锁指令**：所有提示词必须显式注入：
  * 正向锁：`Authentic Chinese [man/woman], natural black hair, dark brown/black eyes, authentic East Asian facial features, natural Chinese skin tone and bone structure`；
  * 负向硬锁：`Strictly zero Western/Caucasian/European facial features, zero blue/green/light-colored eyes, zero blonde/light hair, zero foreign mixed-race appearance`；
  * 现实写实眼眸：常态眼眸必须为自然中国人深黑/深褐色；仅在剧本明确有异能开眼（如水眼金睛）镜头时，方可标注为开眼金芒版。

### 4. 全量剧本无上限地毯式资产解析铁律（Carpet-Style Exhaustive Script Asset Audit Gate）
- **严禁擅设资产上限与偷工减料**：严禁凭主观经验偷懒设定“全剧只提 100 个资产”，严禁忽略中后段剧集！
- **300集（全剧）逐场逐幕地毯式穿透**：必须从第 1 集地毯式扫描至大结局最后一集，确保 4 个层面的绝对全覆盖：
  * ① 人物全量覆盖：所有有台词、有名字、有剧情动作的群演、反派、公职人员、客户、随从必须全员建档，同一人物的不同服装/重要剧情状态必须作为独立资产变体建档；
  * ② 场景空间全量覆盖：剧中所有不同物理场景（包括同一大场景的不同微空间，如码头露天卸货区、码头冷库、海鲜拍卖行、私密包厢、各海域深潜点）必须全部独立建档；
  * ③ 道具全量覆盖：所有承载剧情推动、交易、鉴宝、异能、特定特写的物品（各品质鱼种、古董宝藏、赌石翡翠、特定证书工具）必须全部建立特写参考板；
  * ④ 无遗漏双重核验：资产大表构建完成后，必须通过自动化脚本交叉检索剧本全部场次与人物登场表，确保资产遗漏率为 0。

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
