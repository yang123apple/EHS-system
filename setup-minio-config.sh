#!/bin/bash
# MinIO 配置设置脚本 (Bash)
# 自动创建 .env.local 文件并配置 MinIO

echo "========================================"
echo "MinIO 配置设置"
echo "========================================"
echo ""

# 检查 .env.local 是否已存在
if [ -f .env.local ]; then
    echo "⚠️  .env.local 文件已存在"
    read -p "是否覆盖现有配置? (y/N) " overwrite
    if [ "$overwrite" != "y" ] && [ "$overwrite" != "Y" ]; then
        echo "已取消操作"
        exit 0
    fi
fi

# 读取配置
echo "请输入 MinIO 配置（直接回车使用默认值）:"
echo ""

read -p "MinIO 端点 [localhost]: " endpoint
endpoint=${endpoint:-localhost}

read -p "MinIO 端口 [9000]: " port
port=${port:-9000}

read -p "使用 SSL? (y/N) [N]: " use_ssl
use_ssl_value="false"
if [ "$use_ssl" = "y" ] || [ "$use_ssl" = "Y" ]; then
    use_ssl_value="true"
fi

read -p "访问密钥 (Access Key) [admin]: " access_key
access_key=${access_key:-admin}

read -p "密钥 (Secret Key) [change-me-now]: " secret_key
secret_key=${secret_key:-change-me-now}

# 生成配置文件内容
cat > .env.local << EOF
# MinIO 对象存储配置
# 自动生成于 $(date '+%Y-%m-%d %H:%M:%S')

# MinIO 服务器端点
MINIO_ENDPOINT=$endpoint
MINIO_PORT=$port
MINIO_USE_SSL=$use_ssl_value

# MinIO 访问凭证
MINIO_ACCESS_KEY=$access_key
MINIO_SECRET_KEY=$secret_key

# MinIO Root 用户（用于 Docker Compose）
MINIO_ROOT_USER=$access_key
MINIO_ROOT_PASSWORD=$secret_key

# 备份配置（可选）
MINIO_PRIMARY_ENDPOINT=http://${endpoint}:${port}
MINIO_PRIMARY_ACCESS_KEY=$access_key
MINIO_PRIMARY_SECRET_KEY=$secret_key
MINIO_BACKUP_TARGET=./data/minio-backup
EOF

echo ""
echo "✅ .env.local 文件已创建"
echo ""
echo "配置摘要:"
echo "  端点: ${endpoint}:${port}"
echo "  SSL: $use_ssl_value"
echo "  访问密钥: $access_key"
echo ""
echo "下一步:"
echo "  1. 启动 MinIO: docker-compose -f docker-compose.minio.yml up -d"
echo "  2. 测试连接: node scripts/test-minio.js"
echo "  3. 启动应用: npm run dev"

