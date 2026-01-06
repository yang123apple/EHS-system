#!/bin/bash
# =============================================================================
# EHS 系统备份与恢复脚本 (Linux/macOS)
# =============================================================================
# 功能：数据库备份、MinIO文件备份、数据恢复
# 作者：DevOps Team
# 版本：1.0.0
# =============================================================================

set -euo pipefail  # 严格模式：遇到错误立即退出

# =============================================================================
# 配置区域（从环境变量或默认值读取）
# =============================================================================

# 脚本目录（自动检测）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 加载 .env 文件（如果存在）
if [ -f ".env" ]; then
    set -a
    source .env
    set +a
fi

# 数据库配置
DB_PATH="${DB_PATH:-prisma/dev.db}"
DB_DIR="$(dirname "$DB_PATH")"
DB_NAME="$(basename "$DB_PATH")"

# MinIO 配置
MINIO_ENDPOINT="${MINIO_ENDPOINT:-localhost}"
MINIO_PORT="${MINIO_PORT:-9000}"
MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-${MINIO_ROOT_USER:-admin}}"
MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-${MINIO_ROOT_PASSWORD:-change-me-now}}"
MINIO_ALIAS="ehs-minio"
MINIO_BUCKETS="${MINIO_BUCKETS:-ehs-private ehs-public}"

# 备份配置
BACKUP_ROOT="${BACKUP_ROOT:-data/backups}"
BACKUP_DB_DIR="$BACKUP_ROOT/database"
BACKUP_MINIO_DIR="$BACKUP_ROOT/minio"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# 日志配置
LOG_FILE="${LOG_FILE:-ops.log}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# =============================================================================
# 工具函数
# =============================================================================

log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

log_info() {
    log "INFO" "$@"
    echo -e "${BLUE}ℹ${NC} $*"
}

log_success() {
    log "SUCCESS" "$@"
    echo -e "${GREEN}✓${NC} $*"
}

log_warning() {
    log "WARNING" "$@"
    echo -e "${YELLOW}⚠${NC} $*"
}

log_error() {
    log "ERROR" "$@"
    echo -e "${RED}✗${NC} $*" >&2
}

# 检查命令是否存在
check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "命令 '$1' 未找到，请先安装"
        case "$1" in
            sqlite3)
                echo "  安装方法: sudo apt-get install sqlite3  # Ubuntu/Debian"
                echo "            brew install sqlite3          # macOS"
                ;;
            mc)
                echo "  安装方法: wget https://dl.min.io/client/mc/release/linux-amd64/mc"
                echo "           chmod +x mc && sudo mv mc /usr/local/bin/"
                echo "   或访问: https://min.io/download#/linux"
                ;;
        esac
        exit 1
    fi
}

# 检查依赖
check_dependencies() {
    log_info "检查依赖..."
    check_command sqlite3
    check_command mc
    log_success "所有依赖已就绪"
}

# 创建备份目录
ensure_backup_dirs() {
    mkdir -p "$BACKUP_DB_DIR"
    mkdir -p "$BACKUP_MINIO_DIR"
    log_info "备份目录已就绪: $BACKUP_ROOT"
}

# =============================================================================
# MinIO 配置函数
# =============================================================================

configure_minio_alias() {
    log_info "配置 MinIO Client alias..."
    
    # 检查 alias 是否已存在
    if mc alias list | grep -q "^$MINIO_ALIAS"; then
        log_info "MinIO alias '$MINIO_ALIAS' 已存在，跳过配置"
        return 0
    fi
    
    # 构建 MinIO 端点 URL
    local minio_url="http://${MINIO_ENDPOINT}:${MINIO_PORT}"
    
    # 配置 alias
    if mc alias set "$MINIO_ALIAS" "$minio_url" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" 2>&1 | tee -a "$LOG_FILE"; then
        log_success "MinIO alias 配置成功"
    else
        log_error "MinIO alias 配置失败，请检查服务是否运行"
        log_error "启动命令: docker-compose -f docker-compose.minio.yml up -d"
        exit 1
    fi
}

# 测试 MinIO 连接
test_minio_connection() {
    log_info "测试 MinIO 连接..."
    if mc admin info "$MINIO_ALIAS" &> /dev/null; then
        log_success "MinIO 连接正常"
        return 0
    else
        log_error "MinIO 连接失败，请检查服务状态"
        return 1
    fi
}

