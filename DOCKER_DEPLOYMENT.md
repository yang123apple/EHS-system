# EHS 系统 Docker 生产部署指南

## 📋 目录

- [快速开始](#快速开始)
- [部署前准备](#部署前准备)
- [配置说明](#配置说明)
- [部署步骤](#部署步骤)
- [验证部署](#验证部署)
- [常见问题](#常见问题)
- [维护操作](#维护操作)

---

## 🚀 快速开始

如果你已经熟悉 Docker 并且只想快速部署，执行以下命令：

```bash
# 1. 配置环境变量（必须先修改 MINIO_ENDPOINT）
cp .env.docker .env.docker.local
vim .env.docker.local  # 修改 MINIO_ENDPOINT 为实际 IP/域名

# 2. 一键启动
python3 scripts/docker_oneclick.py

# 3. 访问应用
# 应用地址: http://YOUR_IP:3000
# MinIO 控制台: http://YOUR_IP:9001
```

---

## 📦 部署前准备

### 1. 系统要求

- **操作系统**: Linux / macOS / Windows (with WSL2)
- **Docker**: 20.10+ 或 Docker Desktop
- **Docker Compose**: 2.0+ (或 docker-compose 1.29+)
- **磁盘空间**: 至少 10GB 可用空间
- **内存**: 建议 4GB+

### 2. 安装 Docker

**Ubuntu/Debian:**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

**macOS:**
```bash
brew install --cask docker
```

**验证安装:**
```bash
docker --version
docker compose version
```

### 3. 获取服务器 IP 地址

**Linux/macOS:**
```bash
# 查看局域网 IP
ip addr show | grep "inet " | grep -v 127.0.0.1

# 或者
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**示例输出:**
```
inet 192.168.1.100/24 brd 192.168.1.255 scope global eth0
```

记下这个 IP 地址（如 `192.168.1.100`），后续配置需要用到。

---

## ⚙️ 配置说明

### 1. 创建环境配置文件

```bash
# 复制模板文件
cp .env.docker .env.docker.local
```

### 2. 编辑配置文件

打开 `.env.docker.local` 并修改以下关键配置：

#### 🔴 必须修改的配置

```bash
# MinIO 端点 - 替换为实际的服务器 IP 或域名
MINIO_ENDPOINT=192.168.1.100  # ⚠️ 必须修改

# MinIO 主端点 - 与上面保持一致
MINIO_PRIMARY_ENDPOINT=http://192.168.1.100:9000  # ⚠️ 必须修改

# MinIO 密码 - 强烈建议修改为强密码
MINIO_SECRET_KEY=your-strong-password-here  # ⚠️ 建议修改
MINIO_ROOT_PASSWORD=your-strong-password-here  # ⚠️ 建议修改
MINIO_PRIMARY_SECRET_KEY=your-strong-password-here  # ⚠️ 建议修改
```

#### 📝 配置场景示例

**场景 1: 本机部署（仅本机访问）**
```bash
MINIO_ENDPOINT=localhost
MINIO_PRIMARY_ENDPOINT=http://localhost:9000
MINIO_USE_SSL=false
```

**场景 2: 局域网部署（局域网内多人访问）**
```bash
MINIO_ENDPOINT=192.168.1.100  # 服务器局域网 IP
MINIO_PRIMARY_ENDPOINT=http://192.168.1.100:9000
MINIO_USE_SSL=false
```

**场景 3: 公网部署（使用域名 + HTTPS）**
```bash
MINIO_ENDPOINT=minio.yourdomain.com
MINIO_PRIMARY_ENDPOINT=https://minio.yourdomain.com
MINIO_USE_SSL=true
```

#### ⚠️ 常见错误

❌ **错误配置:**
```bash
MINIO_ENDPOINT=minio  # 容器名称，浏览器无法访问
```

✅ **正确配置:**
```bash
MINIO_ENDPOINT=192.168.1.100  # 实际可访问的 IP
```

### 3. 完整配置文件示例

```bash
# 应用端口
APP_PORT=3000

# 数据库配置
DATABASE_URL=file:/app/data/db/ehs.db

# MinIO 配置
MINIO_ENDPOINT=192.168.1.100
MINIO_PORT=9000
MINIO_CONSOLE_PORT=9001
MINIO_USE_SSL=false

# MinIO 凭证（请修改为强密码）
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=MyStrongPassword123!
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=MyStrongPassword123!

# MinIO 主端点
MINIO_PRIMARY_ENDPOINT=http://192.168.1.100:9000
MINIO_PRIMARY_ACCESS_KEY=admin
MINIO_PRIMARY_SECRET_KEY=MyStrongPassword123!

# 备份路径
MINIO_BACKUP_TARGET=/app/data/minio-backup
```

---

## 🚢 部署步骤

### 方法 1: 使用一键脚本（推荐）

```bash
# 确保已配置 .env.docker.local
python3 scripts/docker_oneclick.py
```

脚本会自动：
- ✅ 检测 Docker 和 Docker Compose
- ✅ 创建必要的目录结构
- ✅ 构建 Docker 镜像
- ✅ 启动所有服务
- ✅ 显示服务状态

### 方法 2: 手动部署

```bash
# 1. 创建必要的目录
mkdir -p data/db data/minio-data data/minio-config data/minio-backup
mkdir -p public/uploads ehs-private ehs-public

# 2. 构建镜像
docker compose --env-file .env.docker.local -f docker-compose.prod.yml build

# 3. 启动服务
docker compose --env-file .env.docker.local -f docker-compose.prod.yml up -d

# 4. 查看日志
docker compose --env-file .env.docker.local -f docker-compose.prod.yml logs -f
```

---

## ✅ 验证部署

### 1. 检查容器状态

```bash
docker ps
```

应该看到两个运行中的容器：
```
CONTAINER ID   IMAGE              STATUS         PORTS
xxxxxxxxxxxx   ehs-system:prod    Up 2 minutes   0.0.0.0:3000->3000/tcp
xxxxxxxxxxxx   minio/minio:...    Up 2 minutes   0.0.0.0:9000-9001->9000-9001/tcp
```

### 2. 检查健康状态

```bash
docker compose --env-file .env.docker.local -f docker-compose.prod.yml ps
```

`STATUS` 列应显示 `healthy`。

### 3. 查看应用日志

```bash
# 查看应用日志
docker logs ehs-app

# 查看 MinIO 日志
docker logs ehs-minio

# 实时跟踪日志
docker logs -f ehs-app
```

### 4. 访问服务

- **EHS 应用**: http://YOUR_IP:3000
- **MinIO 控制台**: http://YOUR_IP:9001
  - 用户名: `admin`（或你配置的 MINIO_ROOT_USER）
  - 密码: 你在 `.env.docker.local` 中设置的 MINIO_ROOT_PASSWORD

### 5. 测试文件上传

1. 登录 EHS 系统
2. 尝试上传一个文件
3. 检查文件是否能正常预览/下载

---

## 🔧 常见问题

### 问题 1: 容器启动失败

**症状:**
```bash
docker ps  # 看不到 ehs-app 容器
```

**排查步骤:**
```bash
# 查看详细日志
docker logs ehs-app

# 常见原因：
# 1. 端口被占用
sudo lsof -i :3000  # 检查 3000 端口

# 2. 数据库迁移失败
docker logs ehs-app | grep "prisma"

# 3. MinIO 连接失败
docker logs ehs-app | grep "minio"
```

### 问题 2: 文件上传后无法访问

**症状:** 上传成功，但点击文件链接显示 "无法访问"

**原因:** `MINIO_ENDPOINT` 配置错误

**解决方法:**
```bash
# 1. 停止服务
docker compose --env-file .env.docker.local -f docker-compose.prod.yml down

# 2. 修改 .env.docker.local
vim .env.docker.local
# 确保 MINIO_ENDPOINT 是浏览器可访问的 IP/域名

# 3. 重新启动
python3 scripts/docker_oneclick.py
```

### 问题 3: MinIO 健康检查失败

**症状:**
```bash
docker ps  # ehs-minio 显示 unhealthy
```

**解决方法:**
```bash
# 检查 MinIO 日志
docker logs ehs-minio

# 手动测试健康检查
docker exec ehs-minio mc ready local

# 如果 mc 命令不存在，说明镜像版本问题
# 可以降级到支持 mc 的版本，或修改 healthcheck
```

### 问题 4: 数据库文件丢失

**症状:** 重启容器后数据丢失

**原因:** 数据库路径配置错误，未挂载到宿主机

**检查:**
```bash
# 检查数据库文件是否在挂载目录
ls -la ./data/db/

# 应该看到 ehs.db 文件
# 如果没有，说明 DATABASE_URL 配置错误
```

### 问题 5: 权限问题

**症状:**
```bash
Error: EACCES: permission denied, mkdir '/app/data/db'
```

**解决方法:**
```bash
# 修改目录权限
sudo chown -R $USER:$USER ./data ./public/uploads ./ehs-private ./ehs-public

# 或者使用 chmod
chmod -R 755 ./data ./public/uploads ./ehs-private ./ehs-public
```

### 问题 6: 端口冲突

**症状:**
```bash
Error: bind: address already in use
```

**解决方法:**
```bash
# 查找占用端口的进程
sudo lsof -i :3000
sudo lsof -i :9000

# 停止占用进程或修改 .env.docker.local 中的端口
APP_PORT=3001
MINIO_PORT=9002
MINIO_CONSOLE_PORT=9003
```

---

## 🛠️ 维护操作

### 查看日志

```bash
# 查看所有服务日志
docker compose --env-file .env.docker.local -f docker-compose.prod.yml logs

# 查看特定服务日志
docker logs ehs-app
docker logs ehs-minio

# 实时跟踪日志
docker logs -f ehs-app

# 查看最近 100 行日志
docker logs --tail 100 ehs-app
```

### 重启服务

```bash
# 重启所有服务
docker compose --env-file .env.docker.local -f docker-compose.prod.yml restart

# 重启特定服务
docker restart ehs-app
docker restart ehs-minio
```

### 停止服务

```bash
# 停止所有服务（保留数据）
docker compose --env-file .env.docker.local -f docker-compose.prod.yml stop

# 停止并删除容器（保留数据）
docker compose --env-file .env.docker.local -f docker-compose.prod.yml down

# 停止并删除所有内容（包括数据卷，危险操作！）
docker compose --env-file .env.docker.local -f docker-compose.prod.yml down -v
```

### 更新应用

#### 场景 1：更新应用代码（无数据库变更）

**适用情况**：修复 bug、UI 优化、功能增强（不涉及数据库结构变更）

```bash
# 1. 备份数据（保险起见）
./scripts/backup-data.sh

# 2. 拉取最新代码
git pull

# 3. 停止容器（数据保留在宿主机）
docker compose --env-file .env.docker.local -f docker-compose.prod.yml down

# 4. 重新构建镜像
docker compose --env-file .env.docker.local -f docker-compose.prod.yml build --no-cache

# 5. 启动新容器（自动挂载原有数据）
docker compose --env-file .env.docker.local -f docker-compose.prod.yml up -d

# 6. 验证数据完整性
docker exec ehs-app sqlite3 /app/data/db/ehs.db "SELECT COUNT(*) FROM User;"

# 7. 查看日志确认启动成功
docker logs -f ehs-app
```

**数据安全保证**：
- ✅ 数据库文件在 `../data/db/ehs.db`（宿主机）
- ✅ 容器删除不影响数据
- ✅ 新容器启动时自动挂载原有数据

---

#### 场景 2：更新应用代码 + 数据库迁移

**适用情况**：添加新功能需要修改数据库结构（新增表、字段等）

```bash
# 1. 备份数据（重要！）
./scripts/backup-data.sh

# 2. 记录当前数据统计（用于验证）
docker exec ehs-app sqlite3 /app/data/db/ehs.db "SELECT COUNT(*) FROM User;"
docker exec ehs-app sqlite3 /app/data/db/ehs.db "SELECT COUNT(*) FROM HazardRecord;"
# 记下这些数字

# 3. 拉取最新代码
git pull

# 4. 检查是否有新的迁移文件
ls -la prisma/migrations/
# 如果有新的迁移目录，说明有数据库结构变更

# 5. 在宿主机上测试迁移（可选但推荐）
DATABASE_URL="file:../data/db/ehs.db" npx prisma migrate deploy --preview-feature

# 6. 停止容器
docker compose --env-file .env.docker.local -f docker-compose.prod.yml down

# 7. 重新构建镜像
docker compose --env-file .env.docker.local -f docker-compose.prod.yml build --no-cache

# 8. 启动新容器（Dockerfile 中的 CMD 会自动运行迁移）
docker compose --env-file .env.docker.local -f docker-compose.prod.yml up -d

# 9. 查看迁移日志
docker logs ehs-app | grep "prisma migrate"

# 10. 验证数据完整性
docker exec ehs-app sqlite3 /app/data/db/ehs.db "SELECT COUNT(*) FROM User;"
docker exec ehs-app sqlite3 /app/data/db/ehs.db "SELECT COUNT(*) FROM HazardRecord;"
# 数量应该与步骤 2 一致

# 11. 功能测试
# - 登录系统
# - 查看现有数据
# - 测试新功能
```

**数据安全保证**：
- ✅ 迁移前已备份
- ✅ Prisma 迁移是事务性的（失败会回滚）
- ✅ 数据在宿主机，可随时恢复

---

#### 场景 3：更新完整镜像（Dockerfile.full）

**适用情况**：使用完整镜像部署，需要更新到新版本

```bash
# 1. 备份当前运行容器的数据
docker cp ehs-system:/app/data/db/ehs.db ../backups/ehs-$(date +%Y%m%d-%H%M%S).db

# 2. 拉取最新代码
git pull

# 3. 更新本地数据库（用于构建新镜像）
# 方法 A：从运行容器复制
docker cp ehs-system:/app/data/db/ehs.db prisma/dev.db

# 方法 B：使用宿主机数据库
cp ../data/db/ehs.db prisma/dev.db

# 4. 运行新的迁移（如果有）
npx prisma migrate deploy

# 5. 运行构建前检查
./scripts/pre-build-check.sh

# 6. 重新构建完整镜像
./build-full-image.sh
# 或
docker build -f Dockerfile.full -t ehs-system-full:v1.2 .

# 7. 停止旧容器
docker stop ehs-system
docker rm ehs-system

# 8. 启动新容器（使用 volume 挂载保护数据）
docker run -d \
  --name ehs-system \
  -p 3100:3100 \
  -p 9100:9100 \
  -p 9101:9101 \
  -v $(pwd)/../data:/app/data \
  ehs-system-full:v1.2

# 9. 验证
docker logs ehs-system
curl http://localhost:3100/api/health
```

**关键点**：
- ⚠️ 即使使用完整镜像，也要挂载 volume
- ⚠️ Volume 中的数据优先级高于镜像中的数据
- ✅ 这样即使镜像中的数据库是旧的，容器也会使用 volume 中的新数据

---

### 更新前检查清单

每次更新镜像前，使用此检查清单：

```bash
# ✅ 1. 确认数据位置
ls -la ../data/db/ehs.db
ls -la ../data/minio-data/

# ✅ 2. 备份数据
./scripts/backup-data.sh

# ✅ 3. 检查 docker-compose volume 配置
grep -A 5 "volumes:" docker-compose.prod.yml
# 应该看到: - ../data:/app/data

# ✅ 4. 测试迁移（如果有）
DATABASE_URL="file:../data/db/ehs.db" npx prisma migrate deploy --preview-feature

# ✅ 5. 记录当前数据统计
docker exec ehs-app sqlite3 /app/data/db/ehs.db "SELECT COUNT(*) FROM User;"
docker exec ehs-app sqlite3 /app/data/db/ehs.db "SELECT COUNT(*) FROM HazardRecord;"

# ✅ 6. 执行更新
# ... 更新步骤 ...

# ✅ 7. 验证数据完整性
docker exec ehs-app sqlite3 /app/data/db/ehs.db "SELECT COUNT(*) FROM User;"
docker exec ehs-app sqlite3 /app/data/db/ehs.db "SELECT COUNT(*) FROM HazardRecord;"
# 数量应该与更新前一致

# ✅ 8. 功能测试
# - 登录系统
# - 查看隐患记录
# - 上传文件
# - 下载文件
```

---

### 数据备份

```bash
# 使用备份脚本（推荐）
./scripts/backup-data.sh

# 手动备份数据库
cp ../data/db/ehs.db ../backups/ehs-$(date +%Y%m%d-%H%M%S).db

# 手动备份 MinIO 数据
tar -czf ../backups/minio-backup-$(date +%Y%m%d-%H%M%S).tar.gz ../data/minio-data

# 手动备份上传文件
tar -czf ../backups/uploads-backup-$(date +%Y%m%d-%H%M%S).tar.gz ./public/uploads
```

### 数据恢复

```bash
# 1. 停止服务
docker compose --env-file .env.docker.local -f docker-compose.prod.yml down

# 2. 恢复数据库
cp ../backups/ehs-20260128-120000.db ../data/db/ehs.db

# 3. 恢复 MinIO 数据
tar -xzf ../backups/minio-backup-20260128-120000.tar.gz -C ../data/

# 4. 重启服务
docker compose --env-file .env.docker.local -f docker-compose.prod.yml up -d
```

### 清理磁盘空间

```bash
# 清理未使用的镜像
docker image prune -a

# 清理未使用的容器
docker container prune

# 清理未使用的卷
docker volume prune

# 清理所有未使用的资源
docker system prune -a
```

### 进入容器调试

```bash
# 进入应用容器
docker exec -it ehs-app sh

# 进入 MinIO 容器
docker exec -it ehs-minio sh

# 在容器内执行命令
docker exec ehs-app npx prisma migrate status
docker exec ehs-minio mc admin info local
```

---

## 📊 监控和性能

### 查看资源使用

```bash
# 查看所有容器资源使用
docker stats

# 查看特定容器资源使用
docker stats ehs-app ehs-minio
```

### 健康检查

```bash
# 检查应用健康状态
curl http://localhost:3000/api/health

# 检查 MinIO 健康状态
docker exec ehs-minio mc ready local
```

---

## 🔒 安全建议

1. **修改默认密码**: 务必修改 `.env.docker.local` 中的所有密码
2. **使用 HTTPS**: 生产环境建议配置 SSL 证书
3. **防火墙配置**: 限制端口访问，只开放必要的端口
4. **定期备份**: 设置自动备份任务
5. **更新镜像**: 定期更新 Docker 镜像到最新版本
6. **日志轮转**: 配置 Docker 日志轮转，避免日志文件过大

```bash
# 配置日志轮转（在 docker-compose.prod.yml 中添加）
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

---

## 📞 获取帮助

如果遇到问题：

1. 查看本文档的 [常见问题](#常见问题) 部分
2. 检查容器日志: `docker logs ehs-app`
3. 查看 GitHub Issues
4. 联系技术支持

---

## 📝 附录

### 目录结构

```
EHS-system/
├── data/                      # 持久化数据目录
│   ├── db/                    # SQLite 数据库
│   │   └── ehs.db
│   ├── minio-data/            # MinIO 对象存储
│   ├── minio-config/          # MinIO 配置
│   └── minio-backup/          # MinIO 备份
├── public/uploads/            # 上传文件
├── ehs-private/               # 私有存储桶
├── ehs-public/                # 公共存储桶
├── .env.docker.local          # 环境配置（需创建）
├── docker-compose.prod.yml    # Docker Compose 配置
├── Dockerfile                 # Docker 镜像定义
└── scripts/
    └── docker_oneclick.py     # 一键部署脚本
```

### 环境变量完整列表

| 变量名 | 说明 | 默认值 | 必须修改 |
|--------|------|--------|----------|
| `APP_PORT` | 应用端口 | 3000 | 否 |
| `DATABASE_URL` | 数据库路径 | file:/app/data/db/ehs.db | 否 |
| `MINIO_ENDPOINT` | MinIO 端点 | - | ✅ 是 |
| `MINIO_PORT` | MinIO 端口 | 9000 | 否 |
| `MINIO_CONSOLE_PORT` | MinIO 控制台端口 | 9001 | 否 |
| `MINIO_USE_SSL` | 启用 SSL | false | 否 |
| `MINIO_ACCESS_KEY` | MinIO 访问密钥 | admin | ✅ 建议 |
| `MINIO_SECRET_KEY` | MinIO 密钥 | - | ✅ 建议 |
| `MINIO_ROOT_USER` | MinIO Root 用户 | admin | ✅ 建议 |
| `MINIO_ROOT_PASSWORD` | MinIO Root 密码 | - | ✅ 建议 |
| `MINIO_PRIMARY_ENDPOINT` | MinIO 主端点 | - | ✅ 是 |
| `MINIO_PRIMARY_ACCESS_KEY` | 主端点访问密钥 | admin | ✅ 建议 |
| `MINIO_PRIMARY_SECRET_KEY` | 主端点密钥 | - | ✅ 建议 |
| `MINIO_BACKUP_TARGET` | 备份目标路径 | /app/data/minio-backup | 否 |

---

**最后更新**: 2026-01-28
**版本**: 1.0.0
