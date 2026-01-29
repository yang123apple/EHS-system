# EHS 系统 Docker 部署方案 - 完整总结

## 🎯 方案概述

本方案提供了一个**生产就绪**的 Docker 部署解决方案，修复了原 GPT 方案的所有致命缺陷，并提供了完整的文档和工具支持。

---

## 📦 方案组成

### 核心文件

| 文件 | 用途 | 状态 |
|------|------|------|
| [Dockerfile](Dockerfile) | 多阶段构建配置 | ✅ 已优化 |
| [docker-compose.prod.yml](docker-compose.prod.yml) | 服务编排配置 | ✅ 已修复 |
| [.dockerignore](.dockerignore) | 构建上下文过滤 | ✅ 已优化 |
| [.env.docker.example](.env.docker.example) | 环境变量模板 | ✅ 新增 |
| [scripts/docker_oneclick.py](scripts/docker_oneclick.py) | 一键部署脚本 | ✅ 已提供 |

### 文档文件

| 文件 | 内容 | 适用场景 |
|------|------|----------|
| [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) | 完整部署指南 | 首次部署、详细参考 |
| [DOCKER_QUICKSTART.md](DOCKER_QUICKSTART.md) | 快速参考卡片 | 日常运维、快速查询 |
| [DOCKER_CHANGES.md](DOCKER_CHANGES.md) | 修复说明文档 | 了解修复内容 |
| 本文件 | 部署方案总结 | 整体了解方案 |

### 新增功能

| 功能 | 文件 | 说明 |
|------|------|------|
| 健康检查 API | [src/app/api/health/route.ts](src/app/api/health/route.ts) | 支持 Docker healthcheck |
| 系统检查脚本 | [scripts/system-check.sh](scripts/system-check.sh) | 开发环境健康检查 |

---

## 🔧 关键修复

### 1. 数据持久化问题（致命）

**问题**: Prisma schema 硬编码数据库路径，导致数据不在挂载卷上

**修复**:
```prisma
# prisma/schema.prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")  # ✅ 从环境变量读取
}
```

**影响**: 确保容器重启后数据不丢失

---

### 2. MinIO 端点配置问题（致命）

**问题**: 默认使用容器名称 `minio`，浏览器无法访问预签名 URL

**修复**:
1. `.env.docker` 改为详细模板，强制用户配置
2. 提供三种部署场景示例
3. 移除 compose 中的不安全默认值

**影响**: 文件上传/下载功能正常工作

---

### 3. 健康检查问题

**问题**:
- MinIO 使用不存在的 `curl` 命令
- App 服务没有健康检查

**修复**:
- MinIO: 改用 `mc ready local`
- App: 添加 healthcheck + 创建 `/api/health` 端点

**影响**: 容器状态监控准确，自动重启机制可靠

---

## 🚀 部署流程

### 方式 1: 一键部署（推荐）

```bash
# 1. 配置环境变量
cp .env.docker.example .env.docker.local
vim .env.docker.local  # 修改 MINIO_ENDPOINT 为实际 IP

# 2. 一键启动
python3 scripts/docker_oneclick.py

# 3. 验证部署
curl http://localhost:3000/api/health
docker ps  # 检查容器状态
```

### 方式 2: 手动部署

```bash
# 1. 创建目录
mkdir -p data/db data/minio-data data/minio-config data/minio-backup
mkdir -p public/uploads ehs-private ehs-public

# 2. 配置环境
cp .env.docker.example .env.docker.local
vim .env.docker.local

# 3. 构建和启动
docker compose --env-file .env.docker.local -f docker-compose.prod.yml build
docker compose --env-file .env.docker.local -f docker-compose.prod.yml up -d

# 4. 查看日志
docker logs -f ehs-app
```

---

## ⚙️ 配置要点

### 必须修改的配置

在 `.env.docker.local` 中：

```bash
# ⚠️ 必须改：MinIO 端点（浏览器可访问的 IP/域名）
MINIO_ENDPOINT=192.168.1.100  # 本机用 localhost，局域网用 IP

# ⚠️ 必须改：MinIO 主端点（与上面一致）
MINIO_PRIMARY_ENDPOINT=http://192.168.1.100:9000

# ⚠️ 建议改：所有密码改为强密码
MINIO_SECRET_KEY=your-strong-password
MINIO_ROOT_PASSWORD=your-strong-password
MINIO_PRIMARY_SECRET_KEY=your-strong-password
```

