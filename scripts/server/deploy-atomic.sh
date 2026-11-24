#!/usr/bin/env sh
set -eu

# 校验并构建静态站点，随后原子替换部署目录内容。
npm run build

TARGET_DIR="${DEPLOY_SITE_DIR:-/app/deploy/site}"
STAGE_DIR="${TARGET_DIR}.staging.$$"

mkdir -p "$TARGET_DIR"
rm -rf "$STAGE_DIR"
cp -a dist "$STAGE_DIR"

# 清空旧文件并原子移入新构建产物（同一挂载点下操作）。
find "$TARGET_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
mv "$STAGE_DIR"/* "$TARGET_DIR"/
rmdir "$STAGE_DIR"

echo "站点已构建并发布到 $TARGET_DIR"
