#!/usr/bin/env bash
set -e

# Auto & STX Linux / Ubuntu Server Installer
TARGET_DIR="${OPENCODE_CONFIG:-$HOME/.config/opencode}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== Installing Auto & STX to: $TARGET_DIR ==="

mkdir -p "$TARGET_DIR/skills"
mkdir -p "$TARGET_DIR/commands"
mkdir -p "$TARGET_DIR/agents"
mkdir -p "$TARGET_DIR/plugins"
mkdir -p "$TARGET_DIR/auto-d-runtime"

# 1. Copy Skills
echo "-> Copying skills (auto, stx, multi-image-generation)..."
cp -r "$SCRIPT_DIR/skills/auto" "$TARGET_DIR/skills/"
cp -r "$SCRIPT_DIR/skills/stx" "$TARGET_DIR/skills/"
cp -r "$SCRIPT_DIR/skills/multi-image-generation" "$TARGET_DIR/skills/"

# 2. Copy Commands
echo "-> Copying commands (/分集, /分镜, /stx, /st)..."
cp "$SCRIPT_DIR/commands/"*.md "$TARGET_DIR/commands/"

# 3. Copy Agents
echo "-> Copying agents..."
cp "$SCRIPT_DIR/agents/"*.md "$TARGET_DIR/agents/"

# 4. Copy Image Runtime & Plugin
echo "-> Setting up fast-image runtime..."
cp -r "$SCRIPT_DIR/image-runtime/"* "$TARGET_DIR/auto-d-runtime/"
cat << 'EOF' > "$TARGET_DIR/plugins/fast-image.ts"
export { default } from "../auto-d-runtime/plugins/fast-image.ts"
EOF

# 5. Install Dependencies if npm exists
if command -v npm >/dev/null 2>&1; then
    echo "-> Installing dependencies for skills/auto..."
    (cd "$TARGET_DIR/skills/auto" && npm ci --ignore-scripts || npm install --production)
    echo "-> Installing dependencies for auto-d-runtime..."
    (cd "$TARGET_DIR/auto-d-runtime" && npm install --production || true)
fi

echo "=== Installation Completed successfully ==="
echo "Please restart OpenCode or run 'opencode serve' to load the new skills."