### 三种部署场景

**场景 1: 本机部署**
```bash
MINIO_ENDPOINT=localhost
MINIO_PRIMARY_ENDPOINT=http://localhost:9000
```

**场景 2: 局域网部署**
```bash
MINIO_ENDPOINT=192.168.1.100
MINIO_PRIMARY_ENDPOINT=http://192.168.1.100:9000
```

**场景 3: 公网部署**
```bash
MINIO_ENDPOINT=minio.yourdomain.com
MINIO_PRIMARY_ENDPOINT=https://minio.yourdomain.com
MINIO_USE_SSL=true
```

---

## ✅ 验证清单

部署后请逐项验证：

```bash
# 1. 检查容器状态
docker ps
# 应看到 ehs-app 和 ehs-minio 都是 healthy

# 2. 测试健康检查
curl http://localhost:3000/api/health
# 应返回 {"status":"healthy",...}

# 3. 检查数据库文件
ls -la ./data/db/ehs.db
# 应存在且有内容

# 4. 访问应用
# 浏览器打开 http://YOUR_IP:3000

# 5. 访问 MinIO 控制台
# 浏览器打开 http://YOUR_IP:9001
# 用户名: admin（或你配置的）
# 密码: 你在 .env.docker.local 中设置的

# 6. 测试文件上传
# 在应用中上传一个文件

# 7. 测试文件下载
# 点击上传的文件，确认可以下载/预览
```

---

## 🔍 常见问题速查

### 问题 1: 文件上传后无法访问

**症状**: 点击文件链接显示 "无法访问" 或 "ERR_NAME_NOT_RESOLVED"

**原因**: `MINIO_ENDPOINT` 配置错误

**解决**:
```bash
# 1. 停止服务
docker compose --env-file .env.docker.local -f docker-compose.prod.yml down

# 2. 修改 .env.docker.local
vim .env.docker.local
# 确保 MINIO_ENDPOINT 是浏览器可访问的 IP/域名

# 3. 重启
python3 scripts/docker_oneclick.py
```

---

### 问题 2: 容器启动失败

**症状**: `docker ps` 看不到 ehs-app 容器

**排查**:
```bash
# 查看日志
docker logs ehs-app

# 检查端口占用
sudo lsof -i :3000
sudo lsof -i :9000

# 如果端口被占用，修改 .env.docker.local
APP_PORT=3001
MINIO_PORT=9002
```

---

### 问题 3: 数据库迁移失败

**症状**: 日志显示 "prisma migrate deploy" 失败

**排查**:
```bash
# 检查数据库路径
docker exec ehs-app env | grep DATABASE_URL

# 检查目录权限
ls -la ./data/db/

# 手动执行迁移
docker exec ehs-app npx prisma migrate deploy
```

---

### 问题 4: MinIO 健康检查失败

**症状**: `docker ps` 显示 ehs-minio 为 unhealthy

**排查**:
```bash
# 查看 MinIO 日志
docker logs ehs-minio

# 手动测试健康检查
docker exec ehs-minio mc ready local

# 如果 mc 命令不存在，检查镜像版本
docker inspect ehs-minio | grep Image
```

---

## 🛠️ 日常运维

### 查看日志

```bash
# 实时查看应用日志
docker logs -f ehs-app

# 查看最近 100 行
docker logs --tail 100 ehs-app

# 查看 MinIO 日志
docker logs -f ehs-minio
```

### 重启服务

```bash
# 重启所有服务
docker compose --env-file .env.docker.local -f docker-compose.prod.yml restart

# 重启单个服务
docker restart ehs-app
```

### 停止服务

```bash
# 停止（保留数据）
docker compose --env-file .env.docker.local -f docker-compose.prod.yml down

# 停止并删除所有数据（危险！）
docker compose --env-file .env.docker.local -f docker-compose.prod.yml down -v
```

### 更新应用

```bash
# 1. 拉取最新代码
git pull

# 2. 重新构建
docker compose --env-file .env.docker.local -f docker-compose.prod.yml build --no-cache

# 3. 重启服务
docker compose --env-file .env.docker.local -f docker-compose.prod.yml up -d

# 4. 查看日志
docker logs -f ehs-app
```

