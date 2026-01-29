#!/bin/bash
# ============================================
# EHS 系统完整镜像构建脚本
# ============================================
# 功能：
# - 构建包含所有数据的完整 Docker 镜像
# - 集成 MinIO、mc、Restic
# - 使用非冲突端口 (3100, 9100, 9101)
# - 导出镜像到指定目录
# ============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
IMAGE_NAME="ehs-system-full"
IMAGE_TAG="v1.0"
OUTPUT_DIR="/Users/yangguang/Desktop/EHS/mirror"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
OUTPUT_FILE="${OUTPUT_DIR}/ehs-system-full-${TIMESTAMP}.tar.gz"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}EHS 系统完整镜像构建${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 检查必要文件
echo -e "${YELLOW}📋 检查必要文件...${NC}"
if [ ! -f "prisma/dev.db" ]; then
    echo -e "${RED}❌ 错误: prisma/dev.db 不存在${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} 数据库文件存在: $(du -h prisma/dev.db | cut -f1)"

if [ -d "public/uploads" ]; then
    echo -e "${GREEN}✓${NC} 上传文件目录存在: $(du -sh public/uploads | cut -f1)"
fi

if [ -d "ehs-private" ]; then
    echo -e "${GREEN}✓${NC} 私有文件目录存在: $(du -sh ehs-private | cut -f1)"
fi

echo ""

# 创建输出目录
echo -e "${YELLOW}📁 创建输出目录...${NC}"
mkdir -p "${OUTPUT_DIR}"
echo -e "${GREEN}✓${NC} 输出目录: ${OUTPUT_DIR}"
echo ""

# 备份原始 .dockerignore
if [ -f ".dockerignore" ]; then
    echo -e "${YELLOW}📋 备份原始 .dockerignore...${NC}"
    cp .dockerignore .dockerignore.backup
fi

# 使用完整镜像的 .dockerignore
echo -e "${YELLOW}📋 使用完整镜像的 .dockerignore...${NC}"
cp .dockerignore.full .dockerignore

# 构建镜像
echo -e "${YELLOW}🔨 开始构建 Docker 镜像...${NC}"
echo -e "${BLUE}镜像名称: ${IMAGE_NAME}:${IMAGE_TAG}${NC}"
echo ""

docker build \
    -f Dockerfile.full \
    -t "${IMAGE_NAME}:${IMAGE_TAG}" \
    --progress=plain \
    .

BUILD_EXIT_CODE=$?

# 恢复原始 .dockerignore
if [ -f ".dockerignore.backup" ]; then
    echo -e "${YELLOW}📋 恢复原始 .dockerignore...${NC}"
    mv .dockerignore.backup .dockerignore
fi

if [ $BUILD_EXIT_CODE -ne 0 ]; then
    echo -e "${RED}❌ 镜像构建失败${NC}"
    exit 1
fi

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 镜像构建失败${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✓${NC} 镜像构建成功"
echo ""

# 检查镜像大小
IMAGE_SIZE=$(docker images "${IMAGE_NAME}:${IMAGE_TAG}" --format "{{.Size}}")
echo -e "${BLUE}镜像大小: ${IMAGE_SIZE}${NC}"
echo ""

# 导出镜像
echo -e "${YELLOW}📦 导出镜像到文件...${NC}"
echo -e "${BLUE}输出文件: ${OUTPUT_FILE}${NC}"
echo ""

docker save "${IMAGE_NAME}:${IMAGE_TAG}" | gzip > "${OUTPUT_FILE}"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 镜像导出失败${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✓${NC} 镜像导出成功"
echo ""

# 显示文件信息
FILE_SIZE=$(du -h "${OUTPUT_FILE}" | cut -f1)
echo -e "${BLUE}导出文件大小: ${FILE_SIZE}${NC}"
echo ""

# 创建使用说明
USAGE_FILE="${OUTPUT_DIR}/README-${TIMESTAMP}.md"
cat > "${USAGE_FILE}" <<EOF
# EHS 系统完整镜像使用说明

## 镜像信息

- **镜像名称**: ${IMAGE_NAME}:${IMAGE_TAG}
- **构建时间**: ${TIMESTAMP}
- **镜像文件**: $(basename ${OUTPUT_FILE})
- **文件大小**: ${FILE_SIZE}

## 包含内容

- ✅ Next.js 应用 (端口: 3100)
- ✅ MinIO 服务器 (API: 9100, 控制台: 9101)
- ✅ MinIO Client (mc)
- ✅ Restic 备份工具
- ✅ 项目数据库 (${FILE_SIZE})
- ✅ 上传文件和数据

## 端口配置

| 服务 | 端口 | 说明 |
|------|------|------|
| Next.js 应用 | 3100 | 主应用端口 |
| MinIO API | 9100 | MinIO S3 API |
| MinIO 控制台 | 9101 | MinIO Web 管理界面 |

**注意**: 这些端口不会与本地开发环境冲突 (3000, 9000, 9001)

## 使用方法

### 1. 导入镜像

\`\`\`bash
# 解压并导入镜像
docker load < ${OUTPUT_FILE}

# 或者使用 gunzip
gunzip -c ${OUTPUT_FILE} | docker load
\`\`\`

### 2. 运行容器

\`\`\`bash
# 基本运行
docker run -d \\
  --name ehs-system-full \\
  -p 3100:3100 \\
  -p 9100:9100 \\
  -p 9101:9101 \\
  -v \$(pwd)/data:/app/data \\
  ${IMAGE_NAME}:${IMAGE_TAG}
\`\`\`

### 3. 访问服务

- **应用**: http://localhost:3100
- **MinIO 控制台**: http://localhost:9101
- **MinIO API**: http://localhost:9100

### 4. 查看日志

\`\`\`bash
# 查看所有日志
docker logs -f ehs-system-full

# 查看 Next.js 日志
docker exec ehs-system-full tail -f /var/log/supervisor/nextjs.log

# 查看 MinIO 日志
docker exec ehs-system-full tail -f /var/log/supervisor/minio.log
\`\`\`

### 5. 进入容器

\`\`\`bash
docker exec -it ehs-system-full bash
\`\`\`

### 6. 停止和删除

\`\`\`bash
# 停止容器
docker stop ehs-system-full

# 删除容器
docker rm ehs-system-full

# 删除镜像
docker rmi ${IMAGE_NAME}:${IMAGE_TAG}
\`\`\`

## 数据持久化

容器内的数据目录：
- \`/app/data/db/ehs.db\` - 数据库
- \`/app/data/minio-data\` - MinIO 数据
- \`/app/public/uploads\` - 上传文件

建议挂载 \`/app/data\` 目录以持久化数据：

\`\`\`bash
docker run -d \\
  --name ehs-system-full \\
  -p 3100:3100 \\
  -p 9100:9100 \\
  -p 9101:9101 \\
  -v /path/to/host/data:/app/data \\
  ${IMAGE_NAME}:${IMAGE_TAG}
\`\`\`

## 环境变量

可以通过环境变量自定义配置：

\`\`\`bash
docker run -d \\
  --name ehs-system-full \\
  -p 3100:3100 \\
  -p 9100:9100 \\
  -p 9101:9101 \\
  -e MINIO_ROOT_USER=myadmin \\
  -e MINIO_ROOT_PASSWORD=mypassword \\
  -e DATABASE_URL=file:/app/data/db/ehs.db \\
  ${IMAGE_NAME}:${IMAGE_TAG}
\`\`\`

## 健康检查

容器包含健康检查，可以通过以下命令查看：

\`\`\`bash
docker inspect ehs-system-full | grep -A 10 Health
\`\`\`

或访问健康检查端点：

\`\`\`bash
curl http://localhost:3100/api/health
\`\`\`

## 故障排查

### 容器无法启动

\`\`\`bash
# 查看容器日志
docker logs ehs-system-full

# 检查端口占用
lsof -i :3100
lsof -i :9100
lsof -i :9101
\`\`\`

### 数据库连接失败

\`\`\`bash
# 进入容器检查数据库文件
docker exec -it ehs-system-full ls -la /app/data/db/

# 检查数据库权限
docker exec -it ehs-system-full chmod 644 /app/data/db/ehs.db
\`\`\`

### MinIO 无法访问

\`\`\`bash
# 检查 MinIO 进程
docker exec -it ehs-system-full ps aux | grep minio

# 重启 MinIO
docker exec -it ehs-system-full supervisorctl restart minio
\`\`\`

## 备份和恢复

### 备份数据

\`\`\`bash
# 备份整个 data 目录
docker cp ehs-system-full:/app/data ./backup-data-\$(date +%Y%m%d)

# 仅备份数据库
docker cp ehs-system-full:/app/data/db/ehs.db ./backup-db-\$(date +%Y%m%d).db
\`\`\`

### 恢复数据

\`\`\`bash
# 恢复数据目录
docker cp ./backup-data-20260129 ehs-system-full:/app/data

# 重启容器
docker restart ehs-system-full
\`\`\`

## 技术支持

如有问题，请查看：
- 容器日志: \`docker logs ehs-system-full\`
- 应用日志: \`/var/log/supervisor/nextjs.log\`
- MinIO 日志: \`/var/log/supervisor/minio.log\`

---

**构建时间**: ${TIMESTAMP}
**镜像版本**: ${IMAGE_TAG}
EOF

echo -e "${GREEN}✓${NC} 使用说明已创建: ${USAGE_FILE}"
echo ""

# 显示摘要
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✅ 镜像构建完成！${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}📦 镜像信息:${NC}"
echo -e "  名称: ${IMAGE_NAME}:${IMAGE_TAG}"
echo -e "  大小: ${IMAGE_SIZE}"
echo ""
echo -e "${YELLOW}📁 输出文件:${NC}"
echo -e "  镜像: ${OUTPUT_FILE}"
echo -e "  大小: ${FILE_SIZE}"
echo -e "  说明: ${USAGE_FILE}"
echo ""
echo -e "${YELLOW}🚀 快速启动:${NC}"
echo -e "  ${BLUE}docker load < ${OUTPUT_FILE}${NC}"
echo -e "  ${BLUE}docker run -d -p 3100:3100 -p 9100:9100 -p 9101:9101 ${IMAGE_NAME}:${IMAGE_TAG}${NC}"
echo ""
echo -e "${YELLOW}🌐 访问地址:${NC}"
echo -e "  应用: ${BLUE}http://localhost:3100${NC}"
echo -e "  MinIO: ${BLUE}http://localhost:9101${NC}"
echo ""
echo -e "${GREEN}构建成功！${NC}"
echo ""