# =============================================================================
# 数据库备份函数
# =============================================================================

backup_database() {
    log_info "开始数据库备份..."
    
    # Pre-check: 数据库完整性检查
    log_info "执行数据库完整性检查..."
    local integrity_result
    integrity_result=$(sqlite3 "$DB_PATH" "PRAGMA integrity_check;" 2>&1)
    
    if echo "$integrity_result" | grep -q "ok"; then
        log_success "数据库完整性检查通过"
    else
        log_error "数据库完整性检查失败: $integrity_result"
        exit 1
    fi
    
    # 生成备份文件名（带时间戳）
    local timestamp=$(date '+%Y%m%d_%H%M%S')
    local backup_file="$BACKUP_DB_DIR/${DB_NAME}.backup_${timestamp}"
    local backup_wal="${backup_file}-wal"
    local backup_shm="${backup_file}-shm"
    
    # 执行热备份（不停止服务）
    log_info "执行 SQLite 热备份..."
    if sqlite3 "$DB_PATH" ".backup '$backup_file'" 2>&1 | tee -a "$LOG_FILE"; then
        log_success "数据库备份完成: $backup_file"
    else
        log_error "数据库备份失败"
        exit 1
    fi
    
    # 备份 WAL 和 SHM 文件（如果存在）
    if [ -f "${DB_PATH}-wal" ]; then
        cp "${DB_PATH}-wal" "$backup_wal"
        log_success "WAL 文件已备份: $backup_wal"
    fi
    
    if [ -f "${DB_PATH}-shm" ]; then
        cp "${DB_PATH}-shm" "$backup_shm"
        log_success "SHM 文件已备份: $backup_shm"
    fi
    
    # 压缩备份（可选）
    if command -v gzip &> /dev/null; then
        log_info "压缩备份文件..."
        gzip -f "$backup_file"
        log_success "备份已压缩: ${backup_file}.gz"
    fi
    
    echo "$backup_file"
}

# =============================================================================
# MinIO 备份函数
# =============================================================================

backup_minio() {
    log_info "开始 MinIO 文件备份..."
    
    # 配置 MinIO alias
    configure_minio_alias
    
    # 测试连接
    if ! test_minio_connection; then
        exit 1
    fi
    
    # 备份每个 Bucket
    local timestamp=$(date '+%Y%m%d_%H%M%S')
    local backup_base="$BACKUP_MINIO_DIR/$timestamp"
    mkdir -p "$backup_base"
    
    for bucket in $MINIO_BUCKETS; do
        log_info "备份 Bucket: $bucket"
        local bucket_backup_dir="$backup_base/$bucket"
        mkdir -p "$bucket_backup_dir"
        
        # 使用 mc mirror 进行增量同步
        if mc mirror "$MINIO_ALIAS/$bucket" "$bucket_backup_dir" 2>&1 | tee -a "$LOG_FILE"; then
            log_success "Bucket '$bucket' 备份完成: $bucket_backup_dir"
        else
            log_warning "Bucket '$bucket' 备份可能不完整，请检查日志"
        fi
    done
    
    echo "$backup_base"
}

# =============================================================================
# 清理旧备份
# =============================================================================

cleanup_old_backups() {
    log_info "清理 $RETENTION_DAYS 天前的旧备份..."
    
    local cutoff_date=$(date -d "$RETENTION_DAYS days ago" '+%Y%m%d' 2>/dev/null || date -v-${RETENTION_DAYS}d '+%Y%m%d' 2>/dev/null || echo "")
    
    if [ -z "$cutoff_date" ]; then
        log_warning "无法计算截止日期，跳过清理"
        return
    fi
    
    # 清理数据库备份
    find "$BACKUP_DB_DIR" -type f -name "*.backup_*" -o -name "*.backup_*.gz" | while read -r file; do
        local file_date=$(basename "$file" | grep -oE '[0-9]{8}' | head -1)
        if [ -n "$file_date" ] && [ "$file_date" -lt "$cutoff_date" ]; then
            rm -f "$file" "${file}-wal" "${file}-shm"
            log_info "已删除旧备份: $(basename "$file")"
        fi
    done
    
    # 清理 MinIO 备份
    find "$BACKUP_MINIO_DIR" -type d -maxdepth 1 -name "[0-9]*" | while read -r dir; do
        local dir_date=$(basename "$dir")
        if [ -n "$dir_date" ] && [ "$dir_date" -lt "$cutoff_date" ]; then
            rm -rf "$dir"
            log_info "已删除旧备份目录: $dir_date"
        fi
    done
    
    log_success "清理完成"
}

