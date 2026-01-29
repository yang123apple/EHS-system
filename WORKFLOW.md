# EHS 系统开发-构建-部署完整工作流

## 📋 目录

- [工作流概览](#工作流概览)
- [环境说明](#环境说明)
- [本地开发](#本地开发)
- [构建和打包](#构建和打包)
- [部署到服务器](#部署到服务器)
- [更新服务](#更新服务)
- [数据管理](#数据管理)
- [常见场景](#常见场景)
- [故障排查](#故障排查)

---

## 🎯 工作流概览

```
┌─────────────────────────────────────────────────────────────┐
│                     完整工作流程                              │
└─────────────────────────────────────────────────────────────┘

本地开发环境                构建打包                服务器部署
─────────────              ─────────              ─────────────

1. 编写代码          →    2. 构建镜像      →    3. 部署服务
   npm run dev             docker build           docker up

4. 测试功能          →    5. 导出镜像      →    6. 传输到服务器
   本地测试                docker save            scp/rsync

                          6. 或推送到仓库  →    7. 从仓库拉取
                             docker push           docker pull

                                                  8. 更新服务
                                                     docker update

                                                  9. 数据备份
                                                     定期备份
```

---

## 🌍 环境说明

### 本地开发环境

- **用途**: 日常开发、功能测试
- **数据库**: SQLite (./prisma/dev.db)
- **MinIO**: 本地 MinIO 服务 (localhost:9000)
- **端口**: 3000 (开发服务器)
- **启动**: `npm run dev`

### Docker 生产环境

- **用途**: 生产部署、服务器运行
- **数据库**: SQLite (./data/db/ehs.db，挂载卷)
- **MinIO**: Docker MinIO 容器
- **端口**: 3000 (应用), 9000 (MinIO), 9001 (MinIO 控制台)
- **启动**: `python3 scripts/docker_oneclick.py`

---

## 💻 本地开发

### 初始化开发环境

```bash
# 1. 克隆代码
git clone <repository-url>
cd EHS-system

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
vim .env  # 配置本地 MinIO 等

# 4. 初始化数据库
npx prisma migrate dev

# 5. 启动开发服务器
npm run dev
```

### 日常开发流程

```bash
# 1. 创建功能分支
git checkout -b feature/new-feature

# 2. 编写代码
# 修改文件...

# 3. 测试功能
npm run dev  # 访问 http://localhost:3000

# 4. 提交代码
git add .
git commit -m "feat: add new feature"

# 5. 推送到远程
git push origin feature/new-feature

# 6. 合并到主分支
git checkout main
git merge feature/new-feature
git push origin main
```

### 开发环境与生产环境隔离

**关键点**: 本地开发不会影响 Docker 生产环境

- 本地开发使用 `.env` 和 `./prisma/dev.db`
- Docker 使用 `.env.docker.local` 和 `./data/db/ehs.db`
- 两个环境的数据库和配置完全独立

---

## 🔨 构建和打包

### 方式 1: 本地构建镜像（推荐）

适用于有 Docker 环境的情况。

```bash
# 1. 确保代码已提交
git status  # 检查是否有未提交的更改

# 2. 构建 Docker 镜像
docker compose -f docker-compose.prod.yml build

# 3. 查看构建的镜像
docker images | grep ehs-system
# 应该看到: ehs-system:prod

# 4. 测试镜像（可选）
python3 scripts/docker_oneclick.py
# 访问 http://localhost:3000 测试

# 5. 导出镜像（用于传输到服务器）
python3 scripts/docker_image.py export --image ehs-system:prod

# 输出: ./docker-images/ehs-system-prod-YYYYMMDD-HHMMSS.tar.gz
```

### 方式 2: 使用 Docker Registry

适用于有私有 Registry 或使用 Docker Hub 的情况。

```bash
# 1. 构建并打标签
docker compose -f docker-compose.prod.yml build
docker tag ehs-system:prod your-registry.com/ehs-system:latest
docker tag ehs-system:prod your-registry.com/ehs-system:v1.0.0

# 2. 推送到 Registry
docker push your-registry.com/ehs-system:latest
docker push your-registry.com/ehs-system:v1.0.0

# 3. 在服务器上拉取
# (在服务器上执行)
docker pull your-registry.com/ehs-system:latest
```

### 方式 3: 在服务器上直接构建

适用于服务器有 Git 和 Docker 的情况。

```bash
# 在服务器上执行

# 1. 拉取最新代码
git pull origin main

# 2. 构建镜像
docker compose -f docker-compose.prod.yml build

# 3. 重启服务
python3 scripts/docker_update.py
```

---

## 🚀 部署到服务器

### 首次部署

#### 步骤 1: 准备服务器环境

```bash
# 在服务器上执行

# 1. 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 2. 安装 Docker Compose
sudo apt-get update
sudo apt-get install docker-compose-plugin

# 3. 验证安装
docker --version
docker compose version

# 4. 添加当前用户到 docker 组（可选）
sudo usermod -aG docker $USER
# 重新登录以生效
```

#### 步骤 2: 传输代码和镜像

**方式 A: 使用 Git（推荐）**

```bash
# 在服务器上执行

# 1. 克隆代码
git clone <repository-url>
cd EHS-system

# 2. 配置环境变量
cp .env.docker.example .env.docker.local
vim .env.docker.local
# 修改 MINIO_ENDPOINT 为服务器 IP
# 修改所有密码为强密码

# 3. 构建镜像
docker compose -f docker-compose.prod.yml build
```

**方式 B: 传输镜像文件**

```bash
# 在本地执行

# 1. 导出镜像
python3 scripts/docker_image.py export --image ehs-system:prod

# 2. 传输到服务器
scp ./docker-images/ehs-system-prod-*.tar.gz user@server:/path/to/EHS-system/

# 在服务器上执行

# 3. 导入镜像
cd /path/to/EHS-system
python3 scripts/docker_image.py import ./ehs-system-prod-*.tar.gz

# 4. 配置环境变量
cp .env.docker.example .env.docker.local
vim .env.docker.local
```

#### 步骤 3: 启动服务

```bash
# 在服务器上执行

# 1. 一键启动
python3 scripts/docker_oneclick.py

# 2. 检查服务状态
docker ps
# 应该看到 ehs-app 和 ehs-minio 都在运行

# 3. 查看日志
docker logs -f ehs-app

# 4. 测试健康检查
curl http://localhost:3000/api/health

# 5. 访问应用
# 浏览器打开: http://SERVER_IP:3000
```

---

## 🔄 更新服务

### 场景 1: 代码更新（有 Git）

```bash
# 在服务器上执行

# 使用自动更新脚本（推荐）
python3 scripts/docker_update.py

# 或手动更新
git pull origin main
docker compose -f docker-compose.prod.yml build
docker compose --env-file .env.docker.local -f docker-compose.prod.yml up -d
```

### 场景 2: 镜像更新（无 Git）

```bash
# 在本地执行

# 1. 构建新镜像
docker compose -f docker-compose.prod.yml build

# 2. 导出镜像
python3 scripts/docker_image.py export --image ehs-system:prod

# 3. 传输到服务器
scp ./docker-images/ehs-system-prod-*.tar.gz user@server:/path/to/EHS-system/

# 在服务器上执行

# 4. 备份数据
python3 scripts/docker_backup.py

# 5. 导入新镜像
python3 scripts/docker_image.py import ./ehs-system-prod-*.tar.gz

# 6. 重启服务
docker compose --env-file .env.docker.local -f docker-compose.prod.yml up -d

# 7. 检查服务
docker logs -f ehs-app
```

### 场景 3: 零停机更新

```bash
# 在服务器上执行

# 使用滚动更新模式
python3 scripts/docker_update.py --mode rolling

# 特点:
# - 自动备份数据
# - 最小停机时间（通常 < 10 秒）
# - 自动健康检查
# - 失败自动回滚
```

### 场景 4: 完全重建

```bash
# 在服务器上执行

# 使用重建模式
python3 scripts/docker_update.py --mode recreate

# 特点:
# - 完全停止服务
# - 重新创建容器
# - 适用于重大更新
# - 停机时间较长（通常 30-60 秒）
```

---

## 💾 数据管理

### 备份数据

```bash
# 在服务器上执行

# 完整备份（推荐）
python3 scripts/docker_backup.py

# 仅备份数据库
python3 scripts/docker_backup.py --skip-minio --skip-uploads

# 指定备份目录
python3 scripts/docker_backup.py --backup-dir /path/to/backups

# 备份文件位置
ls -lh ./backups/backup-YYYYMMDD-HHMMSS/
```

### 恢复数据

```bash
# 在服务器上执行

# 完整恢复
python3 scripts/docker_restore.py --backup-dir ./backups/backup-YYYYMMDD-HHMMSS

# 仅恢复数据库
python3 scripts/docker_restore.py \
  --backup-dir ./backups/backup-YYYYMMDD-HHMMSS \
  --skip-minio --skip-uploads

# 恢复但不重启服务
python3 scripts/docker_restore.py \
  --backup-dir ./backups/backup-YYYYMMDD-HHMMSS \
  --no-restart
```

### 数据迁移（本地 → 服务器）

```bash
# 在本地执行

# 1. 导出本地数据
npm run db:export  # 导出为 JSON

# 2. 传输到服务器
scp ./data/export-*.json user@server:/path/to/EHS-system/data/

# 在服务器上执行

# 3. 导入数据
docker exec ehs-app npm run db:import -- /app/data/export-*.json
```

### 定期备份（推荐）

```bash
# 在服务器上设置 cron 任务

# 编辑 crontab
crontab -e

# 添加以下行（每天凌晨 2 点备份）
0 2 * * * cd /path/to/EHS-system && python3 scripts/docker_backup.py >> /var/log/ehs-backup.log 2>&1

# 添加以下行（每周日清理 30 天前的备份）
0 3 * * 0 find /path/to/EHS-system/backups -type d -mtime +30 -exec rm -rf {} +
```

---

## 📚 常见场景

### 场景 1: 本地开发 → 测试部署

```bash
# 1. 本地开发完成
git add .
git commit -m "feat: new feature"
git push origin main

# 2. 在测试服务器上更新
ssh test-server
cd /path/to/EHS-system
python3 scripts/docker_update.py

# 3. 测试功能
curl http://test-server:3000/api/health
# 浏览器测试功能

# 4. 确认无误后部署到生产
ssh prod-server
cd /path/to/EHS-system
python3 scripts/docker_update.py
```

### 场景 2: 紧急回滚

```bash
# 在服务器上执行

# 1. 查看备份
ls -lh ./backups/

# 2. 恢复到最近的备份
python3 scripts/docker_restore.py --backup-dir ./backups/backup-YYYYMMDD-HHMMSS

# 3. 或者使用 Git 回滚代码
git log --oneline  # 查看提交历史
git checkout <commit-hash>  # 回滚到指定版本
python3 scripts/docker_update.py --no-pull  # 使用当前代码更新
```

### 场景 3: 服务器迁移

```bash
# 在旧服务器上执行

# 1. 备份所有数据
python3 scripts/docker_backup.py

# 2. 导出镜像
python3 scripts/docker_image.py export --image ehs-system:prod

# 3. 打包所有文件
tar -czf ehs-migration.tar.gz \
  ./backups/backup-YYYYMMDD-HHMMSS \
  ./docker-images/ehs-system-prod-*.tar.gz \
  .env.docker.local

# 4. 传输到新服务器
scp ehs-migration.tar.gz user@new-server:/path/to/

# 在新服务器上执行

# 5. 解压文件
tar -xzf ehs-migration.tar.gz

# 6. 克隆代码
git clone <repository-url> EHS-system
cd EHS-system

# 7. 导入镜像
python3 scripts/docker_image.py import ../docker-images/ehs-system-prod-*.tar.gz

# 8. 恢复配置
cp ../env.docker.local .env.docker.local
vim .env.docker.local  # 修改 MINIO_ENDPOINT 为新服务器 IP

# 9. 恢复数据
python3 scripts/docker_restore.py --backup-dir ../backups/backup-YYYYMMDD-HHMMSS

# 10. 启动服务
python3 scripts/docker_oneclick.py
```

### 场景 4: 多环境部署

```bash
# 准备不同环境的配置文件

# 开发环境
.env.docker.dev

# 测试环境
.env.docker.test

# 生产环境
.env.docker.prod

# 部署到不同环境
docker compose --env-file .env.docker.dev -f docker-compose.prod.yml up -d
docker compose --env-file .env.docker.test -f docker-compose.prod.yml up -d
docker compose --env-file .env.docker.prod -f docker-compose.prod.yml up -d
```

---

## 🔧 故障排查

### 问题 1: 更新后服务无法启动

```bash
# 1. 查看日志
docker logs ehs-app

# 2. 检查容器状态
docker ps -a

# 3. 如果是数据库迁移失败
docker exec ehs-app npx prisma migrate status
docker exec ehs-app npx prisma migrate deploy

# 4. 如果无法修复，回滚到备份
python3 scripts/docker_restore.py --backup-dir ./backups/backup-YYYYMMDD-HHMMSS
```

### 问题 2: 镜像导入失败

```bash
# 1. 检查文件完整性
ls -lh ./docker-images/ehs-system-prod-*.tar.gz

# 2. 手动解压测试
gunzip -t ./docker-images/ehs-system-prod-*.tar.gz

# 3. 如果文件损坏，重新传输
# 在本地重新导出并传输

# 4. 或者在服务器上直接构建
git pull origin main
docker compose -f docker-compose.prod.yml build
```

### 问题 3: 数据恢复后数据不一致

```bash
# 1. 检查数据库文件
ls -lh ./data/db/ehs.db

# 2. 检查数据库完整性
docker exec ehs-app npx prisma db execute --stdin <<< "PRAGMA integrity_check;"

# 3. 如果数据库损坏，尝试修复
docker exec ehs-app npx prisma db push --force-reset

# 4. 重新导入数据
python3 scripts/docker_restore.py --backup-dir ./backups/backup-YYYYMMDD-HHMMSS
```

### 问题 4: 更新后文件无法访问

```bash
# 1. 检查 MinIO 配置
docker exec ehs-app env | grep MINIO

# 2. 检查 MinIO 服务
docker logs ehs-minio

# 3. 测试 MinIO 连接
docker exec ehs-minio mc admin info local

# 4. 如果 MINIO_ENDPOINT 配置错误
vim .env.docker.local  # 修改为正确的 IP
docker compose --env-file .env.docker.local -f docker-compose.prod.yml restart app
```

---

## 📊 工作流最佳实践

### 1. 版本管理

```bash
# 使用 Git 标签标记版本
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0

# 构建时使用版本标签
docker tag ehs-system:prod ehs-system:v1.0.0
```

### 2. 自动化部署

创建部署脚本 `deploy.sh`:

```bash
#!/bin/bash
set -e

echo "🚀 开始部署 EHS 系统"

# 1. 备份
python3 scripts/docker_backup.py

# 2. 拉取代码
git pull origin main

# 3. 构建镜像
docker compose -f docker-compose.prod.yml build

# 4. 更新服务
python3 scripts/docker_update.py --mode rolling

# 5. 健康检查
sleep 10
curl -f http://localhost:3000/api/health || exit 1

echo "✅ 部署完成"
```

### 3. 监控和告警

```bash
# 创建健康检查脚本
cat > /usr/local/bin/ehs-health-check.sh <<'EOF'
#!/bin/bash
if ! curl -f -s http://localhost:3000/api/health > /dev/null; then
  echo "EHS 服务异常" | mail -s "EHS Alert" admin@example.com
fi
EOF

chmod +x /usr/local/bin/ehs-health-check.sh

# 添加到 crontab（每 5 分钟检查一次）
*/5 * * * * /usr/local/bin/ehs-health-check.sh
```

### 4. 日志管理

```bash
# 配置日志轮转
cat > /etc/logrotate.d/ehs-docker <<'EOF'
/var/lib/docker/containers/*/*.log {
  rotate 7
  daily
  compress
  size=10M
  missingok
  delaycompress
  copytruncate
}
EOF
```

---

## 📝 快速参考

### 常用命令速查

```bash
# 本地开发
npm run dev                    # 启动开发服务器
npm run build                  # 构建生产代码
npm run db:export              # 导出数据库

# Docker 构建
docker compose -f docker-compose.prod.yml build    # 构建镜像
python3 scripts/docker_image.py export             # 导出镜像

# Docker 部署
python3 scripts/docker_oneclick.py                 # 一键部署
python3 scripts/docker_update.py                   # 更新服务

# 数据管理
python3 scripts/docker_backup.py                   # 备份数据
python3 scripts/docker_restore.py --backup-dir ... # 恢复数据

# 服务管理
docker ps                                          # 查看容器
docker logs -f ehs-app                             # 查看日志
docker compose ... restart                         # 重启服务
```

---

**最后更新**: 2026-01-28
**版本**: 1.0.0
