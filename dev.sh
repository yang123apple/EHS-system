#!/bin/bash
# =============================================================================
# EHS System 开发环境启动脚本 (Mac/Linux)
# =============================================================================

set -e

# 设置工作目录为脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================"
echo "       EHS System 开发环境启动"
echo "========================================"
echo ""

# 检查 MinIO 是否已在运行（检查端口 9000）
if command -v lsof >/dev/null 2>&1; then
    if lsof -ti:9000 >/dev/null 2>&1; then
        echo "[INFO] MinIO 服务已在运行中"
    else
        echo "[INFO] 正在后台启动 MinIO 服务..."
        
        # 检查是否有 bin/minio
        if [ -f "bin/minio" ]; then
            chmod +x bin/minio
            MINIO_CMD="./bin/minio"
        elif command -v minio >/dev/null 2>&1; then
            MINIO_CMD="minio"
        else
            echo "[WARNING] 未找到 MinIO 可执行文件"
            echo "[INFO] 将尝试使用 Docker 或跳过 MinIO 启动"
            MINIO_CMD=""
        fi
        
        if [ -n "$MINIO_CMD" ]; then
            # 确保数据目录存在
            mkdir -p ./data/minio-data
            
            # 设置环境变量
            export MINIO_ROOT_USER=${MINIO_ROOT_USER:-admin}
            export MINIO_ROOT_PASSWORD=${MINIO_ROOT_PASSWORD:-change-me-now}
            
            # 在后台启动 MinIO
            nohup "$MINIO_CMD" server ./data/minio-data --console-address ":9001" > /dev/null 2>&1 &
            MINIO_PID=$!
            
            # 等待 MinIO 启动
            sleep 2
            
            if ps -p $MINIO_PID > /dev/null 2>&1; then
                echo "[INFO] MinIO 服务已在后台启动 (PID: $MINIO_PID)"
            else
                echo "[WARNING] MinIO 启动可能失败，请检查日志"
            fi
        fi
    fi
else
    echo "[WARNING] 未找到 lsof 命令，无法检测 MinIO 状态"
fi

echo ""
echo "[INFO] 正在启动 Next.js 开发服务器..."
echo "========================================"
echo ""

# 启动 Next.js 开发服务器
npm run dev