### 备份数据

```bash
# 备份数据库
cp ./data/db/ehs.db ./backups/ehs-$(date +%Y%m%d-%H%M%S).db

# 备份 MinIO 数据
tar -czf minio-backup-$(date +%Y%m%d-%H%M%S).tar.gz ./data/minio-data

# 备份上传文件
tar -czf uploads-backup-$(date +%Y%m%d-%H%M%S).tar.gz ./public/uploads
```

---

## 📊 架构说明

### 容器架构

```
┌─────────────────────────────────────────┐
│           Docker Host                    │
│                                          │
│  ┌────────────────┐  ┌────────────────┐ │
│  │   ehs-app      │  │   ehs-minio    │ │
│  │  (Next.js)     │  │   (MinIO)      │ │
│  │                │  │                │ │
│  │  Port: 3000    │  │  Port: 9000    │ │
│  │  Health: ✓     │  │  Port: 9001    │ │
│  │                │  │  Health: ✓     │ │
│  └────────┬───────┘  └────────┬───────┘ │
│           │                   │          │
│           └───────┬───────────┘          │
│                   │                      │
│           ┌───────▼───────┐              │
│           │  ehs-network  │              │
│           │   (bridge)    │              │
│           └───────────────┘              │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │  Volume Mounts                     │ │
│  │  • ./data → /app/data              │ │
│  │  • ./public/uploads → /app/public  │ │
│  │  • ./ehs-private → /app/ehs-private│ │
│  │  • ./ehs-public → /app/ehs-public  │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### 数据流

```
用户浏览器
    │
    ├─→ HTTP :3000 ──→ ehs-app (Next.js)
    │                      │
    │                      ├─→ SQLite (/app/data/db/ehs.db)
    │                      │
    │                      └─→ MinIO (内部: minio:9000)
    │
    └─→ HTTP :9000 ──→ ehs-minio (预签名 URL)
         HTTP :9001 ──→ ehs-minio (控制台)
```

---

## 🔒 安全建议

1. **修改默认密码**: 务必修改所有 `MINIO_*_PASSWORD` 和 `MINIO_*_SECRET_KEY`
2. **使用 HTTPS**: 生产环境建议配置 SSL 证书（使用 Nginx 反向代理）
3. **防火墙配置**: 限制端口访问，只开放必要的端口
4. **定期备份**: 设置自动备份任务（cron job）
5. **更新镜像**: 定期更新 Docker 镜像到最新版本
6. **日志轮转**: 配置 Docker 日志轮转，避免日志文件过大

---

## 📞 获取帮助

### 文档资源

- **详细部署指南**: [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md)
- **快速参考**: [DOCKER_QUICKSTART.md](DOCKER_QUICKSTART.md)
- **修复说明**: [DOCKER_CHANGES.md](DOCKER_CHANGES.md)

### 调试命令

```bash
# 查看容器状态
docker ps

# 查看详细信息
docker inspect ehs-app

# 进入容器调试
docker exec -it ehs-app sh

# 查看环境变量
docker exec ehs-app env | grep MINIO

# 测试数据库连接
docker exec ehs-app npx prisma migrate status

# 测试 MinIO 连接
docker exec ehs-minio mc admin info local
```

---

## 📝 版本信息

- **方案版本**: 2.0.0
- **创建日期**: 2026-01-28
- **适用系统**: EHS 系统
- **Docker 版本要求**: 20.10+
- **Docker Compose 版本要求**: 2.0+

---

## ✨ 方案特点

- ✅ **生产就绪**: 修复所有致命缺陷，可直接用于生产环境
- ✅ **完整文档**: 提供详细部署指南和快速参考卡片
- ✅ **健康检查**: 完整的容器健康监控机制
- ✅ **数据持久化**: 确保数据安全，容器重启不丢失
- ✅ **一键部署**: 提供自动化部署脚本
- ✅ **易于维护**: 清晰的目录结构和配置管理
- ✅ **安全可靠**: 强制用户配置，避免不安全的默认值
- ✅ **问题排查**: 提供常见问题解决方案

---

**祝部署顺利！** 🎉
