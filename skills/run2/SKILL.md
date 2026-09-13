---
name: run2
description: >-
  把本地已分好的片段（seg001…seg00x）中的图片资产、音频资产与提示词送入小云雀（Pippit）漫剧画布，组成预视频交付结构。
  最高红线：严禁任何视频生成行为（严禁 generate-video / 提交生成任务）。用于 /run2 命令或小云雀分集素材上传。
---

# run2 — 小云雀分集素材上传与画布导入（/run2）

本 Skill 的作用：把本地已分好的片段（seg001…seg00x）中的图片资产、音频资产与提示词送入小云雀（Pippit）漫剧画布，组成标准的预视频交付结构。

## 最高红线（绝对禁止，违反即停止并报错）

**【最高绝对红线：绝对零消耗积分与零可能消耗积分铁律（Strict Zero Credits & Zero Generation Gate）】**

本 Skill 的核心使命是把本地已分好的片段（图片资产、音频资产、Prompt）送入小云雀（Pippit）漫剧画布，组成纯静态标准的预视频交付结构。**全流程必须实现绝对 0 积分消耗，严禁任何消耗积分以及可能消耗积分的行为！**

1. **绝对禁止任何消耗积分的操作（Zero Credits Consumption）**：
   - **严禁任何视频生成**：严禁调用 `pippit-tool-cli generate-video`、分镜视频生成、完整视频合成等任何视频生成动作；
   - **严禁任何图片生成**：严禁调用 `pippit-tool-cli generate-image`、文生图、图生图等任何图片生成动作；
   - **严禁任何视频处理**：严禁调用视频超分 `pippit-tool-cli video-super-resolution`、擦字幕 `pippit-tool-cli erase-video-subtitle` 等任何后期工具；
   - **严禁任何后端 Agent 自动创作**：严禁发送任何含有“帮我生成”、“开始渲染”、“合成视频”的后端指令。
2. **明确 0 积分消耗的合法白名单边界（Zero-Cost Whitelist Only）**：
   - 允许且仅允许以下 0 积分消耗的纯静态操作：
     * `canvas create` —— 创建空画布（0 积分）；
     * `canvas upload` —— 上传本地已有图片/音频素材文件至个人资产库（0 积分）；
     * `create_biz_node` —— 在画布上创建图片、音频、视频业务节点（0 积分）；
     * `create_edge` —— 在画布节点之间建立连线（0 积分）；
     * `update_asset` / `update_node_data` —— 更新视频节点的 Prompt、模型参数与规格元数据（0 积分）；
     * `canvas get` —— 读取画布文档快照（0 积分，只读）；
     * `get-credit-balance` —— 查询个人有效积分余额（0 积分，只读）。
3. **严格保持未执行预交付状态**：
   - 视频节点必须保持未运行的纯静态设计态；
   - 节点内预填 Prompt、模型（`Seedance_2.0_mini_lite`）、分辨率（`720p`）、比例（`9:16`），但绝对禁止点击生成或下发渲染任务！
4. **双重积分守恒审计（Credits Balance Hard Lock）**：
   - 执行任何导入工作流前后，必须自动调用 `pippit-tool-cli get-credit-balance` 核验积分；
   - 必须确保：`执行后积分 == 执行前积分`，积分差额必须严格为 0！一旦发生任何积分扣减，立即触发最高级别事故熔断。

---

## 调度与并发架构（默认并发：每一集一个 Agent）

**【最高调度铁律：默认并发与每一集独立 Agent 架构（Default Concurrency & One Agent Per Episode Gate）】**

针对分集导入任务（如 `/run2 batch20`、多集批量导入、或处理包含多个分集的目录），**严禁单 Agent 串行逐集低效排队！**

1. **默认多智能体并发（Default Multi-Agent Concurrency）**：
   - **调度原则：每一集独立指派一个 Agent（One Episode, One Agent）**；
   - 调度中枢（Master Agent）扫描全量待导入分集后，使用 `invoke_subagent` 同时唤醒多个 Subagent（例如 5~20 个并行 Worker）；
   - 每一个 Subagent 作为独立的影视工程管线，完全自主、并行处理其专属分集的：
     * 预检与专属画布创建（`canvas create`）；
     * 素材与分镜图上传；
     * 节点创建与分镜图入边连线；
     * 零积分守恒门禁核验（$\Delta = 0$）。
   - 各 Subagent 独立交付后向主调度 Agent 汇报 WebUI 画布链接与连线矩阵，由主调度统一聚合输出批次总交付报告。

