#!/bin/bash
#
# MinIO 增量同步备份脚本
# 使用 mc mirror 命令实现 MinIO 数据到本地备份目录的增量同步
#
# 为什么使用 mc mirror 而不是 Node.js 处理大文件？
# 1. 性能优势：mc 是 C++ 实现，直接调用 MinIO API，比 Node.js 流式处理快 10-100 倍
# 2. 内存效率：mc mirror 使用流式传输，不会将整个文件加载到内存
# 3. 增量同步：mc 自动检测文件变化（基于 ETag 和修改时间），只传输变化的部分
# 4. 断点续传：支持中断后继续传输，适合 GB 级大文件
# 5. 解耦执行：在独立进程中运行，不阻塞 Node.js Event Loop
# 6. 原生压缩：MinIO 支持服务端压缩，减少网络传输
#
# 使用方法：
#   ./scripts/sync-minio.sh [full|incremental] [backup-target]
#
# 参数：
#   - full: 全量同步（首次或定期全量备份）
#   - incremental: 增量同步（默认，只同步变化文件）
#   - backup-target: 备份目标路径（可选，默认 ./data/minio-backup）

set -e  # 遇到错误立即退出

# 配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_MODE="${1:-incremental}"  # full 或 incremental
BACKUP_TARGET="${2:-$PROJECT_ROOT/data/minio-backup}"

# MinIO 配置（从环境变量读取）
MINIO_ENDPOINT="${MINIO_ENDPOINT:-localhost}"
MINIO_PORT="${MINIO_PORT:-9000}"
MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-${MINIO_ROOT_USER:-admin}}"
MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-${MINIO_ROOT_PASSWORD:-change-me-now}}"
MINIO_ALIAS="minio-primary"

# 日志配置
LOG_DIR="$PROJECT_ROOT/logs"
LOG_FILE="$LOG_DIR/minio-sync-$(date +%Y%m%d).log"
mkdir -p "$LOG_DIR"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a "$LOG_FILE" >&2
}

log_warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a "$LOG_FILE"
}

# 检查 mc 命令是否可用
check_mc() {
    if command -v mc &> /dev/null; then
        MC_CMD="mc"
        return 0
    fi
    
    # 检查 Docker 容器
    if docker ps | grep -q ehs-mc; then
        MC_CMD="docker exec ehs-mc mc"
        log "使用 Docker 容器中的 mc 命令"
        return 0
    fi
    
    log_error "mc 命令未找到。请安装 MinIO Client 或启动 Docker 容器"
    return 1
}

# 配置 MinIO 别名
setup_mc_alias() {
    log "配置 MinIO 别名: $MINIO_ALIAS"
    
    if [ "$MC_CMD" = "mc" ]; then
        # 本地 mc 命令
        $MC_CMD alias set "$MINIO_ALIAS" \
            "http://$MINIO_ENDPOINT:$MINIO_PORT" \
            "$MINIO_ACCESS_KEY" \
            "$MINIO_SECRET_KEY" || {
            log_error "配置 MinIO 别名失败"
            return 1
        }
    else
        # Docker 容器中的 mc
        # 环境变量已在 docker-compose.yml 中配置
        log "使用 Docker 容器环境变量配置"
    fi
    
    log_success "MinIO 别名配置完成"
}

# 测试 MinIO 连接
test_connection() {
    log "测试 MinIO 连接..."
    
    if [ "$MC_CMD" = "mc" ]; then
        $MC_CMD admin info "$MINIO_ALIAS" > /dev/null 2>&1 || {
            log_error "无法连接到 MinIO 服务器"
            return 1
        }
    else
        # Docker 容器中，使用环境变量
        docker exec ehs-mc mc admin info minio > /dev/null 2>&1 || {
            log_error "无法连接到 MinIO 服务器"
            return 1
        }
        MINIO_ALIAS="minio"  # Docker 容器中使用环境变量定义的别名
    fi
    
    log_success "MinIO 连接测试成功"
}

