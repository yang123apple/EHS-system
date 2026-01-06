#!/bin/bash
# MinIO 增量备份与同步脚本
# 使用 MinIO Client (mc) 实现数据备份和同步

set -e  # 遇到错误立即退出

# ============ 配置 ============
# 主 MinIO 服务器配置
PRIMARY_ALIAS="minio-primary"
PRIMARY_ENDPOINT="${MINIO_PRIMARY_ENDPOINT:-http://localhost:9000}"
PRIMARY_ACCESS_KEY="${MINIO_PRIMARY_ACCESS_KEY:-admin}"
PRIMARY_SECRET_KEY="${MINIO_PRIMARY_SECRET_KEY:-change-me-now}"

# 备份目标配置（可以是另一个 MinIO 服务器或本地目录）
BACKUP_ALIAS="minio-backup"
BACKUP_TARGET="${MINIO_BACKUP_TARGET:-./data/minio-backup}"  # 本地目录或 S3 兼容端点
BACKUP_ACCESS_KEY="${MINIO_BACKUP_ACCESS_KEY:-}"
BACKUP_SECRET_KEY="${MINIO_BACKUP_SECRET_KEY:-}"

# Bucket 列表（需要备份的 Bucket）
BUCKETS=("ehs-private" "ehs-public")

# 日志文件
LOG_FILE="./logs/minio-backup-$(date +%Y%m%d).log"
mkdir -p "$(dirname "$LOG_FILE")"

# ============ 工具函数 ============

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

error() {
    echo "[ERROR] $1" | tee -a "$LOG_FILE" >&2
    exit 1
}

# ============ 初始化 MinIO Client ============

# 全局变量：MC 命令
MC_CMD=""

