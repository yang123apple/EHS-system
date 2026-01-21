#!/bin/bash
#
# MinIO 增量同步备份脚本
# 使用 mc mirror 命令实现 MinIO 数据到本地备份目录的增量同步
#
# 为什么使用 mc mirror 而不是 Node.js 处理大文件？
# 1. 性能优势：mc 是 C++ 实现，直接调用 MinIO API，比 Node.js 流式处理快 10-100 倍
# 2. 内存效率：mc 使用流式传输，不会将整个文件加载到内存
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

# 加载环境变量
if [ -f "$PROJECT_ROOT/.env.local" ]; then
    # 导出 .env.local 中的变量（只导出 MINIO_ 开头的）
    while IFS='=' read -r key value; do
        # 跳过注释和空行
        [[ "$key" =~ ^#.*$ ]] && continue
        [[ -z "$key" ]] && continue
        # 只处理 MINIO_ 开头的变量
        if [[ "$key" =~ ^MINIO_ ]]; then
            # 移除值两端的引号（如果有）
            value="${value%\"}"
            value="${value#\"}"
            export "$key=$value"
        fi
    done < <(grep -E '^MINIO_' "$PROJECT_ROOT/.env.local")
fi

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
BLUE='\033[0;34m'
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

log_info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] INFO: $1${NC}" | tee -a "$LOG_FILE"
}

# 检测操作系统
detect_os() {
    case "$(uname -s)" in
        Darwin*)    OS="macos" ;;
        Linux*)     OS="linux" ;;
        MINGW*|MSYS*|CYGWIN*) OS="windows" ;;
        *)          OS="unknown" ;;
    esac
}

# 检查 Homebrew 是否安装（仅 macOS）
check_homebrew() {
    if [ "$OS" = "macos" ]; then
        if ! command -v brew &> /dev/null; then
            log_warning "未检测到 Homebrew"
            log_info "可以通过以下命令安装 Homebrew："
            log_info "/bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
            return 1
        fi
        return 0
    fi
    return 1
}

# 尝试自动安装 mc（仅 macOS + Homebrew）
auto_install_mc() {
    if [ "$OS" = "macos" ] && check_homebrew; then
        log_info "检测到 Homebrew，尝试自动安装 MinIO Client (mc)..."
        
        if brew install minio/stable/mc; then
            log_success "MinIO Client 安装成功"
            return 0
        else
            log_error "自动安装失败"
            return 1
        fi
    fi
    
    log_error "自动安装不可用"
    return 1
}

# 提供安装指南
show_install_guide() {
    log_error "MinIO Client (mc) 未安装，且无法自动安装"
    echo ""
    log_info "请手动安装 MinIO Client："
    echo ""
    
    case "$OS" in
        macos)
            echo "  macOS (使用 Homebrew):"
            echo "    brew install minio/stable/mc"
            echo ""
            echo "  macOS (手动安装):"
            echo "    curl -O https://dl.min.io/client/mc/release/darwin-amd64/mc"
            echo "    chmod +x mc"
            echo "    sudo mv mc /usr/local/bin/"
            ;;
        linux)
            echo "  Linux:"
            echo "    wget https://dl.min.io/client/mc/release/linux-amd64/mc"
            echo "    chmod +x mc"
            echo "    sudo mv mc /usr/local/bin/"
            ;;
        windows)
            echo "  Windows:"
            echo "    下载: https://dl.min.io/client/mc/release/windows-amd64/mc.exe"
            echo "    将 mc.exe 添加到系统 PATH"
            ;;
        *)
            echo "  请访问: https://min.io/docs/minio/linux/reference/minio-mc.html"
            ;;
    esac
    
    echo ""
    log_info "或者，您可以使用 Docker 运行 MinIO Client："
    echo "  docker run -it --rm minio/mc --help"
    echo ""
}

# 检查 mc 命令是否可用
check_mc() {
    # 首先检查项目本地 bin 目录
    if [ -f "$PROJECT_ROOT/bin/mc" ]; then
        MC_CMD="$PROJECT_ROOT/bin/mc"
        log_success "检测到项目本地 MinIO Client (bin/mc)"
        return 0
    fi
    
    # 检查系统全局 mc 命令
    if command -v mc &> /dev/null; then
        MC_CMD="mc"
        log_success "检测到系统 MinIO Client"
        return 0
    fi
    
    # 检查 Docker 是否可用
    if command -v docker &> /dev/null; then
        # 检查 Docker 守护进程是否运行
        if docker info &> /dev/null; then
            # 检查是否有 ehs-mc 容器
            if docker ps -a --format '{{.Names}}' | grep -q '^ehs-mc$'; then
                # 检查容器是否运行
                if docker ps --format '{{.Names}}' | grep -q '^ehs-mc$'; then
                    MC_CMD="docker exec ehs-mc mc"
                    log_success "检测到运行中的 Docker 容器 (ehs-mc)"
                    return 0
                else
                    log_warning "Docker 容器 ehs-mc 存在但未运行"
                    log_info "尝试启动容器..."
                    if docker start ehs-mc &> /dev/null; then
                        MC_CMD="docker exec ehs-mc mc"
                        log_success "Docker 容器已启动"
                        return 0
                    else
                        log_warning "无法启动 Docker 容器"
                    fi
                fi
            else
                log_warning "未找到 ehs-mc Docker 容器"
            fi
        else
            log_warning "Docker 已安装但守护进程未运行"
            log_info "请启动 Docker Desktop 或 Docker 服务"
        fi
    fi
    
    # 都没找到，检测操作系统并尝试自动安装
    detect_os
    log_warning "未检测到 MinIO Client (mc) 或 Docker"
    
    # 尝试自动安装（仅 macOS + Homebrew）
    if auto_install_mc; then
        MC_CMD="mc"
        return 0
    fi
    
    # 安装失败，显示安装指南
    show_install_guide
    return 1
}

