# EHS 系统开发部署快速开始指南

## 🎯 5 分钟快速上手

### 场景 1: 我是开发者，想在本地开发

```bash
# 1. 克隆代码
git clone <repository-url>
cd EHS-system

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev

# 4. 访问应用
# 浏览器打开: http://localhost:3000
```

**完成！** 现在可以开始编写代码了。

---

### 场景 2: 我想部署到服务器

```bash
# 在服务器上执行

# 1. 克隆代码
git clone <repository-url>
cd EHS-system

# 2. 配置环境
cp .env.docker.example .env.docker.local
vim .env.docker.local
# 修改 MINIO_ENDPOINT=YOUR_SERVER_IP

# 3. 一键部署
python3 scripts/docker_oneclick.py

# 4. 访问应用
# 浏览器打开: http://YOUR_SERVER_IP:3000
```

**完成！** 服务已经运行了。

---

### 场景 3: 我想更新服务器上的代码

```bash
# 在服务器上执行

# 一键更新（自动备份、拉取代码、构建、重启）
python3 scripts/docker_update.py
```

**完成！** 服务已更新到最新版本。

---

## 📚 详细场景指南

### 场景 A: 本地开发 → 构建 → 部署到服务器

#### 步骤 1: 本地开发

```bash
# 在本地执行

# 1. 开发新功能
git checkout -b feature/new-feature
# 编写代码...
npm run dev  # 测试

# 2. 提交代码
git add .
git commit -m "feat: add new feature"
git push origin feature/new-feature

# 3. 合并到主分支
git checkout main
git merge feature/new-feature
git push origin main
```

#### 步骤 2: 构建镜像

```bash
# 在本地执行

# 构建 Docker 镜像
docker compose -f docker-compose.prod.yml build

# 导出镜像（用于传输）
python3 scripts/docker_image.py export --image ehs-system:prod
# 输出: ./docker-images/ehs-system-prod-YYYYMMDD-HHMMSS.tar.gz
```

#### 步骤 3: 部署到服务器

**方式 A: 传输镜像文件**

```bash
# 在本地执行
scp ./docker-images/ehs-system-prod-*.tar.gz user@server:/path/to/EHS-system/

# 在服务器上执行
cd /path/to/EHS-system
python3 scripts/docker_backup.py  # 先备份
python3 scripts/docker_image.py import ./ehs-system-prod-*.tar.gz
docker compose --env-file .env.docker.local -f docker-compose.prod.yml up -d
```

**方式 B: 使用 Git（推荐）**

```bash
# 在服务器上执行
cd /path/to/EHS-system
python3 scripts/docker_update.py  # 自动拉取、构建、更新
```

---

### 场景 B: 服务器上直接开发和部署

```bash
# 在服务器上执行

# 1. 修改代码
vim src/app/page.tsx

# 2. 提交代码
git add .
git commit -m "fix: update homepage"
git push origin main

# 3. 重新构建和部署
python3 scripts/docker_update.py --no-pull  # 使用当前代码
```

---

### 场景 C: 数据备份和恢复

#### 备份数据

```bash
# 在服务器上执行

# 完整备份
python3 scripts/docker_backup.py

# 查看备份
ls -lh ./backups/backup-YYYYMMDD-HHMMSS/
cat ./backups/backup-YYYYMMDD-HHMMSS/backup-manifest.txt
```

#### 恢复数据

```bash
# 在服务器上执行

# 完整恢复
python3 scripts/docker_restore.py --backup-dir ./backups/backup-YYYYMMDD-HHMMSS

# 仅恢复数据库
python3 scripts/docker_restore.py \
  --backup-dir ./backups/backup-YYYYMMDD-HHMMSS \
  --skip-minio --skip-uploads
```

---

### 场景 D: 服务器迁移

#### 在旧服务器上

```bash
# 1. 备份所有数据
python3 scripts/docker_backup.py

# 2. 导出镜像
python3 scripts/docker_image.py export --image ehs-system:prod

# 3. 打包传输
tar -czf ehs-full-backup.tar.gz \
  ./backups/backup-YYYYMMDD-HHMMSS \
  ./docker-images/ehs-system-prod-*.tar.gz \
  .env.docker.local

# 4. 传输到新服务器
scp ehs-full-backup.tar.gz user@new-server:/tmp/
```

#### 在新服务器上

```bash
# 1. 解压文件
cd /tmp
tar -xzf ehs-full-backup.tar.gz

# 2. 克隆代码
git clone <repository-url> /opt/EHS-system
cd /opt/EHS-system

# 3. 导入镜像
python3 scripts/docker_image.py import /tmp/docker-images/ehs-system-prod-*.tar.gz

# 4. 恢复配置
cp /tmp/.env.docker.local .env.docker.local
vim .env.docker.local  # 修改 MINIO_ENDPOINT 为新服务器 IP

# 5. 恢复数据
python3 scripts/docker_restore.py --backup-dir /tmp/backups/backup-YYYYMMDD-HHMMSS

# 6. 启动服务
python3 scripts/docker_oneclick.py
```