2. **单集内部极速并发池（Intra-Episode ThreadPool Concurrency）**：
   - 每个 Subagent 执行单集导入时，底层脚本必须启用多线程并发池（`ThreadPoolExecutor` 8~16 并发）：
     * **素材并发上传**：角色、场景、道具、音频及分镜图文件并发上传至云端（3~5秒完成）；
     * **节点并发创建**：资产节点与逐镜头分镜图节点并发创建（2~3秒完成）；
     * **连线并发建立**：所有入边连线无依赖并发打入画布（3~5秒完成）；
   - **单集耗时极速压缩至 15~20 秒内（提速 6~8 倍）**。

3. **分镜图逐镜头入边硬连线（Storyboard Lineart Node & Edge Requirement）**：
   - 每个分段（SEG）下的逐镜头专属站位线稿（`shotX_lineart.png`）必须全部上传为独立的 `SEGxxx_镜头y_分镜图` 业务节点；
   - 该分段的**所有分镜图节点必须 100% 作为入边连入该片段的视频交付节点**；
   - 形成“角色卡管长相、场景卡管环境、分镜图管站位手势”的三权分立预视频交付闭环。

---

## 与 pippit-tool-cli 的联动机制

CLI 命令基于原生 `pippit-tool-cli` 及其内置的 Canvas SDK 运行：

- **执行前确认**：
  - CLI 可用：`pippit-tool-cli --version`。
  - 登录状态：`pippit-tool-cli status` 显示 `logged_in: true`。若未登录执行 `pippit-tool-cli login`。
- **画布创建与获取**：
  - 创建画布：`pippit-tool-cli canvas create --title "<标题>" --wait`
    - 返回：`project_id`、`canvas_asset_id`、`overview_pippit_asset_id`、`web_url`。
  - 查询画布快照：`pippit-tool-cli canvas get --asset-id <canvas_asset_id>`
- **素材上传**：
  - 上传本地图片或音频：`pippit-tool-cli canvas upload --path "<本地文件绝对路径>"`
    - 返回：`asset_id`、`pippit_asset_id`。
- **节点与连线原子事务**：
  - 创建业务节点：`pippit-tool-cli canvas command run create_biz_node --canvas-id <canvas_asset_id> --file <input.json>`
    - 支持 `nodeKind`: `image`（图片）、`audio`（音频）、`video`（视频）、`role`（角色）、`scene`（场景）。
  - 创建连线：`pippit-tool-cli canvas command run create_edge --canvas-id <canvas_asset_id> --file <edge.json>`
  - 更新节点：`pippit-tool-cli canvas command run update_node_data --canvas-id <canvas_asset_id> --file <update.json>`

---

## 关键参数与踩坑经验（实战验证）

| 项 | 说明 |
| --- | --- |
| **JSON 文件传参** | 在 Windows 环境下，直接通过 `--input '{...}'` 传参容易被 shell 剥离引号导致解析失败。**必须使用 `--file <path>`** 传参，且路径必须带双引号包裹 `"--file", f'"{tmp_file}"'`。 |
| **默认视频规格** | 视频节点统一配置为：`modelKey: "Seedance_2.0_mini_lite"`, `ratio: "9:16"`, `resolution: "720p"`, `playback: {"muted": true}`。 |
| **连线顺序** | 连线必须**严格按 `素材映射.txt` 中的行序**逐条建立；先建素材节点与视频节点，再逐条连线。 |
| **Prompt 节点引用** | Prompt 中的 `{{Mixed n}}` 占位符一律替换为小云雀 Canvas 标准引用标签：`<node-asset label="资产名">nodeId</node-asset>`。 |
| **幂等性与续传** | 上传前与建节点前，先读取本地缓存或 `canvas get` 获取已有节点；已存在的节点直接复用其 ID，避免重复创建冗余节点。 |
| **画布直达链接** | `https://xyq.jianying.com/novel/detail/canvas?overviewPippitAssetId=<overviewId>&projectId=<projectId>`。部署完成后向用户汇报此链接，可直接点击在浏览器中审查画布结构。 |

---

## 连线纯洁性与防资产污染门禁（最高连线红线）

1. **按分段实际引用严密连线（Strict Input Purity）**：
   - 严禁将当前分段未出镜的资产连入该 SEG 视频节点！在连线前必须逐段比对当前分段的 `prompt.txt` 中【角色清单】与【资源引用】；
   - 凡分段 prompt 中未引用的全局资产，**绝对禁止作为入边连线连入**！
   - 严禁“全剧资产大乱炖”或“打包全量连线”。