# =============================================================================
# 备份主函数
# =============================================================================

backup() {
    log_info "========== 开始备份流程 =========="
    
    # 检查依赖
    check_dependencies
    
    # 创建备份目录
    ensure_backup_dirs
    
    # 备份数据库
    local db_backup=$(backup_database)
    
    # 备份 MinIO
    local minio_backup=$(backup_minio)
    
    # 清理旧备份
    cleanup_old_backups
    
    log_success "========== 备份完成 =========="
    log_success "数据库备份: $db_backup"
    log_success "MinIO 备份: $minio_backup"
}

# =============================================================================
# 恢复函数
# =============================================================================

list_backups() {
    log_info "可用的备份时间点:"
    echo ""
    
    # 列出数据库备份
    echo "数据库备份:"
    local db_backups=()
    while IFS= read -r -d '' file; do
        local timestamp=$(basename "$file" | grep -oE '[0-9]{8}_[0-9]{6}' | head -1)
        if [ -n "$timestamp" ]; then
            db_backups+=("$timestamp|$file")
            echo "  [$timestamp] $file"
        fi
    done < <(find "$BACKUP_DB_DIR" -type f \( -name "*.backup_*" -o -name "*.backup_*.gz" \) -print0 | sort -z -r)
    
    echo ""
    echo "MinIO 备份:"
    local minio_backups=()
    for dir in "$BACKUP_MINIO_DIR"/*/; do
        if [ -d "$dir" ]; then
            local timestamp=$(basename "$dir")
            minio_backups+=("$timestamp|$dir")
            echo "  [$timestamp] $dir"
        fi
    done | sort -r
    
    echo ""
    
    # 返回备份列表（用于脚本调用）
    printf '%s\n' "${db_backups[@]}" "${minio_backups[@]}"
}

restore_database() {
    local backup_file="$1"
    
    log_warning "========== 警告 =========="
    log_warning "此操作将覆盖当前数据库文件: $DB_PATH"
    log_warning "当前数据将被永久删除！"
    echo ""
    read -p "确认继续？(输入 'YES' 继续): " confirm
    
    if [ "$confirm" != "YES" ]; then
        log_info "恢复操作已取消"
        return 1
    fi
    
    log_info "停止服务（建议手动停止 Next.js 服务）..."
    log_warning "请确保已停止 Next.js 应用，否则可能导致数据损坏"
    read -p "按 Enter 继续..."
    
    # 解压备份文件（如果是压缩的）
    local source_file="$backup_file"
    if [[ "$backup_file" == *.gz ]]; then
        log_info "解压备份文件..."
        gunzip -c "$backup_file" > "${backup_file%.gz}"
        source_file="${backup_file%.gz}"
    fi
    
    # 备份当前数据库（以防万一）
    local current_backup="${DB_PATH}.before_restore_$(date +%s)"
    if [ -f "$DB_PATH" ]; then
        cp "$DB_PATH" "$current_backup"
        log_info "当前数据库已备份到: $current_backup"
    fi
    
    # 恢复数据库
    log_info "恢复数据库..."
    if sqlite3 "$source_file" ".backup '$DB_PATH'" 2>&1 | tee -a "$LOG_FILE"; then
        log_success "数据库恢复成功"
    else
        log_error "数据库恢复失败"
        # 尝试恢复原数据库
        if [ -f "$current_backup" ]; then
            log_warning "尝试恢复原数据库..."
            cp "$current_backup" "$DB_PATH"
        fi
        exit 1
    fi
    
    # 清理旧的 WAL/SHM 文件
    rm -f "${DB_PATH}-wal" "${DB_PATH}-shm"
    log_success "已清理旧的 WAL/SHM 文件"
    
    # 清理临时解压文件
    if [ "$source_file" != "$backup_file" ] && [ -f "$source_file" ]; then
        rm -f "$source_file"
    fi
}

restore_minio() {
    local backup_dir="$1"
    
    log_warning "========== 警告 =========="
    log_warning "此操作将覆盖 MinIO 中的文件"
    log_warning "当前文件可能被永久删除！"
    echo ""
    read -p "确认继续？(输入 'YES' 继续): " confirm
    
    if [ "$confirm" != "YES" ]; then
        log_info "恢复操作已取消"
        return 1
    fi
    
    # 配置 MinIO alias
    configure_minio_alias
    
    # 测试连接
    if ! test_minio_connection; then
        exit 1
    fi
    
    # 恢复每个 Bucket
    for bucket_dir in "$backup_dir"/*/; do
        if [ -d "$bucket_dir" ]; then
            local bucket=$(basename "$bucket_dir")
            log_info "恢复 Bucket: $bucket"
            
            # 使用 mc mirror 反向同步
            if mc mirror --overwrite "$bucket_dir" "$MINIO_ALIAS/$bucket" 2>&1 | tee -a "$LOG_FILE"; then
                log_success "Bucket '$bucket' 恢复完成"
            else
                log_error "Bucket '$bucket' 恢复失败"
                exit 1
            fi
        fi
    done
    
    log_success "MinIO 恢复完成"
}

