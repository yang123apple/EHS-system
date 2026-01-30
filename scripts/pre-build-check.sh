#!/bin/bash
# ============================================
# EHS 系统 Docker 镜像构建前检查脚本
# ============================================
# 功能：
# - 检查数据库文件是否存在
# - 验证 admin 用户是否已创建
# - 检查核心数据目录
# - 验证必要的文件和目录
# ============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}EHS 系统 Docker 构建前检查${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 检查计数器
ERRORS=0
WARNINGS=0

# ============================================
# 1. 检查数据库文件
# ============================================
echo -e "${YELLOW}📋 检查数据库文件...${NC}"

if [ ! -f "prisma/dev.db" ]; then
    echo -e "${RED}❌ 错误: prisma/dev.db 不存在${NC}"
    echo -e "   请先运行: npx prisma migrate deploy && npx prisma db seed"
    ERRORS=$((ERRORS + 1))
else
    DB_SIZE=$(du -h prisma/dev.db | cut -f1)
    echo -e "${GREEN}✓${NC} 数据库文件存在: ${DB_SIZE}"

    # 检查数据库是否为空
    if [ ! -s "prisma/dev.db" ]; then
        echo -e "${RED}❌ 错误: 数据库文件为空${NC}"
        ERRORS=$((ERRORS + 1))
    fi
fi

echo ""

# ============================================
# 2. 检查 admin 用户
# ============================================
echo -e "${YELLOW}👤 检查 admin 用户...${NC}"

if [ -f "prisma/dev.db" ]; then
    # 检查 sqlite3 是否可用
    if command -v sqlite3 &> /dev/null; then
        ADMIN_COUNT=$(sqlite3 prisma/dev.db "SELECT COUNT(*) FROM User WHERE username='admin';" 2>/dev/null || echo "0")

        if [ "$ADMIN_COUNT" -eq "0" ]; then
            echo -e "${RED}❌ 错误: 数据库中没有 admin 用户${NC}"
            echo -e "   请运行: npx prisma db seed"
            ERRORS=$((ERRORS + 1))
        else
            echo -e "${GREEN}✓${NC} Admin 用户已存在"

            # 显示 admin 用户信息
            ADMIN_INFO=$(sqlite3 prisma/dev.db "SELECT id, username, name, role FROM User WHERE username='admin';" 2>/dev/null || echo "")
            if [ -n "$ADMIN_INFO" ]; then
                echo -e "   信息: ${ADMIN_INFO}"
            fi
        fi
    else
        echo -e "${YELLOW}⚠️  警告: sqlite3 未安装，无法验证 admin 用户${NC}"
        echo -e "   建议安装: brew install sqlite (macOS) 或 apt-get install sqlite3 (Linux)"
        WARNINGS=$((WARNINGS + 1))
    fi
fi

echo ""

# ============================================
# 3. 检查核心数据目录
# ============================================
echo -e "${YELLOW}📦 检查核心数据目录...${NC}"

if [ ! -d "data/core_data" ]; then
    echo -e "${RED}❌ 错误: data/core_data 目录不存在${NC}"
    echo -e "   核心数据目录用于自动恢复功能"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✓${NC} 核心数据目录存在"

    # 检查必要的核心数据文件
    REQUIRED_FILES=("user.json" "department.json")
    for file in "${REQUIRED_FILES[@]}"; do
        if [ -f "data/core_data/$file" ]; then
            FILE_SIZE=$(du -h "data/core_data/$file" | cut -f1)
            echo -e "   ${GREEN}✓${NC} $file (${FILE_SIZE})"
        else
            echo -e "   ${YELLOW}⚠️${NC}  $file 不存在"
            WARNINGS=$((WARNINGS + 1))
        fi
    done
fi

echo ""

# ============================================
# 4. 检查上传文件目录
# ============================================
echo -e "${YELLOW}📁 检查上传文件目录...${NC}"

if [ -d "public/uploads" ]; then
    UPLOADS_SIZE=$(du -sh public/uploads 2>/dev/null | cut -f1 || echo "0B")
    echo -e "${GREEN}✓${NC} 上传文件目录存在: ${UPLOADS_SIZE}"
else
    echo -e "${YELLOW}⚠️  警告: public/uploads 目录不存在${NC}"
    echo -e "   将创建空目录"
    mkdir -p public/uploads
    WARNINGS=$((WARNINGS + 1))
fi

echo ""

# ============================================
# 5. 检查私有/公共存储目录
# ============================================
echo -e "${YELLOW}🗂️  检查存储目录...${NC}"

for dir in "ehs-private" "ehs-public"; do
    if [ -d "$dir" ]; then
        DIR_SIZE=$(du -sh "$dir" 2>/dev/null | cut -f1 || echo "0B")
        echo -e "${GREEN}✓${NC} $dir 目录存在: ${DIR_SIZE}"
    else
        echo -e "${YELLOW}⚠️  警告: $dir 目录不存在${NC}"
        echo -e "   将创建空目录"
        mkdir -p "$dir"
        WARNINGS=$((WARNINGS + 1))
    fi