2. **严格 0 视频级联输入（Strict Zero Video Input）**：
   - 视频节点左侧连线必须严格且仅限于：① 静态图片资产 与 ② 音频声音参考；
   - 严禁连入任何上游生成的视频片段（videoList 长度必须严格为 0）。

---

## 路径约定

- **根目录**：由用户指定（执行 `/run2` 时确认）。
- **分集目录**：如 `第002集`（或用户指定的完整路径）。
- **片段目录**：分集目录下的 `SEG001`、`SEG002` … `SEG00x`。
- 每个 `SEG00x` 内需读取：
  - `素材映射.txt` —— 资产清单与**固定顺序**，禁止调换；
  - `资产/` —— 图片资产（`人物/`、`场景/`）与音频资产（`音频/`）；
  - `prompt.txt` —— 该片段的视频节点提示词全文。

---

## /run2 执行流程（对每个 seg00x 依次执行）

### 步骤 0：预检
1. 确认分集目录存在，枚举 `SEG*` 目录清单。
2. 确认已登录小云雀（`pippit-tool-cli status`）。
3. 检查分集目录下 `.pippit/canvas.json`；若不存在则自动调用 `pippit-tool-cli canvas create` 创建该集专属画布并归档。

### 步骤 1：读取素材映射，锁定固定顺序
- 读取 `素材映射.txt`，按 `{{Mixed 1}}` 到 `{{Mixed n}}` 的行序提取资产路径与资产类型（图片/音频）。
- **禁止调换顺序**。

### 步骤 2：上传素材资产到小云雀
- 调用 `pippit-tool-cli canvas upload --path "<资产绝对路径>"`。
- 获取返回的 `asset_id` 与 `pippit_asset_id`。
- 本地维护 `.pippit/asset_cache.json` 实现上传幂等。

### 步骤 3：在画布中创建素材业务节点
- 对每个素材资产，调用 `create_biz_node` 创建对应的 `image` 或 `audio` 业务节点：
  - 节点名称：`SEGxxx_资产n_资产名`；
  - 绑定 `pippitAssetId` 与 `assetId`；
  - 若画布上已存在同名节点则直接复用其 `nodeId`。

### 步骤 4：创建视频节点并注入 Prompt
- 读取各分段 `prompt.txt`，将 `{{Mixed n}}` 替换为规范的 `<node-asset label="名称">节点ID</node-asset>`；
- **注入前空间坐标硬检（Rule 0.22 门禁）**：
  * 检查 Prompt 的【站位与起始状态】、【位置承接】、【结束状态】：绝对严禁包含 `身侧|旁侧|身旁|旁边|在旁` 等模糊词；
  * 必须明确左右边（`画左`、`画右`）并与【锚点远近景】四维协同；
  * 同一 SEG 内左右站位必须严格一致，严禁未经交代的跳轴；
- 配置 `modelKey: "Seedance_2.0_mini_lite"`, `ratio: "9:16"`, `resolution: "720p"`, `playback: {"muted": true}`；
- **全程绝对不触发任何生成动作**。

### 步骤 5：按映射顺序逐条连线
- 对每个素材节点，调用 `create_edge` 建立从素材节点指向视频节点的入边连线：
  `edge: { id: "edge_...", source: <素材节点ID>, target: <视频节点ID> }`。
- 逐条创建以锁定映射顺序。

### 步骤 6：终态核验与链接汇报
- 调用 `canvas get` 读取画布快照，核对所有视频节点、素材节点与连线完整性；
- 输出交付报告与 WebUI 画布链接：
  `https://xyq.jianying.com/novel/detail/canvas?overviewPippitAssetId=<overviewId>&projectId=<projectId>`。

---

## 自动化脚本与使用命令

本 Skill 配套自动化生产级部署脚本：
`C:\Users\JW TSJ\.gemini\config\skills\run2\pippit_deploy_seg.py`

### 常用命令

```bash
# 导入指定分集至小云雀画布
python "C:\Users\JW TSJ\.gemini\config\skills\run2\pippit_deploy_seg.py" "<分集目录绝对路径>"

# 示例：导入第002集
python "C:\Users\JW TSJ\.gemini\config\skills\run2\pippit_deploy_seg.py" "C:\Users\JW TSJ\Desktop\最新水眼\第002集"
```

当用户在会话中输入 `/run2 第002集` 时，直接触发此工作流并输出交付结果。
