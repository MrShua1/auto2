# Auto & STX 生产套件 (Auto Suite)

本仓库包含 **Auto 工业级短片生产技能** 与 **STX 图像生成工具链**，专用于服务器与本地环境的自动化部署与快速验证。

## 目录结构

```text
├── skills/
│   ├── auto/                   # Auto 完整生产主技能（含 8 个内置核心模块）
│   ├── stx/                    # STX 图片生成技能
│   └── multi-image-generation/ # 多图并发辅助技能
├── commands/                   # 斜杠命令 (/分集, /分镜, /stx, /st)
├── agents/                     # 智能体设定 (image-fast 等)
├── image-runtime/              # 图片生成底层插件与运行环境
├── install-linux.sh            # Linux / Ubuntu Server 一键安装脚本
└── README.md
```

## 服务器端（Ubuntu / Linux）安装与使用

### 1. 克隆本私有仓库
```bash
git clone <本仓库私有地址> auto-suite
cd auto-suite
```

### 2. 执行安装脚本
默认安装至 `~/.config/opencode`：
```bash
chmod +x install-linux.sh
./install-linux.sh
```

### 3. 重启并验证
重启 OpenCode 宿主：
```bash
opencode serve
```
验证可用命令与技能：
* `/分集` 或 `/分镜`：触发 Auto 剧本到预视频工程
* `/stx`：触发 STX 高性能生图通道