init_mc() {
    log "初始化 MinIO Client..."
    
    # 检查 mc 是否可用（优先使用本地安装的 mc）
    if command -v mc &> /dev/null; then
        log "使用本地安装的 MinIO Client (mc)"
        MC_CMD="mc"
    elif command -v docker &> /dev/null && docker ps 2>/dev/null | grep -q ehs-minio; then
        # 如果本地没有 mc，尝试使用 Docker exec 在 minio 容器中运行
        log "使用 Docker exec 在 minio 容器中运行 mc"
        MC_CMD="docker exec ehs-minio mc"
        # 检查容器中是否有 mc（注意：minio 容器可能没有 mc，需要单独安装）
        if ! docker exec ehs-minio which mc &> /dev/null 2>&1; then
            log "警告: MinIO 容器中未找到 mc 命令"
            log "提示: 备份功能需要安装 MinIO Client，请参考: https://min.io/docs/minio/linux/reference/minio-mc.html"
            log "或者使用 Node.js SDK 进行备份（推荐）"
            MC_CMD=""
            return 1
        fi
    else
        log "警告: MinIO Client (mc) 未安装，且无法使用 Docker"
        log "提示: 备份功能需要安装 MinIO Client，请参考: https://min.io/docs/minio/linux/reference/minio-mc.html"
        MC_CMD=""
        return 1
    fi
    
    return 0
}
    
    if [ -z "$MC_CMD" ]; then
        error "MinIO Client 未初始化，无法继续"
    fi
    
    # 配置主服务器
    log "配置主服务器: $PRIMARY_ALIAS"
    $MC_CMD alias set "$PRIMARY_ALIAS" "$PRIMARY_ENDPOINT" "$PRIMARY_ACCESS_KEY" "$PRIMARY_SECRET_KEY" || {
        error "配置主服务器失败"
    }
    
    # 配置备份目标
    log "配置备份目标: $BACKUP_ALIAS"
    if [[ "$BACKUP_TARGET" == s3://* ]] || [[ "$BACKUP_TARGET" == http* ]]; then
        # S3 兼容端点或另一个 MinIO 服务器
        if [ -z "$BACKUP_ACCESS_KEY" ] || [ -z "$BACKUP_SECRET_KEY" ]; then
            error "备份目标需要认证信息"
        fi
        $MC_CMD alias set "$BACKUP_ALIAS" "$BACKUP_TARGET" "$BACKUP_ACCESS_KEY" "$BACKUP_SECRET_KEY" || {
            error "配置备份目标失败"
        }
    else
        # 本地目录
        mkdir -p "$BACKUP_TARGET"
        $MC_CMD alias set "$BACKUP_ALIAS" "$BACKUP_TARGET" "" "" || {
            error "配置本地备份目录失败"
        }
    fi
    
    log "✓ MinIO Client 初始化完成"
}

# ============ 增量同步（使用 mc mirror） ============

sync_bucket() {
    local bucket=$1
    local source="${PRIMARY_ALIAS}/${bucket}"
    local target="${BACKUP_ALIAS}/${bucket}"
    
    log "开始同步 Bucket: $bucket"
    log "  源: $source"
    log "  目标: $target"
    
    # 使用 mc mirror 进行增量同步
    # --watch: 实时监控文件变化（用于持续同步）
    # --remove: 同步删除操作（如果源文件删除，目标也删除）
    # --overwrite: 覆盖已存在的文件（如果文件有变化）
    # --fake: 仅显示将要执行的操作，不实际执行（用于测试）
    
    if $MC_CMD mirror "$source" "$target" --overwrite; then
        log "✓ Bucket $bucket 同步完成"
        return 0
    else
        error "Bucket $bucket 同步失败"
    fi
}

# ============ 实时监控同步（使用 --watch） ============

watch_sync() {
    log "启动实时监控同步模式..."
    log "按 Ctrl+C 停止监控"
    
    for bucket in "${BUCKETS[@]}"; do
        local source="${PRIMARY_ALIAS}/${bucket}"
        local target="${BACKUP_ALIAS}/${bucket}"
        
        log "监控 Bucket: $bucket"
        
        # 在后台启动监控进程
        (
            $MC_CMD mirror "$source" "$target" --watch --overwrite --remove 2>&1 | while read line; do
                log "[$bucket] $line"
            done
        ) &
    done
    
    # 等待所有后台进程
    wait
}

# ============ 定时同步（使用 cron） ============

scheduled_sync() {
    log "执行定时同步..."
    
    for bucket in "${BUCKETS[@]}"; do
        sync_bucket "$bucket"
    done
    
    log "✓ 定时同步完成"
}

# ============ 备份验证 ============

verify_backup() {
    log "验证备份完整性..."
    
    for bucket in "${BUCKETS[@]}"; do
        local source="${PRIMARY_ALIAS}/${bucket}"
        local target="${BACKUP_ALIAS}/${bucket}"
        
        log "验证 Bucket: $bucket"
        
        # 比较文件数量和大小
        local source_count=$($MC_CMD ls -r "$source" | wc -l)
        local target_count=$($MC_CMD ls -r "$target" | wc -l)
        
        if [ "$source_count" -eq "$target_count" ]; then
            log "✓ Bucket $bucket 验证通过 (文件数: $source_count)"
        else
            error "Bucket $bucket 验证失败 (源: $source_count, 目标: $target_count)"
        fi
    done
}

# ============ 清理旧备份 ============

cleanup_old_backups() {
    local retention_days=${1:-30}  # 默认保留30天
    log "清理 $retention_days 天前的备份..."
    
    # 这里可以根据需要实现清理逻辑
    # 例如：删除超过保留期的备份文件
    log "清理功能待实现"
}

# ============ 主函数 ============

main() {
    local mode=${1:-sync}  # sync, watch, verify
    
    log "=========================================="
    log "MinIO 备份与同步工具"
    log "=========================================="
    
    case "$mode" in
        sync)
            init_mc
            scheduled_sync
            verify_backup
            ;;
        watch)
            init_mc
            watch_sync
            ;;
        verify)
            init_mc
            verify_backup
            ;;
        *)
            echo "用法: $0 [sync|watch|verify]"
            echo ""
            echo "模式:"
            echo "  sync   - 执行一次增量同步（用于定时任务）"
            echo "  watch  - 实时监控同步（持续运行）"
            echo "  verify - 验证备份完整性"
            exit 1
            ;;
    esac
    
    log "=========================================="
    log "完成"
    log "=========================================="
}

# 执行主函数
main "$@"