# 配置 MinIO 别名
setup_mc_alias() {
    log "配置 MinIO 别名: $MINIO_ALIAS"
    
    if [[ "$MC_CMD" == "docker exec"* ]]; then
        # Docker 容器中的 mc
        # 环境变量已在 docker-compose.yml 中配置
        log "使用 Docker 容器环境变量配置"
    else
        # 本地 mc 命令（包括系统 mc 和项目 bin/mc）
        $MC_CMD alias set "$MINIO_ALIAS" \
            "http://$MINIO_ENDPOINT:$MINIO_PORT" \
            "$MINIO_ACCESS_KEY" \
            "$MINIO_SECRET_KEY" || {
            log_error "配置 MinIO 别名失败"
            return 1
        }
    fi
    
    log_success "MinIO 别名配置完成"
}

# 测试 MinIO 连接
test_connection() {
    log "测试 MinIO 连接..."
    
    if [ "$MC_CMD" = "mc" ] || [[ "$MC_CMD" == "$PROJECT_ROOT/bin/mc" ]]; then
        # 使用 ls 命令测试连接（不需要管理员权限）
        if $MC_CMD ls "$MINIO_ALIAS" > /dev/null 2>&1; then
            log_success "MinIO 连接测试成功"
            return 0
        else
            log_error "无法连接到 MinIO 服务器"
            log_info "请确保 MinIO 服务正在运行："
            log_info "  地址: http://$MINIO_ENDPOINT:$MINIO_PORT"
            log_info "  访问密钥: ${MINIO_ACCESS_KEY:0:4}***"
            log_info "尝试手动测试："
            log_info "  $MC_CMD ls $MINIO_ALIAS"
            return 1
        fi
    else
        # Docker 容器中，使用环境变量
        if docker exec ehs-mc mc ls minio > /dev/null 2>&1; then
            MINIO_ALIAS="minio"  # Docker 容器中使用环境变量定义的别名
            log_success "MinIO 连接测试成功"
            return 0
        else
            log_error "无法连接到 MinIO 服务器"
            return 1
        fi
    fi
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
        
        if [[ "$MC_CMD" == "docker exec"* ]]; then
            # 使用 Docker 容器
            docker exec ehs-mc mc mirror \
                --overwrite \
                --remove \
                "minio/$bucket" \
                "/backup/$bucket" \
                2>&1 | tee -a "$LOG_FILE"
        else
            # 使用本地 mc（系统或项目 bin/mc）
            $MC_CMD mirror \
                --overwrite \
                --remove \
                "$MINIO_ALIAS/$bucket" \
                "$BUCKET_BACKUP_DIR" \
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
        
        if [[ "$MC_CMD" == "docker exec"* ]]; then
            # 使用 Docker 容器
            docker exec ehs-mc mc mirror \
                --overwrite \
                "minio/$bucket" \
                "/backup/$bucket" \
                2>&1 | tee -a "$LOG_FILE"
        else
            # 使用本地 mc（系统或项目 bin/mc）
            # 增量同步：只同步变化的文件
            # --watch 模式会持续监控，这里不使用，只做一次性同步
            $MC_CMD mirror \
                --overwrite \
                "$MINIO_ALIAS/$bucket" \
                "$BUCKET_BACKUP_DIR" \
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
            # macOS 和 Linux 的 du 命令略有不同
            if [ "$OS" = "macos" ]; then
                BUCKET_SIZE=$(du -sk "$BUCKET_BACKUP_DIR" 2>/dev/null | cut -f1 || echo "0")
                BUCKET_SIZE=$((BUCKET_SIZE * 1024))  # 转换为字节
            else
                BUCKET_SIZE=$(du -sb "$BUCKET_BACKUP_DIR" 2>/dev/null | cut -f1 || echo "0")
            fi
            
            BUCKET_FILES=$(find "$BUCKET_BACKUP_DIR" -type f 2>/dev/null | wc -l | tr -d ' ' || echo "0")
            TOTAL_SIZE=$((TOTAL_SIZE + BUCKET_SIZE))
            TOTAL_FILES=$((TOTAL_FILES + BUCKET_FILES))
            
            # 使用 awk 计算 MB（兼容性更好）
            SIZE_MB=$(echo "$BUCKET_SIZE" | awk '{printf "%.2f", $1/1024/1024}')
            log "  $bucket: $BUCKET_FILES 个文件, ${SIZE_MB} MB"
        fi
    done
    
    TOTAL_SIZE_MB=$(echo "$TOTAL_SIZE" | awk '{printf "%.2f", $1/1024/1024}')
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
    
    # 检测操作系统
    detect_os
    log "操作系统: $OS"
    
    # 检查 mc 命令
    if ! check_mc; then
        exit 1
    fi
    
    # 显示配置信息（用于调试）
    log "MinIO 配置:"
    log "  端点: $MINIO_ENDPOINT:$MINIO_PORT"
    log "  访问密钥: ${MINIO_ACCESS_KEY:0:4}***"
    log ""
    
    # 配置别名并测试连接
    setup_mc_alias
    
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
