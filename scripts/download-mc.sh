#!/bin/bash
#
# 下载 MinIO Client (mc) 到项目 bin 目录
# 使用方法: bash scripts/download-mc.sh
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BIN_DIR="$PROJECT_ROOT/bin"

# 颜色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}MinIO Client (mc) 下载工具${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 检测操作系统和架构
OS=$(uname -s)
ARCH=$(uname -m)

case "$OS" in
    Darwin*)
        if [ "$ARCH" = "arm64" ]; then
            # Apple Silicon (M1/M2/M3)
            MC_URL="https://dl.min.io/client/mc/release/darwin-arm64/mc"
            echo "检测到: macOS (Apple Silicon)"
        else
            # Intel Mac
            MC_URL="https://dl.min.io/client/mc/release/darwin-amd64/mc"
            echo "检测到: macOS (Intel)"
        fi
        ;;
    Linux*)
        if [ "$ARCH" = "x86_64" ]; then
            MC_URL="https://dl.min.io/client/mc/release/linux-amd64/mc"
            echo "检测到: Linux (x86_64)"
        elif [ "$ARCH" = "aarch64" ]; then
            MC_URL="https://dl.min.io/client/mc/release/linux-arm64/mc"
            echo "检测到: Linux (ARM64)"
        else
            echo -e "${RED}不支持的架构: $ARCH${NC}"
            exit 1
        fi
        ;;
    *)
        echo -e "${RED}不支持的操作系统: $OS${NC}"
        echo "请访问 https://min.io/docs/minio/linux/reference/minio-mc.html 手动下载"
        exit 1
        ;;
esac

# 创建 bin 目录
mkdir -p "$BIN_DIR"

echo "下载 URL: $MC_URL"
echo "目标路径: $BIN_DIR/mc"
echo ""

# 下载
echo "正在下载..."
if curl -# -o "$BIN_DIR/mc" "$MC_URL"; then
    echo -e "${GREEN}✓ 下载成功${NC}"
else
    echo -e "${RED}✗ 下载失败${NC}"
    exit 1
fi

# 添加执行权限
chmod +x "$BIN_DIR/mc"
echo -e "${GREEN}✓ 已添加执行权限${NC}"

# 验证
if "$BIN_DIR/mc" --version &> /dev/null; then
    echo -e "${GREEN}✓ 验证成功${NC}"
    echo ""
    "$BIN_DIR/mc" --version
else
    echo -e "${RED}✗ 验证失败${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}MinIO Client 安装完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "现在可以运行备份脚本："
echo "  bash scripts/sync-minio.sh incremental"
echo ""
