# EHS 系统 Docker 部署 - 快速参考卡

## 🚀 30 秒快速部署

```bash
# 1. 配置环境（必须修改 MINIO_ENDPOINT）
cp .env.docker .env.docker.local
vim .env.docker.local  # 修改 YOUR_SERVER_IP_OR_DOMAIN 为实际 IP

# 2. 一键启动
python3 scripts/docker_oneclick.py

# 3. 访问
# 应用: http://YOUR_IP:3000
# MinIO: http://YOUR_IP:9001
```

---

## ⚙️ 必须修改的配置

编辑 `.env.docker.local`：

```bash
# ⚠️ 必须改：替换为服务器实际 IP 或域名
MINIO_ENDPOINT=192.168.1.100  # 本机用 localhost，局域网用 IP

# ⚠️ 必须改：与上面保持一致
MINIO_PRIMARY_ENDPOINT=http://192.168.1.100:9000

# ⚠️ 建议改：修改为强密码
MINIO_SECRET_KEY=your-strong-password
MINIO_ROOT_PASSWORD=your-strong-password
MINIO_PRIMARY_SECRET_KEY=your-strong-password
```

---

## 📋 常用命令

### 启动/停止

```bash
# 启动
python3 scripts/docker_oneclick.py

# 停止
docker compose --env-file .env.docker.local -f docker-compose.prod.yml down

# 重启
docker compose --env-file .env.docker.local -f docker-compose.prod.yml restart
```

### 查看状态

```bash
# 查看容器
docker ps

# 查看日志
docker logs -f ehs-app
docker logs -f ehs-minio

# 查看资源使用
docker stats
```

### 更新应用

```bash
git pull
docker compose --env-file .env.docker.local -f docker-compose.prod.yml build --no-cache
docker compose --env-file .env.docker.local -f docker-compose.prod.yml up -d
```

---

## 🔧 常见问题速查

### 文件上传后无法访问

**原因**: `MINIO_ENDPOINT` 配置错误

**解决**:
```bash
# 1. 停止服务
docker compose --env-file .env.docker.local -f docker-compose.prod.yml down

# 2. 修改 .env.docker.local 中的 MINIO_ENDPOINT 为浏览器可访问的 IP

# 3. 重启
python3 scripts/docker_oneclick.py
```

### 容器启动失败

```bash
# 查看日志
docker logs ehs-app

# 检查端口占用
sudo lsof -i :3000
sudo lsof -i :9000

# 修改端口（在 .env.docker.local 中）
APP_PORT=3001
MINIO_PORT=9002
```

### 数据丢失

**检查数据库文件**:
```bash
ls -la ./data/db/ehs.db  # 应该存在
```

**如果不存在**: 说明 Prisma schema 配置错误，已在新方案中修复。

### 权限问题

```bash
sudo chown -R $USER:$USER ./data ./public/uploads ./ehs-private ./ehs-public
chmod -R 755 ./data ./public/uploads ./ehs-private ./ehs-public
```

---

## 📊 健康检查

```bash
# 检查应用
curl http://localhost:3000/api/health

# 检查 MinIO
docker exec ehs-minio mc ready local

# 查看容器健康状态
docker ps  # 查看 STATUS 列
```

---

## 💾 备份与恢复

### 备份

```bash
# 备份数据库
cp ./data/db/ehs.db ./backups/ehs-$(date +%Y%m%d).db

# 备份 MinIO
tar -czf minio-backup-$(date +%Y%m%d).tar.gz ./data/minio-data
```

### 恢复

```bash
# 1. 停止服务
docker compose --env-file .env.docker.local -f docker-compose.prod.yml down

# 2. 恢复文件
cp ./backups/ehs-20260128.db ./data/db/ehs.db

# 3. 重启
python3 scripts/docker_oneclick.py
```

---

## 🔍 调试技巧

```bash
# 进入容器
docker exec -it ehs-app sh

# 查看环境变量
docker exec ehs-app env | grep MINIO

# 查看数据库迁移状态
docker exec ehs-app npx prisma migrate status

# 查看 MinIO 配置
docker exec ehs-minio mc admin info local
```

---

## 📞 获取帮助

- 详细文档: [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md)
- 查看日志: `docker logs ehs-app`
- 检查配置: `cat .env.docker.local`

---

## ✅ 部署检查清单

- [ ] Docker 已安装 (`docker --version`)
- [ ] 已创建 `.env.docker.local`
- [ ] 已修改 `MINIO_ENDPOINT` 为实际 IP/域名
- [ ] 已修改 `MINIO_PRIMARY_ENDPOINT` 与上面一致
- [ ] 已修改所有密码为强密码
- [ ] 端口 3000、9000、9001 未被占用
- [ ] 执行 `python3 scripts/docker_oneclick.py`
- [ ] 访问 http://YOUR_IP:3000 确认应用正常
- [ ] 测试文件上传功能
- [ ] 设置定期备份任务

---

**提示**: 如果这是你第一次部署，建议阅读完整文档 [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md)