done

echo ""

# ============================================
# 6. 检查 Dockerfile.full
# ============================================
echo -e "${YELLOW}🐳 检查 Dockerfile.full...${NC}"

if [ ! -f "Dockerfile.full" ]; then
    echo -e "${RED}❌ 错误: Dockerfile.full 不存在${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✓${NC} Dockerfile.full 存在"

    # 检查是否包含 core_data 复制指令
    if grep -q "COPY data/core_data/" Dockerfile.full; then
        echo -e "   ${GREEN}✓${NC} 包含 core_data 复制指令"
    else
        echo -e "   ${YELLOW}⚠️  警告: 未找到 core_data 复制指令${NC}"
        echo -e "   建议在 Dockerfile.full 中添加:"
        echo -e "   ${BLUE}COPY data/core_data/ /app/data/core_data/${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
fi

echo ""

# ============================================
# 7. 检查 .dockerignore
# ============================================
echo -e "${YELLOW}📝 检查 .dockerignore...${NC}"

if [ -f ".dockerignore.full" ]; then
    echo -e "${GREEN}✓${NC} .dockerignore.full 存在"
else
    echo -e "${YELLOW}⚠️  警告: .dockerignore.full 不存在${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

echo ""

# ============================================
# 8. 检查 package.json 和 node_modules
# ============================================
echo -e "${YELLOW}📦 检查依赖...${NC}"

if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ 错误: package.json 不存在${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✓${NC} package.json 存在"
fi

if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  警告: node_modules 不存在${NC}"
    echo -e "   Docker 构建时会自动安装依赖"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}✓${NC} node_modules 存在"
fi

echo ""

# ============================================
# 9. 检查磁盘空间
# ============================================
echo -e "${YELLOW}💾 检查磁盘空间...${NC}"

AVAILABLE_SPACE=$(df -h . | awk 'NR==2 {print $4}')
echo -e "   可用空间: ${AVAILABLE_SPACE}"

# 检查是否有足够空间（至少 5GB）
AVAILABLE_KB=$(df -k . | awk 'NR==2 {print $4}')
if [ "$AVAILABLE_KB" -lt 5242880 ]; then
    echo -e "${YELLOW}⚠️  警告: 可用磁盘空间不足 5GB${NC}"
    echo -e "   建议至少保留 5GB 空间用于构建"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}✓${NC} 磁盘空间充足"
fi

echo ""

# ============================================
# 10. 检查 Docker 环境
# ============================================
echo -e "${YELLOW}🐋 检查 Docker 环境...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ 错误: Docker 未安装${NC}"
    ERRORS=$((ERRORS + 1))
else
    DOCKER_VERSION=$(docker --version | cut -d ' ' -f3 | cut -d ',' -f1)
    echo -e "${GREEN}✓${NC} Docker 已安装: ${DOCKER_VERSION}"

    # 检查 Docker 是否运行
    if ! docker info &> /dev/null; then
        echo -e "${RED}❌ 错误: Docker 未运行${NC}"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${GREEN}✓${NC} Docker 正在运行"
    fi
fi

echo ""

# ============================================
# 总结
# ============================================
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}检查结果总结${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ 所有检查通过！${NC}"
    echo -e "${GREEN}可以开始构建 Docker 镜像${NC}"
    echo ""
    echo -e "${BLUE}构建命令:${NC}"
    echo -e "  ${BLUE}./build-full-image.sh${NC}"
    echo -e "  或"
    echo -e "  ${BLUE}docker build -f Dockerfile.full -t ehs-system-full:v1.0 .${NC}"
    echo ""
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  检查完成，有 ${WARNINGS} 个警告${NC}"
    echo -e "${YELLOW}建议修复警告后再构建，但可以继续${NC}"
    echo ""
    exit 0
else
    echo -e "${RED}❌ 检查失败，有 ${ERRORS} 个错误和 ${WARNINGS} 个警告${NC}"
    echo -e "${RED}请修复错误后再构建镜像${NC}"
    echo ""

    # 显示修复建议
    echo -e "${BLUE}修复建议:${NC}"
    echo ""

    if [ ! -f "prisma/dev.db" ] || [ ! -s "prisma/dev.db" ]; then
        echo -e "1. 初始化数据库:"
        echo -e "   ${BLUE}npx prisma migrate deploy${NC}"
        echo -e "   ${BLUE}npx prisma db seed${NC}"
        echo ""
    fi

    if [ ! -d "data/core_data" ]; then
        echo -e "2. 确保核心数据目录存在:"
        echo -e "   ${BLUE}ls -la data/core_data/${NC}"
        echo ""
    fi

    if ! command -v docker &> /dev/null; then
        echo -e "3. 安装 Docker:"
        echo -e "   macOS: ${BLUE}brew install --cask docker${NC}"
        echo -e "   Linux: ${BLUE}curl -fsSL https://get.docker.com | sh${NC}"
        echo ""
    fi

    exit 1
fi
