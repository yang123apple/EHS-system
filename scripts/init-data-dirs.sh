#!/bin/bash
# EHS 系统数据目录初始化脚本
# 用于创建所有必要的数据目录结构

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 基础路径
BASE_DIR="/Users/yangguang/Desktop/EHS"
DATA_DIR="$BASE_DIR/data"
DOCKER_IMAGES_DIR="$BASE_DIR/docker-images"

echo "================================================"
echo "EHS 系统数据目录初始化"
echo "================================================"
echo ""

# 检查基础目录是否存在
if [ ! -d "$BASE_DIR" ]; then
    echo -e "${RED}错误: 基础目录不存在: $BASE_DIR${NC}"
    exit 1
fi

echo "📁 创建数据目录结构..."
echo ""

# 创建所有必要的目录
DIRECTORIES=(
    "$DATA_DIR/db"
    "$DATA_DIR/minio-data"
    "$DATA_DIR/minio-config"
    "$DATA_DIR/minio-backup"
    "$DATA_DIR/restic-repo"
    "$DATA_DIR/restic-cache"
    "$DATA_DIR/restic-logs"
    "$DATA_DIR/restic-staging/db"
    "$DATA_DIR/backups/logs/archives"
    "$DOCKER_IMAGES_DIR"
)

for dir in "${DIRECTORIES[@]}"; do
    if [ -d "$dir" ]; then
        echo -e "${YELLOW}✓${NC} 目录已存在: $dir"
    else
        mkdir -p "$dir"
        echo -e "${GREEN}✓${NC} 创建目录: $dir"
    fi
done

echo ""
echo "📝 创建 Restic 密码文件..."

RESTIC_PASS_FILE="$DATA_DIR/restic-pass"
if [ -f "$RESTIC_PASS_FILE" ]; then
    echo -e "${YELLOW}✓${NC} Restic 密码文件已存在"
else
    # 生成随机密码
    RANDOM_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
    echo "$RANDOM_PASSWORD" > "$RESTIC_PASS_FILE"
    chmod 600 "$RESTIC_PASS_FILE"
    echo -e "${GREEN}✓${NC} 创建 Restic 密码文件: $RESTIC_PASS_FILE"
    echo -e "${YELLOW}⚠️  密码已保存到: $RESTIC_PASS_FILE${NC}"
    echo -e "${YELLOW}⚠️  请妥善保管此密码！${NC}"
fi

echo ""
echo "📊 目录结构概览:"
echo ""
tree -L 3 "$DATA_DIR" 2>/dev/null || find "$DATA_DIR" -maxdepth 3 -type d | sed 's|[^/]*/| |g'

echo ""
echo "================================================"
echo -e "${GREEN}✅ 初始化完成！${NC}"
echo "================================================"
echo ""
echo "📁 数据目录: $DATA_DIR"
echo "🐳 镜像目录: $DOCKER_IMAGES_DIR"
echo ""
echo "下一步:"
echo "  1. 配置环境变量:"
echo "     cd $BASE_DIR/EHS-system"
echo "     cp .env.docker.example .env.docker.local"
echo "     vim .env.docker.local"
echo ""
echo "  2. 构建和启动:"
echo "     docker compose -f docker-compose.prod.yml build"
echo "     python3 scripts/docker_oneclick.py"
echo ""
