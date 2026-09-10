# GPT 10秒电影分镜九宫格提示词

用途：输入一段剧本或场景，先让 GPT 输出一个 10 秒左右的完整分镜提示词列，再让 `gpt-image-2` 生成一张 16:9 横版分镜板图（实测本地上游约输出 `1672x941`）。

参考结构来自 GitHub：
- `chaoka-wooji/cinematic-storyboard-skill`：六层拆解、镜头语法、文生图 prompt 构成
- `wassermanproductions/storyboard-reference-studio`：shot metadata、per-frame prompt、contact sheet / storyboard board 思路

---

## 1. 给 GPT 的分镜生成提示词

复制下面整段，把 `{剧本}`、`{风格}`、`{人物设定}` 换成你的内容。

```text
你是一位电影分镜导演、摄影指导和 AI 图像提示词设计师。

任务：根据我给的剧本，生成一个约 10 秒的「单场景电影分镜提示词列」。这个分镜列之后会交给 gpt-image-2 生成一张 16:9 横版分镜板图，所以必须画面明确、镜头语言专业、故事还原准确。

输入剧本：
{剧本}

视觉风格：
{风格，例如：电影写实、暖色夕阳、浅景深、自然光、胶片质感}

人物设定：
{人物设定，例如：8岁东亚小女孩，黑色马尾，浅色旧T恤，背双肩包；70岁老人，灰白短发，蓝色中式布衫}

输出要求：
1. 总时长必须是 9-12 秒。
2. 输出 9 个镜头，适合做成 3x3 分镜板。
3. 镜头顺序必须构成完整小故事：建立环境 -> 角色反应 -> 关键动作 -> 情绪转折 -> 离开/余韵。
4. 每个镜头必须包含：镜号、时长、景别、人物视角/角度、镜头运动、画面内容、声音/字幕、英文生图 prompt。
5. 镜头语言必须丰富，至少包含：close-up、medium shot、full shot、wide shot、long shot、over-the-shoulder 或 POV 中的一种。
6. 画面内容不能只写情绪词，要用可见动作、表情、光影、道具细节表达情绪。
7. 每条英文生图 prompt 必须是可直接用于 gpt-image-2 的静帧 prompt，包含主体、动作、场景、光线、构图、镜头语言、色彩风格。
8. 不要出现水印、不要真实电影字幕、不要品牌 logo。

输出格式必须严格如下：

【故事还原摘要】
用 2-3 句话说明这 10 秒发生了什么，人物关系是什么，情绪如何变化。

【角色一致性锚点】
- 角色A：外貌、服装、年龄、关键道具
- 角色B：外貌、服装、年龄、关键道具
- 场景：地点、时代、光线、主色调、关键道具

【9镜头分镜提示词列】
| Shot | Time | Shot Size | Angle / POV | Camera Move | Visual Action | Sound / Caption | GPT-Image Prompt |
|---|---:|---|---|---|---|---|---|
| 1 | 1.0s | ... | ... | ... | ... | ... | Create a cinematic film still... |

【整张分镜板总提示词】
把上面的 9 个镜头整合成一张 3x3 cinematic storyboard contact sheet 的英文 prompt。要求每格有统一角色、统一场景、统一色调；每格下方带小号镜头标签，如 SHOT 1: CLOSE-UP，但不要额外水印。画布比例 16:9。

【负向提示词】
列出用于 gpt-image-2 的负向描述：no watermark, no distorted faces, no random extra panels, no modern objects if period scene, no inconsistent character design...
```

---

## 2. 给 gpt-image-2 的分镜板生图提示词模板

当 GPT 生成完 9 镜后，把「整张分镜板总提示词」进一步整理成下面格式再生图。

