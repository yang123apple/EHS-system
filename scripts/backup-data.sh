#!/bin/bash
# ============================================
# EHS 系统数据备份脚本
# ============================================
# 功能：
# - 备份数据库文件
# - 备份 MinIO 数据
# - 备份上传文件
# - 自动清理旧备份
# - 验证备份完整性
# ============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
BACKUP_ROOT="${BACKUP_ROOT:-$HOME/ehs-backups}"
DATA_ROOT="${DATA_ROOT:-$(dirname $(pwd))/data}"
KEEP_DAYS="${KEEP_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}EHS 系统数据备份${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# ============================================
# 1. 检查环境
# ============================================
echo -e "${YELLOW}📋 检查备份环境...${NC}"

# 创建备份目录
mkdir -p "${BACKUP_ROOT}"/{full,database,minio,uploads,logs}

echo -e "${GREEN}✓${NC} 备份目录: ${BACKUP_ROOT}"
echo -e "${GREEN}✓${NC} 数据目录: ${DATA_ROOT}"
echo -e "${GREEN}✓${NC} 保留天数: ${KEEP_DAYS} 天"
echo ""

# 检查数据目录是否存在
if [ ! -d "${DATA_ROOT}" ]; then
    echo -e "${RED}❌ 错误: 数据目录不存在: ${DATA_ROOT}${NC}"
    echo -e "   请设置正确的 DATA_ROOT 环境变量"
    exit 1
fi

# ============================================
# 2. 备份数据库
# ============================================
echo -e "${YELLOW}💾 备份数据库...${NC}"

if [ -f "${DATA_ROOT}/db/ehs.db" ]; then
    DB_BACKUP="${BACKUP_ROOT}/database/ehs-${TIMESTAMP}.db"

    # 复制数据库文件
    cp "${DATA_ROOT}/db/ehs.db" "${DB_BACKUP}"

    # 同时备份 WAL 和 SHM 文件（如果存在）
    if [ -f "${DATA_ROOT}/db/ehs.db-wal" ]; then
        cp "${DATA_ROOT}/db/ehs.db-wal" "${DB_BACKUP}-wal"
    fi
    if [ -f "${DATA_ROOT}/db/ehs.db-shm" ]; then
        cp "${DATA_ROOT}/db/ehs.db-shm" "${DB_BACKUP}-shm"
    fi

    DB_SIZE=$(du -h "${DB_BACKUP}" | cut -f1)
    echo -e "${GREEN}✓${NC} 数据库备份完成: ${DB_SIZE}"
    echo -e "   文件: ${DB_BACKUP}"

    # 验证数据库完整性（如果 sqlite3 可用）
    if command -v sqlite3 &> /dev/null; then
        if sqlite3 "${DB_BACKUP}" "PRAGMA integrity_check;" | grep -q "ok"; then
            echo -e "${GREEN}✓${NC} 数据库完整性验证通过"
        else
            echo -e "${RED}❌ 警告: 数据库完整性验证失败${NC}"
        fi
    fi
else
    echo -e "${YELLOW}⚠️  警告: 数据库文件不存在${NC}"
fi

echo ""

# ============================================
# 3. 备份 MinIO 数据
# ============================================
echo -e "${YELLOW}📦 备份 MinIO 数据...${NC}"

if [ -d "${DATA_ROOT}/minio-data" ]; then
    MINIO_BACKUP="${BACKUP_ROOT}/minio/minio-${TIMESTAMP}.tar.gz"

    # 压缩 MinIO 数据
    tar -czf "${MINIO_BACKUP}" -C "${DATA_ROOT}" minio-data 2>/dev/null || {
        echo -e "${RED}❌ MinIO 数据备份失败${NC}"
    }

    if [ -f "${MINIO_BACKUP}" ]; then
        MINIO_SIZE=$(du -h "${MINIO_BACKUP}" | cut -f1)
        echo -e "${GREEN}✓${NC} MinIO 数据备份完成: ${MINIO_SIZE}"
        echo -e "   文件: ${MINIO_BACKUP}"
    fi
else
    echo -e "${YELLOW}⚠️  警告: MinIO 数据目录不存在${NC}"
fi

echo ""

# ============================================
# 4. 备份上传文件
# ============================================
echo -e "${YELLOW}📁 备份上传文件...${NC}"

UPLOADS_DIRS=()

# 检查可能的上传文件位置
if [ -d "${DATA_ROOT}/uploads" ]; then
    UPLOADS_DIRS+=("${DATA_ROOT}/uploads")
fi

if [ -d "$(pwd)/public/uploads" ]; then
    UPLOADS_DIRS+=("$(pwd)/public/uploads")
fi

