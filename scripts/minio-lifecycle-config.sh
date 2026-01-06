#!/bin/bash
#
# MinIO 生命周期管理配置脚本
# 使用 mc ilm 命令配置自动清理 temp/ 目录下的过期文件
#
# 策略：temp/ 目录下的文件如果超过 24 小时未移动/重命名则自动删除
#
# 使用方法：
#   ./scripts/minio-lifecycle-config.sh [--apply]
#
# 参数：
#   --apply: 实际应用配置（默认仅显示配置）

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# MinIO 配置
MINIO_ENDPOINT="${MINIO_ENDPOINT:-localhost}"
MINIO_PORT="${MINIO_PORT:-9000}"
MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-${MINIO_ROOT_USER:-admin}}"
MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-${MINIO_ROOT_PASSWORD:-change-me-now}}"
MINIO_ALIAS="minio-primary"

BUCKETS=("ehs-private" "ehs-public")
TEMP_PREFIX="temp/"
EXPIRY_DAYS=1  # 1 天 = 24 小时

# 检查 mc 命令
if ! command -v mc &> /dev/null; then
    echo "❌ mc 命令未找到。请安装 MinIO Client"
    exit 1
fi

# 配置 MinIO 别名
echo "配置 MinIO 别名: $MINIO_ALIAS"
mc alias set "$MINIO_ALIAS" \
    "http://$MINIO_ENDPOINT:$MINIO_PORT" \
    "$MINIO_ACCESS_KEY" \
    "$MINIO_SECRET_KEY" || {
    echo "❌ 配置 MinIO 别名失败"
    exit 1
}

# 生命周期配置 JSON
LIFECYCLE_CONFIG=$(cat <<EOF
{
  "Rules": [
    {
      "ID": "temp-cleanup-rule",
      "Status": "Enabled",
      "Filter": {
        "Prefix": "temp/"
      },
      "Expiration": {
        "Days": $EXPIRY_DAYS
      }
    }
  ]
}
EOF
)

echo ""
echo "=========================================="
echo "MinIO 生命周期管理配置"
echo "=========================================="
echo ""
echo "配置内容:"
echo "$LIFECYCLE_CONFIG" | jq '.' 2>/dev/null || echo "$LIFECYCLE_CONFIG"
echo ""

if [[ "$1" != "--apply" ]]; then
    echo "⚠️  DRY-RUN 模式，未实际应用配置"
    echo "   运行时不加 --apply 参数以实际应用配置"
    echo ""
    echo "应用命令示例:"
    for bucket in "${BUCKETS[@]}"; do
        echo "  mc ilm import $MINIO_ALIAS/$bucket <<'LIFECYCLE'"
        echo "$LIFECYCLE_CONFIG"
        echo "LIFECYCLE"
    done
    exit 0
fi

# 应用配置
echo "应用生命周期配置..."
for bucket in "${BUCKETS[@]}"; do
    echo ""
    echo "配置 Bucket: $bucket"
    
    # 检查 Bucket 是否存在
    if ! mc ls "$MINIO_ALIAS/$bucket" &>/dev/null; then
        echo "  ⚠️  Bucket 不存在，跳过"
        continue
    fi
    
    # 应用生命周期配置
    echo "$LIFECYCLE_CONFIG" | mc ilm import "$MINIO_ALIAS/$bucket" || {
        echo "  ❌ 配置失败"
        continue
    }
    
    echo "  ✅ 配置成功"
    
    # 验证配置
    echo "  验证配置..."
    mc ilm ls "$MINIO_ALIAS/$bucket" || {
        echo "  ⚠️  无法验证配置（可能需要等待生效）"
    }
done

echo ""
echo "=========================================="
echo "配置完成"
echo "=========================================="
echo ""
echo "说明:"
echo "  - temp/ 目录下的文件将在 $EXPIRY_DAYS 天后自动删除"
echo "  - 配置会在 MinIO 服务器重启后生效"
echo "  - 可以使用 'mc ilm ls <alias>/<bucket>' 查看配置"
echo ""

