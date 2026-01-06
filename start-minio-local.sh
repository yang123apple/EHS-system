#!/bin/bash
# MinIO 本地启动脚本 (Linux/Mac)
# 当 Docker 不可用时使用此脚本

echo "========================================"
echo "MinIO 本地启动"
echo "========================================"
echo ""

# 检查 MinIO 是否已安装
if ! command -v minio &> /dev/null; then
    echo "[错误] MinIO 未安装"
    echo ""
    echo "请先安装 MinIO:"
    echo "  Linux:"
    echo "    wget https://dl.min.io/server/minio/release/linux-amd64/minio"
    echo "    chmod +x minio"
    echo "    sudo mv minio /usr/local/bin/"
    echo ""
    echo "  Mac:"
    echo "    brew install minio/stable/minio"
    echo ""
    exit 1
fi

# 设置环境变量
export MINIO_ROOT_USER=admin
export MINIO_ROOT_PASSWORD=change-me-now

# 创建数据目录
mkdir -p ./data/minio-data

echo "启动 MinIO 服务器..."
echo "  端点: http://localhost:9000"
echo "  Console: http://localhost:9001"
echo "  用户名: admin"
echo "  密码: change-me-now"
echo ""
echo "按 Ctrl+C 停止服务器"
echo ""

# 启动 MinIO
minio server ./data/minio-data --console-address ":9001"