restore() {
    log_info "========== 开始恢复流程 =========="
    
    # 列出可用备份
    list_backups
    
    # 选择备份时间点
    echo ""
    read -p "请输入要恢复的时间点 (格式: YYYYMMDD_HHMMSS 或 YYYYMMDDHHMMSS): " timestamp
    
    if [ -z "$timestamp" ]; then
        log_error "时间点不能为空"
        exit 1
    fi
    
    # 标准化时间戳格式
    if [[ "$timestamp" =~ ^[0-9]{8}_[0-9]{6}$ ]]; then
        # 已经是正确格式
        :
    elif [[ "$timestamp" =~ ^[0-9]{14}$ ]]; then
        # 转换为带下划线的格式
        timestamp="${timestamp:0:8}_${timestamp:8:6}"
    else
        log_error "时间戳格式错误"
        exit 1
    fi
    
    # 查找数据库备份
    local db_backup=$(find "$BACKUP_DB_DIR" -type f \( -name "*${timestamp}*" -o -name "*${timestamp}*.gz" \) | head -1)
    
    # 查找 MinIO 备份
    local minio_backup=$(find "$BACKUP_MINIO_DIR" -type d -name "${timestamp:0:8}*" | head -1)
    
    if [ -z "$db_backup" ] && [ -z "$minio_backup" ]; then
        log_error "未找到时间点 '$timestamp' 的备份"
        exit 1
    fi
    
    # 恢复数据库
    if [ -n "$db_backup" ]; then
        restore_database "$db_backup"
    else
        log_warning "未找到数据库备份，跳过数据库恢复"
    fi
    
    # 恢复 MinIO
    if [ -n "$minio_backup" ]; then
        restore_minio "$minio_backup"
    else
        log_warning "未找到 MinIO 备份，跳过文件恢复"
    fi
    
    log_success "========== 恢复完成 =========="
    log_warning "请重启 Next.js 应用以应用更改"
}

# =============================================================================
# 主程序入口
# =============================================================================

show_help() {
    cat << EOF
用法: $0 [命令]

命令:
  backup      执行完整备份（数据库 + MinIO）
  restore     交互式恢复数据
  list        列出所有可用备份
  help        显示此帮助信息

环境变量:
  DB_PATH             数据库路径 (默认: prisma/dev.db)
  MINIO_ENDPOINT      MinIO 端点 (默认: localhost)
  MINIO_PORT          MinIO 端口 (默认: 9000)
  MINIO_ACCESS_KEY    MinIO 访问密钥
  MINIO_SECRET_KEY    MinIO 秘密密钥
  BACKUP_ROOT         备份根目录 (默认: data/backups)
  RETENTION_DAYS      备份保留天数 (默认: 30)

示例:
  $0 backup                    # 执行备份
  $0 restore                   # 交互式恢复
  $0 list                      # 列出备份

EOF
}

main() {
    local command="${1:-help}"
    
    case "$command" in
        backup)
            backup
            ;;
        restore)
            restore
            ;;
        list)
            list_backups
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "未知命令: $command"
            show_help
            exit 1
            ;;
    esac
}

# 执行主程序
main "$@"