---

## 🛠️ 工具脚本说明

### 1. docker_oneclick.py - 一键部署

**用途**: 首次部署或重新部署

```bash
# 基本用法
python3 scripts/docker_oneclick.py

# 功能:
# - 检测 Docker 环境
# - 创建必要目录
# - 构建镜像
# - 启动服务
```

---

### 2. docker_update.py - 服务更新

**用途**: 更新运行中的服务

```bash
# 滚动更新（推荐，最小停机）
python3 scripts/docker_update.py --mode rolling

# 完全重建（停机更新）
python3 scripts/docker_update.py --mode recreate

# 跳过备份
python3 scripts/docker_update.py --no-backup

# 跳过拉取代码（使用当前代码）
python3 scripts/docker_update.py --no-pull

# 不使用缓存构建
python3 scripts/docker_update.py --no-cache

# 更新后显示日志
python3 scripts/docker_update.py --show-logs
```

**功能**:
- ✅ 自动备份数据
- ✅ 拉取最新代码
- ✅ 构建新镜像
- ✅ 滚动更新服务
- ✅ 健康检查
- ✅ 失败自动回滚

---

### 3. docker_backup.py - 数据备份

**用途**: 备份数据库、MinIO 数据、上传文件

```bash
# 完整备份
python3 scripts/docker_backup.py

# 仅备份数据库
python3 scripts/docker_backup.py --skip-minio --skip-uploads

# 指定备份目录
python3 scripts/docker_backup.py --backup-dir /path/to/backups

# 指定容器名称
python3 scripts/docker_backup.py --container ehs-app
```

**备份内容**:
- 📦 数据库文件 (ehs.db)
- 📦 MinIO 数据 (对象存储)
- 📦 上传文件 (public/uploads)
- 📦 环境配置 (.env.docker.local)
- 📋 备份清单 (backup-manifest.txt)

---

### 4. docker_restore.py - 数据恢复

**用途**: 从备份恢复数据

```bash
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

# 跳过环境配置恢复
python3 scripts/docker_restore.py \
  --backup-dir ./backups/backup-YYYYMMDD-HHMMSS \
  --skip-env
```

**恢复流程**:
1. 停止服务
2. 恢复数据库
3. 恢复 MinIO 数据
4. 恢复上传文件
5. 恢复环境配置
6. 启动服务
7. 健康检查

---

### 5. docker_image.py - 镜像管理

**用途**: 导出/导入 Docker 镜像

```bash
# 导出镜像
python3 scripts/docker_image.py export --image ehs-system:prod
python3 scripts/docker_image.py export --image ehs-system:prod --output-dir /path/to/output

# 导入镜像
python3 scripts/docker_image.py import ./ehs-system-prod-YYYYMMDD-HHMMSS.tar.gz

# 列出本地镜像
python3 scripts/docker_image.py list
```

**功能**:
- 📦 导出镜像为 .tar.gz 文件
- 📥 导入镜像到 Docker
- 🗜️ 自动压缩（节省 50-70% 空间）
- 📋 显示镜像列表

---

## 📊 常用命令速查表

### Docker 基础命令

```bash
# 查看容器
docker ps                              # 运行中的容器
docker ps -a                           # 所有容器

# 查看日志
docker logs ehs-app                    # 查看日志
docker logs -f ehs-app                 # 实时跟踪日志
docker logs --tail 100 ehs-app         # 最近 100 行

# 进入容器
docker exec -it ehs-app sh             # 进入容器 shell
docker exec ehs-app env                # 查看环境变量

# 重启容器
docker restart ehs-app                 # 重启应用容器
docker restart ehs-minio               # 重启 MinIO 容器

# 停止/启动
docker stop ehs-app                    # 停止容器
docker start ehs-app                   # 启动容器
```

### Docker Compose 命令

```bash
# 使用环境变量文件
export ENV_FILE=.env.docker.local
export COMPOSE_FILE=docker-compose.prod.yml

# 启动服务
docker compose --env-file $ENV_FILE -f $COMPOSE_FILE up -d

# 停止服务
docker compose --env-file $ENV_FILE -f $COMPOSE_FILE down

# 重启服务
docker compose --env-file $ENV_FILE -f $COMPOSE_FILE restart

# 查看状态
docker compose --env-file $ENV_FILE -f $COMPOSE_FILE ps

# 查看日志
docker compose --env-file $ENV_FILE -f $COMPOSE_FILE logs -f

# 构建镜像
docker compose --env-file $ENV_FILE -f $COMPOSE_FILE build

# 重新构建并启动
docker compose --env-file $ENV_FILE -f $COMPOSE_FILE up -d --build
```

### 健康检查命令

```bash
# 检查应用健康
curl http://localhost:3000/api/health

# 检查容器健康状态
docker inspect --format='{{.State.Health.Status}}' ehs-app

# 检查 MinIO
docker exec ehs-minio mc ready local

# 查看资源使用
docker stats ehs-app ehs-minio
```

### 数据库命令

