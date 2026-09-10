# Adaptive Storyboard Quality Gates

## Structural Gate

- Target model/endpoint, declared duration, verified maximum duration, and capability source are recorded.
- Declared duration is 4-15 seconds by portable default, or 16-30 seconds only when the active endpoint confirms extended support.
- Declared duration does not exceed the verified target-model maximum.
- Panel count is between 1 and 9.
- Every selected panel has a distinct state or narrative job.
- No panel exists only to fill a layout.
- Panel timestamps are ordered and fit the declared clip duration.
- The last selected state represents the endpoint or intentional afterimage.
- Combined-board layout matches the selected count and introduces no generated filler story panel.
- Every independent panel is exactly 16:9 before board assembly.
- Combined boards preserve each complete 16:9 panel by proportional scaling; neutral whitespace is allowed, while cropping, stretching, outpainting, and redrawing are blocked.
- When one continuous clip uses multiple boards, their time ranges are ordered, non-overlapping, and cover the full declared duration.

## Panel-Count Gate

- Static/held clips use 1-2 panels unless a handoff requires another state.
- One clear action normally uses 3 panels: setup, action peak, endpoint.
- A reaction is included only when it changes meaning.
- Complex contact, occlusion, handoff, physics, or VFX may use 5-9 panels.
- Exactly nine panels require nine demonstrably distinct states.
- Redundant states are merged before delivery.
- Duration alone never increases the panel count.
- More than nine indispensable states require an explicit `split-clip` or `multi-board-single-clip` decision.
- `split-clip` is mandatory for multiple independent action chains, location changes, incompatible camera moves, or a motion load that cannot remain one stable generation.

## Story Gate

- First panel makes the starting situation legible when setup matters.
- The primary action is visible in at least one panel.
- Intermediate panels change position, state, information, ownership, expression, or pressure.
- Final panel differs materially from the first unless the intended story is failed action/return.

## Continuity Gate

- Character age, face/hair silhouette, wardrobe, and props follow the reference manifest.
- Every character-bearing panel has a literal per-character wardrobe contract covering upper garment, lower garment, legwear, footwear, bag/accessories, and screen position as applicable.
- Written scene wardrobe and assigned wardrobe continuity references override incidental source clothing in identity sheets; source-clothing leakage is an automatic rejection.
- Face-free inserts still preserve character differentiation through the correct skirt/trousers, socks, shoes, bags, visible body parts, and exact person count.
- Original identity references outrank pose, environment, style, scene, and previously generated frames for face geometry, facial features, hairline, hairstyle, age presentation, and body proportions.
- A character frame that does not visibly match the original identity reference is rejected even when request metadata proves that the reference file was uploaded.
- Never average, blend, or compromise between a wrong generated face and the original identity reference.
- Every supplied image has an explicit role and panel range.
- Character references do not leak source backgrounds, poses, text, or incidental objects.
- Location references do not import incidental people, logos, or clutter.
- Location geometry, weather, light, screen direction, and prop ownership remain coherent.
- Same-priority reference conflicts have a canonical decision.

## Frame Gate

- Each still contains one frozen, legible state.
- Shot size and angle serve the state rather than random coverage.
- Camera intent is physically possible and does not stack conflicting moves.
- Prompt contains subject identity, frozen action, scene, stateful props, physical light, and composition.
- Vague quality words never substitute for visible production decisions.

## Generation Gate

- All character-bearing frames were actually sent the required identity references.
- Result visibly preserves the intended person; identity substitution is rejected.
- Request/reference hashes are audit evidence only, not visual identity approval. Human visual comparison against the original identity reference is mandatory for every character-bearing frame.
- No malformed anatomy, face swap, age drift, wardrobe drift, accidental text, logo, watermark, app UI, or social-media chrome.
- Multi-character partial-body frames contain exactly the declared people and anatomy count; ambiguous duplicated skirts, legs, feet, bags, or gender presentation are rejected.
- Independent frames are saved before any contact sheet is assembled.
- Contact sheet is assembled from approved frames whenever possible.

## Delivery Report

```text
【质检】
- 参考图绑定：PASS | BLOCKED | N/A
- 画面数：PASS (N, minimum sufficient)
- 时间覆盖：PASS (x.xs)
- 模型时长能力：PASS (target model, declared/max seconds, capability source)
- 长片段决策：single-board | multi-board-single-clip | split-clip | N/A
- 状态推进：PASS
- 人物/服装/道具连续性：PASS | BLOCKED
- 场景/光线/屏幕方向：PASS | BLOCKED
- 独立分镜帧：N/N generated
- 组合分镜板：generated | not-requested | blocked
- 文字模式：clean | labeled
- I2V提示：使用通过质检的独立帧，不使用整张组合板作为首帧
```
