# Adaptive Clip Storyboard

## 【分镜图片】

- Clip ID:
- Target model/endpoint:
- Declared duration:
- Verified maximum duration:
- Capability source:
- Selected panels:
- Long-clip decision: single-board | multi-board-single-clip | split-clip | N/A
- Generation status: generated | not-executed | blocked | failed
- Image model/tool:

| Panel | Timestamp | Path | Status | Visible deviation |
|---:|---:|---|---|---|
| 1 |  |  |  |  |

## 【组合分镜板】

- Status: generated | not-requested | blocked
- Layout:
- Path:

## 【参考图绑定表】

| Asset ID | Source | Role | Preserve | Ignore | Panels | Actually sent | Status |
|---|---|---|---|---|---|---|---|
| REF_CHAR_A |  | character_identity |  | source background/pose |  |  | approved |

## 【故事还原摘要】

[Initial state -> primary action -> changed end state -> handoff]

## 【画面数决策】

- Selected panels: N
- Distinct states:
- Rejected/merged states:
- Board time range:
- Additional sequential boards:
- Delivery mode: individual | contact-sheet | both

## 【角色与场景一致性锚点】

- Characters:
- Wardrobe/props:
- Location/period:
- Time/weather/light direction:
- Screen direction:
- Palette/texture:

## 【N格分镜提示词列】

| Panel | Time | Narrative Job | Shot Size | Angle / POV | Camera Intent | Frozen State | Sound Intent | References | Standalone Still Prompt |
|---:|---:|---|---|---|---|---|---|---|---|
| 1 |  |  |  |  |  |  |  |  |  |

## 【负向提示词】

```text
no watermark, no logo, no app UI, no social-media interface, no accidental text, no duplicated character, no identity substitution, no inconsistent face, no age drift, no clothing drift, no prop drift, no location drift, no lighting-direction drift, no malformed hands
```

## 【质检】

- 参考图绑定：
- 画面数：
- 时间覆盖：
- 模型时长能力：
- 长片段决策：
- 状态推进：
- 人物/服装/道具连续性：
- 场景/光线/屏幕方向：
- 独立分镜帧：
- 组合分镜板：
- 文字模式：clean
- I2V提示：使用通过质检的独立帧，不使用整张组合板作为首帧
