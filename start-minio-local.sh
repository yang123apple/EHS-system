#!/bin/bash
# MinIO 本地启动脚本 (Linux/Mac)
# 当 Docker 不可用时使用此脚本

echo "========================================"
echo "MinIO 本地启动"
echo "========================================"
echo ""

# 检测操作系统和架构
OS="$(uname -s)"
ARCH="$(uname -m)"
MINIO_BIN=""

# 确定MinIO可执行文件路径
if command -v minio &> /dev/null; then
    # 系统PATH中有MinIO
    MINIO_BIN="minio"
    echo "[信息] 使用系统PATH中的MinIO"
elif [ -f "bin/minio" ]; then
    # bin目录中有MinIO可执行文件
    MINIO_BIN="./bin/minio"
    chmod +x "$MINIO_BIN"
    echo "[信息] 使用项目bin目录中的MinIO"
elif [ -f "bin/minio.exe" ]; then
    # 只有Windows版本，提示用户
    echo "[错误] 检测到bin目录中只有minio.exe（Windows版本）"
    echo ""
    echo "在Mac/Linux上无法直接运行.exe文件。"
    echo ""
    echo "解决方案："
    echo ""
    echo "方案1: 使用Docker（推荐）"
    echo "  docker-compose -f docker-compose.minio.yml up -d"
    echo ""
    echo "方案2: 使用Homebrew安装"
    echo "  brew install minio/stable/minio"
    echo "  然后重新运行此脚本"
    echo ""
    echo "方案3: 自动下载Mac版本到bin目录"
    read -p "是否自动下载Mac版本的MinIO到bin目录? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "[信息] 正在下载MinIO..."
        mkdir -p bin
        
        # 根据架构下载对应的版本
        if [[ "$ARCH" == "arm64" ]]; then
            MINIO_URL="https://dl.min.io/server/minio/release/darwin-arm64/minio"
        else
            MINIO_URL="https://dl.min.io/server/minio/release/darwin-amd64/minio"
        fi
        
        if curl -L -o bin/minio "$MINIO_URL"; then
            chmod +x bin/minio
            MINIO_BIN="./bin/minio"
            echo "[成功] MinIO已下载到bin目录"
        else
            echo "[错误] 下载失败，请手动下载"
            echo "  Mac (Intel): curl -O https://dl.min.io/server/minio/release/darwin-amd64/minio"
            echo "  Mac (Apple Silicon): curl -O https://dl.min.io/server/minio/release/darwin-arm64/minio"
            exit 1
        fi
    else
        exit 1
    fi
else
    echo "[错误] 未找到MinIO"
    echo ""
    echo "请选择安装方式:"
    echo ""
    echo "方案1: 使用Homebrew安装（推荐）"
    echo "  brew install minio/stable/minio"
    echo ""
    echo "方案2: 手动下载到bin目录"
    if [[ "$ARCH" == "arm64" ]]; then
        echo "  mkdir -p bin && curl -L -o bin/minio https://dl.min.io/server/minio/release/darwin-arm64/minio"
    else
        echo "  mkdir -p bin && curl -L -o bin/minio https://dl.min.io/server/minio/release/darwin-amd64/minio"
    fi
    echo "  chmod +x bin/minio"
    echo ""
    echo "方案3: 使用Docker"
    echo "  docker-compose -f docker-compose.minio.yml up -d"
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
"$MINIO_BIN" server ./data/minio-data --console-address ":9001"