# 执行全量同步
sync_full() {
    log "=========================================="
    log "开始全量同步备份"
    log "=========================================="
    log "源: $MINIO_ALIAS"
    log "目标: $BACKUP_TARGET"
    log ""
    
    # 确保备份目录存在
    mkdir -p "$BACKUP_TARGET"
    
    # 同步所有 Bucket
    for bucket in ehs-private ehs-public; do
        log "同步 Bucket: $bucket"
        
        BUCKET_BACKUP_DIR="$BACKUP_TARGET/$bucket"
        mkdir -p "$BUCKET_BACKUP_DIR"
        
        if [ "$MC_CMD" = "mc" ]; then
            $MC_CMD mirror \
                --overwrite \
                --remove \
                "$MINIO_ALIAS/$bucket" \
                "$BUCKET_BACKUP_DIR" \
                2>&1 | tee -a "$LOG_FILE"
        else
            docker exec ehs-mc mc mirror \
                --overwrite \
                --remove \
                "minio/$bucket" \
                "/backup/$bucket" \
                2>&1 | tee -a "$LOG_FILE"
        fi
        
        if [ $? -eq 0 ]; then
            log_success "Bucket $bucket 全量同步完成"
        else
            log_error "Bucket $bucket 全量同步失败"
            return 1
        fi
    done
    
    log_success "全量同步完成"
}

# 执行增量同步
sync_incremental() {
    log "=========================================="
    log "开始增量同步备份"
    log "=========================================="
    log "源: $MINIO_ALIAS"
    log "目标: $BACKUP_TARGET"
    log ""
    
    # 确保备份目录存在
    mkdir -p "$BACKUP_TARGET"
    
    # 同步所有 Bucket（增量模式）
    for bucket in ehs-private ehs-public; do
        log "增量同步 Bucket: $bucket"
        
        BUCKET_BACKUP_DIR="$BACKUP_TARGET/$bucket"
        mkdir -p "$BUCKET_BACKUP_DIR"
        
        if [ "$MC_CMD" = "mc" ]; then
            # 增量同步：只同步变化的文件
            # --watch 模式会持续监控，这里不使用，只做一次性同步
            $MC_CMD mirror \
                --overwrite \
                "$MINIO_ALIAS/$bucket" \
                "$BUCKET_BACKUP_DIR" \
                2>&1 | tee -a "$LOG_FILE"
        else
            docker exec ehs-mc mc mirror \
                --overwrite \
                "minio/$bucket" \
                "/backup/$bucket" \
                2>&1 | tee -a "$LOG_FILE"
        fi
        
        if [ $? -eq 0 ]; then
            log_success "Bucket $bucket 增量同步完成"
        else
            log_error "Bucket $bucket 增量同步失败"
            return 1
        fi
    done
    
    log_success "增量同步完成"
}

# 生成同步报告
generate_report() {
    log "=========================================="
    log "生成同步报告"
    log "=========================================="
    
    TOTAL_SIZE=0
    TOTAL_FILES=0
    
    for bucket in ehs-private ehs-public; do
        BUCKET_BACKUP_DIR="$BACKUP_TARGET/$bucket"
        if [ -d "$BUCKET_BACKUP_DIR" ]; then
            BUCKET_SIZE=$(du -sb "$BUCKET_BACKUP_DIR" 2>/dev/null | cut -f1 || echo "0")
            BUCKET_FILES=$(find "$BUCKET_BACKUP_DIR" -type f 2>/dev/null | wc -l || echo "0")
            TOTAL_SIZE=$((TOTAL_SIZE + BUCKET_SIZE))
            TOTAL_FILES=$((TOTAL_FILES + BUCKET_FILES))
            
            SIZE_MB=$(echo "scale=2; $BUCKET_SIZE / 1024 / 1024" | bc)
            log "  $bucket: $BUCKET_FILES 个文件, ${SIZE_MB} MB"
        fi
    done
    
    TOTAL_SIZE_MB=$(echo "scale=2; $TOTAL_SIZE / 1024 / 1024" | bc)
    log_success "总计: $TOTAL_FILES 个文件, ${TOTAL_SIZE_MB} MB"
}

# 主函数
main() {
    log "=========================================="
    log "MinIO 同步备份脚本"
    log "=========================================="
    log "模式: $BACKUP_MODE"
    log "目标: $BACKUP_TARGET"
    log ""
    
    # 检查 mc 命令
    if ! check_mc; then
        exit 1
    fi
    
    # 配置别名（仅本地 mc）
    if [ "$MC_CMD" = "mc" ]; then
        setup_mc_alias
    fi
    
    # 测试连接
    if ! test_connection; then
        exit 1
    fi
    
    # 执行同步
    START_TIME=$(date +%s)
    
    if [ "$BACKUP_MODE" = "full" ]; then
        sync_full
    else
        sync_incremental
    fi
    
    SYNC_RESULT=$?
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    
    # 生成报告
    if [ $SYNC_RESULT -eq 0 ]; then
        generate_report
        log_success "同步完成，耗时: ${DURATION} 秒"
    else
        log_error "同步失败，耗时: ${DURATION} 秒"
        exit 1
    fi
}

# 执行主函数
main "$@"