if [ ${#UPLOADS_DIRS[@]} -gt 0 ]; then
    UPLOADS_BACKUP="${BACKUP_ROOT}/uploads/uploads-${TIMESTAMP}.tar.gz"

    # 压缩上传文件
    tar -czf "${UPLOADS_BACKUP}" "${UPLOADS_DIRS[@]}" 2>/dev/null || {
        echo -e "${RED}❌ 上传文件备份失败${NC}"
    }

    if [ -f "${UPLOADS_BACKUP}" ]; then
        UPLOADS_SIZE=$(du -h "${UPLOADS_BACKUP}" | cut -f1)
        echo -e "${GREEN}✓${NC} 上传文件备份完成: ${UPLOADS_SIZE}"
        echo -e "   文件: ${UPLOADS_BACKUP}"
    fi
else
    echo -e "${YELLOW}⚠️  警告: 上传文件目录不存在${NC}"
fi

echo ""

# ============================================
# 5. 创建完整备份
# ============================================
echo -e "${YELLOW}📦 创建完整备份...${NC}"

FULL_BACKUP="${BACKUP_ROOT}/full/ehs-full-${TIMESTAMP}.tar.gz"

# 压缩整个数据目录
tar -czf "${FULL_BACKUP}" -C "$(dirname ${DATA_ROOT})" "$(basename ${DATA_ROOT})" 2>/dev/null || {
    echo -e "${RED}❌ 完整备份失败${NC}"
}

if [ -f "${FULL_BACKUP}" ]; then
    FULL_SIZE=$(du -h "${FULL_BACKUP}" | cut -f1)
    echo -e "${GREEN}✓${NC} 完整备份完成: ${FULL_SIZE}"
    echo -e "   文件: ${FULL_BACKUP}"
fi

echo ""

# ============================================
# 6. 生成备份清单
# ============================================
echo -e "${YELLOW}📝 生成备份清单...${NC}"

MANIFEST="${BACKUP_ROOT}/logs/backup-${TIMESTAMP}.log"

cat > "${MANIFEST}" <<EOF
========================================
EHS 系统备份清单
========================================
备份时间: $(date '+%Y-%m-%d %H:%M:%S')
备份目录: ${BACKUP_ROOT}
数据目录: ${DATA_ROOT}

========================================
备份文件
========================================
EOF

if [ -f "${DB_BACKUP}" ]; then
    echo "数据库: ${DB_BACKUP} ($(du -h ${DB_BACKUP} | cut -f1))" >> "${MANIFEST}"
fi

if [ -f "${MINIO_BACKUP}" ]; then
    echo "MinIO: ${MINIO_BACKUP} ($(du -h ${MINIO_BACKUP} | cut -f1))" >> "${MANIFEST}"
fi

if [ -f "${UPLOADS_BACKUP}" ]; then
    echo "上传文件: ${UPLOADS_BACKUP} ($(du -h ${UPLOADS_BACKUP} | cut -f1))" >> "${MANIFEST}"
fi

if [ -f "${FULL_BACKUP}" ]; then
    echo "完整备份: ${FULL_BACKUP} ($(du -h ${FULL_BACKUP} | cut -f1))" >> "${MANIFEST}"
fi

cat >> "${MANIFEST}" <<EOF

========================================
数据统计
========================================
EOF

# 如果 sqlite3 可用，添加数据统计
if command -v sqlite3 &> /dev/null && [ -f "${DATA_ROOT}/db/ehs.db" ]; then
    echo "用户数量: $(sqlite3 ${DATA_ROOT}/db/ehs.db 'SELECT COUNT(*) FROM User;' 2>/dev/null || echo 'N/A')" >> "${MANIFEST}"
    echo "部门数量: $(sqlite3 ${DATA_ROOT}/db/ehs.db 'SELECT COUNT(*) FROM Department;' 2>/dev/null || echo 'N/A')" >> "${MANIFEST}"
    echo "隐患记录: $(sqlite3 ${DATA_ROOT}/db/ehs.db 'SELECT COUNT(*) FROM HazardRecord;' 2>/dev/null || echo 'N/A')" >> "${MANIFEST}"
fi

echo -e "${GREEN}✓${NC} 备份清单已生成: ${MANIFEST}"
echo ""

# ============================================
# 7. 清理旧备份
# ============================================
echo -e "${YELLOW}🗑️  清理旧备份...${NC}"

DELETED_COUNT=0

# 清理旧的数据库备份
if [ -d "${BACKUP_ROOT}/database" ]; then
    DELETED=$(find "${BACKUP_ROOT}/database" -name "ehs-*.db" -mtime +${KEEP_DAYS} -delete -print | wc -l)
    DELETED_COUNT=$((DELETED_COUNT + DELETED))
fi

# 清理旧的 MinIO 备份
if [ -d "${BACKUP_ROOT}/minio" ]; then
    DELETED=$(find "${BACKUP_ROOT}/minio" -name "minio-*.tar.gz" -mtime +${KEEP_DAYS} -delete -print | wc -l)
    DELETED_COUNT=$((DELETED_COUNT + DELETED))
fi

# 清理旧的上传文件备份
if [ -d "${BACKUP_ROOT}/uploads" ]; then
    DELETED=$(find "${BACKUP_ROOT}/uploads" -name "uploads-*.tar.gz" -mtime +${KEEP_DAYS} -delete -print | wc -l)
    DELETED_COUNT=$((DELETED_COUNT + DELETED))
fi

# 清理旧的完整备份
if [ -d "${BACKUP_ROOT}/full" ]; then
    DELETED=$(find "${BACKUP_ROOT}/full" -name "ehs-full-*.tar.gz" -mtime +${KEEP_DAYS} -delete -print | wc -l)
    DELETED_COUNT=$((DELETED_COUNT + DELETED))
fi

# 清理旧的日志
if [ -d "${BACKUP_ROOT}/logs" ]; then
    DELETED=$(find "${BACKUP_ROOT}/logs" -name "backup-*.log" -mtime +${KEEP_DAYS} -delete -print | wc -l)
    DELETED_COUNT=$((DELETED_COUNT + DELETED))
fi

if [ $DELETED_COUNT -gt 0 ]; then
    echo -e "${GREEN}✓${NC} 已清理 ${DELETED_COUNT} 个旧备份文件"
else
    echo -e "${GREEN}✓${NC} 无需清理旧备份"
fi

echo ""

# ============================================
# 8. 显示备份摘要
# ============================================
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ 备份完成！${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

echo -e "${YELLOW}📊 备份摘要:${NC}"
echo ""

# 统计备份文件数量和大小
TOTAL_SIZE=0

if [ -d "${BACKUP_ROOT}/database" ]; then
    DB_COUNT=$(ls -1 "${BACKUP_ROOT}/database"/*.db 2>/dev/null | wc -l)
    DB_TOTAL=$(du -sh "${BACKUP_ROOT}/database" 2>/dev/null | cut -f1 || echo "0B")
    echo -e "  数据库备份: ${DB_COUNT} 个文件, ${DB_TOTAL}"
fi

if [ -d "${BACKUP_ROOT}/minio" ]; then
    MINIO_COUNT=$(ls -1 "${BACKUP_ROOT}/minio"/*.tar.gz 2>/dev/null | wc -l)
    MINIO_TOTAL=$(du -sh "${BACKUP_ROOT}/minio" 2>/dev/null | cut -f1 || echo "0B")
    echo -e "  MinIO 备份: ${MINIO_COUNT} 个文件, ${MINIO_TOTAL}"
fi

if [ -d "${BACKUP_ROOT}/uploads" ]; then
    UPLOADS_COUNT=$(ls -1 "${BACKUP_ROOT}/uploads"/*.tar.gz 2>/dev/null | wc -l)
    UPLOADS_TOTAL=$(du -sh "${BACKUP_ROOT}/uploads" 2>/dev/null | cut -f1 || echo "0B")
    echo -e "  上传文件备份: ${UPLOADS_COUNT} 个文件, ${UPLOADS_TOTAL}"
fi

if [ -d "${BACKUP_ROOT}/full" ]; then
    FULL_COUNT=$(ls -1 "${BACKUP_ROOT}/full"/*.tar.gz 2>/dev/null | wc -l)
    FULL_TOTAL=$(du -sh "${BACKUP_ROOT}/full" 2>/dev/null | cut -f1 || echo "0B")
    echo -e "  完整备份: ${FULL_COUNT} 个文件, ${FULL_TOTAL}"
fi

echo ""
echo -e "${YELLOW}📁 备份位置:${NC}"
echo -e "  ${BACKUP_ROOT}"
echo ""

echo -e "${YELLOW}📝 备份清单:${NC}"
echo -e "  ${MANIFEST}"
echo ""

echo -e "${YELLOW}🔄 恢复命令:${NC}"
echo -e "  完整恢复:"
echo -e "    ${BLUE}tar -xzf ${FULL_BACKUP} -C $(dirname ${DATA_ROOT})${NC}"
echo ""
echo -e "  仅恢复数据库:"
echo -e "    ${BLUE}cp ${DB_BACKUP} ${DATA_ROOT}/db/ehs.db${NC}"
echo ""

echo -e "${GREEN}备份成功！${NC}"
echo ""