```bash
# 查看数据库状态
docker exec ehs-app npx prisma migrate status

# 执行数据库迁移
docker exec ehs-app npx prisma migrate deploy

# 重置数据库（危险！）
docker exec ehs-app npx prisma migrate reset

# 导出数据
docker exec ehs-app npm run db:export

# 导入数据
docker exec ehs-app npm run db:import -- /app/data/export.json
```

---

## 🚨 故障排查速查

### 问题: 容器无法启动

```bash
# 1. 查看日志
docker logs ehs-app

# 2. 检查端口占用
sudo lsof -i :3000
sudo lsof -i :9000

# 3. 检查配置文件
cat .env.docker.local

# 4. 重新构建
docker compose -f docker-compose.prod.yml build --no-cache
docker compose --env-file .env.docker.local -f docker-compose.prod.yml up -d
```

### 问题: 文件上传后无法访问

```bash
# 1. 检查 MinIO 配置
docker exec ehs-app env | grep MINIO

# 2. 修改配置
vim .env.docker.local
# 确保 MINIO_ENDPOINT 是浏览器可访问的 IP

# 3. 重启服务
docker restart ehs-app
```

### 问题: 数据库错误

```bash
# 1. 检查数据库文件
ls -lh ./data/db/ehs.db

# 2. 检查数据库完整性
docker exec ehs-app npx prisma db execute --stdin <<< "PRAGMA integrity_check;"

# 3. 重新执行迁移
docker exec ehs-app npx prisma migrate deploy

# 4. 如果无法修复，恢复备份
python3 scripts/docker_restore.py --backup-dir ./backups/backup-YYYYMMDD-HHMMSS
```

### 问题: 更新后服务异常

```bash
# 1. 查看最近的备份
ls -lh ./backups/

# 2. 回滚到备份
python3 scripts/docker_restore.py --backup-dir ./backups/backup-YYYYMMDD-HHMMSS

# 3. 或者回滚代码
git log --oneline
git checkout <previous-commit>
python3 scripts/docker_update.py --no-pull
```

---

## 💡 最佳实践

### 1. 定期备份

```bash
# 设置每天自动备份
crontab -e

# 添加以下行（每天凌晨 2 点）
0 2 * * * cd /path/to/EHS-system && python3 scripts/docker_backup.py >> /var/log/ehs-backup.log 2>&1
```

### 2. 更新前备份

```bash
# 更新脚本会自动备份，但也可以手动备份
python3 scripts/docker_backup.py
python3 scripts/docker_update.py
```

### 3. 使用版本标签

```bash
# 给重要版本打标签
git tag -a v1.0.0 -m "Release 1.0.0"
git push origin v1.0.0

# 构建时使用版本标签
docker tag ehs-system:prod ehs-system:v1.0.0
```

### 4. 监控服务健康

```bash
# 创建监控脚本
cat > /usr/local/bin/ehs-monitor.sh <<'EOF'
#!/bin/bash
if ! curl -f -s http://localhost:3000/api/health > /dev/null; then
  echo "$(date): EHS 服务异常" >> /var/log/ehs-monitor.log
  # 可以添加告警通知
fi
EOF

chmod +x /usr/local/bin/ehs-monitor.sh

# 每 5 分钟检查一次
crontab -e
*/5 * * * * /usr/local/bin/ehs-monitor.sh
```

---

## 📞 获取帮助

### 文档资源

- **完整工作流**: [WORKFLOW.md](WORKFLOW.md)
- **部署指南**: [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md)
- **快速参考**: [DOCKER_QUICKSTART.md](DOCKER_QUICKSTART.md)
- **方案总结**: [DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md)

### 常见问题

查看 [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) 的"常见问题"部分。

### 脚本帮助

```bash
# 查看脚本帮助
python3 scripts/docker_oneclick.py --help
python3 scripts/docker_update.py --help
python3 scripts/docker_backup.py --help
python3 scripts/docker_restore.py --help
python3 scripts/docker_image.py --help
```

---

## ✅ 检查清单

### 首次部署检查清单

- [ ] Docker 已安装并运行
- [ ] 代码已克隆到服务器
- [ ] 已创建 `.env.docker.local`
- [ ] 已修改 `MINIO_ENDPOINT` 为实际 IP
- [ ] 已修改所有密码为强密码
- [ ] 端口 3000、9000、9001 未被占用
- [ ] 执行 `python3 scripts/docker_oneclick.py`
- [ ] 访问 http://YOUR_IP:3000 确认正常
- [ ] 测试文件上传功能
- [ ] 设置定期备份任务

### 更新前检查清单

- [ ] 已备份当前数据
- [ ] 已测试新代码（在测试环境）
- [ ] 已通知用户（如需停机）
- [ ] 已准备回滚方案
- [ ] 执行 `python3 scripts/docker_update.py`
- [ ] 检查服务健康状态
- [ ] 测试关键功能
- [ ] 查看日志确认无错误

---

**祝使用愉快！** 🎉

如有问题，请查看详细文档或联系技术支持。