```text
Create one single 16:9 cinematic storyboard contact sheet, 3 rows by 3 columns, nine panels total, black film-strip gutters between panels, each panel is a different camera shot from the same continuous 10-second scene.

Scene continuity: [写清剧本中的地点、年代、时间、光线、人物关系、核心事件]

Character consistency: [写清人物A/B外貌、服装、年龄、道具，要求 all panels keep the same character design]

Visual style: cinematic realism, warm natural light, shallow depth of field, film still composition, coherent color palette, detailed production design, no watermark.

Panel layout:
1. SHOT 1: [景别] - [角度/机位] - [画面动作] - [光线/构图]
2. SHOT 2: [景别] - [角度/机位] - [画面动作] - [光线/构图]
3. SHOT 3: [景别] - [角度/机位] - [画面动作] - [光线/构图]
4. SHOT 4: [景别] - [角度/机位] - [画面动作] - [光线/构图]
5. SHOT 5: [景别] - [角度/机位] - [画面动作] - [光线/构图]
6. SHOT 6: [景别] - [角度/机位] - [画面动作] - [光线/构图]
7. SHOT 7: [景别] - [角度/机位] - [画面动作] - [光线/构图]
8. SHOT 8: [景别] - [角度/机位] - [画面动作] - [光线/构图]
9. SHOT 9: [景别] - [角度/机位] - [画面动作] - [光线/构图]

Add small clean white labels at the bottom of each panel: SHOT 1: CLOSE-UP, SHOT 2: CLOSE SHOT, SHOT 3: FULL SHOT, SHOT 4: MEDIUM SHOT, SHOT 5: CLOSE-UP, SHOT 6: WIDE SHOT, SHOT 7: MEDIUM SHOT, SHOT 8: CLOSE SHOT, SHOT 9: LONG SHOT.

Make the board read as a complete micro-story from left to right, top to bottom. Preserve exact continuity of characters, clothing, props, location, lighting direction, and time of day across all nine panels.

Negative: no watermark, no app UI, no social media interface, no random text blocks, no extra panels, no missing panels, no duplicated faces, no deformed hands, no inconsistent character age, no inconsistent clothing, no modern objects unless specified, no blurry storyboard, no low quality.
```

---

## 3. 推荐 gpt-image-2 调用参数

本地代理：

```json
{
  "model": "gpt-image-2",
  "prompt": "[粘贴上面的整张分镜板总提示词]",
  "n": 1,
  "size": "3840x2160",
  "quality": "high"
}
```

当前 tsnui 上游会自动降级，横版实际通常返回约 `1672x941`，但比例和分镜板构图可用。

请求里也可写 `"size": "16:9"`（本地代理会映射为 `1536x1024` 再交给上游；实测最终常见 `1672x941`）。

---

## 4. 本机实测（已跑通）

**时间：** 2026-07-23  
**链路：**

| 步骤 | 服务 | 结果 |
|------|------|------|
| 1 分镜文案 | `https://ai.tsnui.com/v1/chat/completions` 模型 `gpt-5.4`（key 在 `~\.grok\local-tsnui-proxy\config.json`） | HTTP 200，产出 9 镜 + 总提示词 |
| 2 九宫格图 | `http://127.0.0.1:18769/v1/images/generations` 模型 `gpt-image-2` Key=`local` | HTTP 200 |
| 出图尺寸 | — | **1672×941**（与文档描述一致） |

**一键脚本（桌面）：**

```bat
powershell -NoProfile -ExecutionPolicy Bypass -File "%USERPROFILE%\Desktop\run-gpt-10s-storyboard.ps1"
```

自定义剧本：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\Desktop\run-gpt-10s-storyboard.ps1" `
  -Script "你的剧本..." -Style "电影写实、暖色夕阳..." -Chars "人物设定..."
```

**前置：**

1. v2rayA/网络可访问 `ai.tsnui.com`（或你当前 tsnui 可达）
2. 本地代理在跑：`~\.grok\local-tsnui-proxy` 端口 **18769**
3. `config.json` 里 `api_key` 有效

**产物目录示例：**

- `Desktop\gpt_10s_storyboard_run\`（分镜 md + 请求/响应 + png）
- `Desktop\gpt_10s_storyboard_RESULT.png`（最新一张，方便直接打开）

**画布侧调用（同一代理）：**

| 字段 | 值 |
|------|-----|
| Base URL | `http://127.0.0.1:18769/v1` |
| Key | `local` |
| model | `gpt-image-2` |
| prompt | 粘贴「整张分镜板总提示词」 |
| size | `16:9` 或 `1536x1024` |
| quality | `high` 或 `medium` |
