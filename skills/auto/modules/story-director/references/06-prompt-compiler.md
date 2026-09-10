# Chinese AI-Video Prompt Compiler

## Inputs

Compile from a valid current clip contract, not directly from a vague story paragraph.

Required inputs:

- Target surface and constraints.
- Canonical reference IDs and role map.
- Planned or observed start state.
- One dominant action and target end state.
- Duration and internal time beats.
- Camera/composition, light/environment, dialogue/audio, style lock, and negatives.

## Six-Block Paste Pack

Use this Chinese-first order:

1. **素材与角色**: Bind `@图片N/@视频N/@音频N` to a purpose; state identity/wardrobe locks.
2. **起始状态与环境**: Describe only facts visible at frame one.
3. **分秒动作与镜头**: Use short timeline segments whose total equals clip duration.
4. **声音**: Speaker-labeled dialogue, ambience, and critical SFX; state whether native audio is requested.
5. **视觉规则**: Composition, light, color, texture, camera stability, and end frame.
6. **禁止项**: Identity drift, action duplication, text/logo/watermark, anatomy errors, unsupported transitions.

Keep UI/API controls such as ratio, resolution, and duration in a separate settings block when the surface provides controls. Do not waste prompt budget repeating them.

## Motion Language

Use visible verbs and paths:

- `抬眼看向门口`, not `感到希望`.
- `右手把未拆信封推到桌沿`, not `处理过去`.
- `镜头缓慢前移半米`, not `电影感推进`.

One clip may have several timed micro-beats, but only one dominant action arc.

## Dialogue And Audio

- Name the speaker.
- Keep lines short enough for the allocated seconds.
- Avoid simultaneous mouth-closed direction and spoken dialogue.
- Use quotes for spoken lines when the surface benefits from them.
- Let ambience bridge cuts; reserve full score and subtitles for post by default.

## Prompt Lint

Reject or rewrite if any condition is true:

1. Duration, timeline sum, ratio, resolution, mode, or assets violate the target constraint object.
2. First/last-frame and multimodal-reference modes are mixed.
3. The selected mode fails its required cardinality: T2V has media roles, first-frame lacks exactly one start image, first/last lacks either endpoint image, or multimodal mode lacks a reference image/video.
4. A referenced `@素材` has no bound asset, an asset has no purpose, or an `asset_role_map` entry lacks ID/type/role/`prompt_tag`/purpose. `prompt_tag` may be an explicitly empty string only on surfaces that bind assets outside prompt text.
5. The prompt contains conflicting camera paths, lighting states, time of day, wardrobe, or prop state.
6. It relies on filler such as `杰作`, `极致`, `超高清`, `电影感`, `大片质感` without concrete visual instructions.
7. The action stack cannot be completed naturally in the duration.
8. The end state is absent or incompatible with the next planned handoff.
9. Generated text, subtitles, logos, or watermarks are requested accidentally.
10. Dialogue exceeds plausible speaking time or speaker/lip state conflicts.
11. The prompt exceeds the conservative quality budget without a clear reason.

Return `PASS` only after all blockers are resolved. Warnings may remain when a platform fact is explicitly labeled uncertain.
