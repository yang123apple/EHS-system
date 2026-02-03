# EHS 系统 Docker 部署 + Restic 自动备份指南

## 📋 功能概览

本指南说明如何在 Docker 环境中部署 EHS 系统，并自动启用 Restic 备份功能。

### 自动备份包含：
- ✅ **数据库备份**：每小时自动备份一次
- ✅ **MinIO 数据备份**：可手动或定时触发
- ✅ **增量备份**：使用 Restic 去重技术，节省存储空间
- ✅ **容器启动自动初始化**：首次启动自动创建 Restic 仓库

---

## 🚀 快速开始

### 1. 配置环境变量

```bash
# 复制环境变量模板
cp .env.docker.example .env.docker.local

# 编辑配置文件，修改关键配置
nano .env.docker.local
```

**关键配置项**：

```bash
# 启用 Restic 自动备份
ENABLE_RESTIC_BACKUP=true

# Restic 密码（⚠️ 请修改为强密码）
RESTIC_PASSWORD=your-strong-password-here

# MinIO 访问凭证（⚠️ 请修改为强密码）
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=your-minio-password
```

### 2. 构建并启动容器

```bash
# 构建 Docker 镜像
docker-compose -f docker-compose.prod.yml build

# 启动服务
docker-compose -f docker-compose.prod.yml up -d
```

### 3. 验证备份功能

```bash
# 查看容器日志，确认备份调度已启动
docker logs ehs-app | grep -i "restic\|backup"

# 应该看到类似输出：
# ✅ Restic repository initialized
# 📋 Starting Restic backup scheduler in background...
# ✅ Restic backup scheduler started
```

---

## 📂 数据目录结构

Docker 容器会将所有数据持久化到宿主机的 `../data` 目录：

```
EHS/
├── data/
│   ├── db/                      # 数据库文件
│   │   └── ehs.db
│   ├── minio-data/              # MinIO 对象存储数据
│   ├── restic-repo/             # Restic 备份仓库
│   ├── restic-logs/             # Restic 备份日志
│   ├── restic-cache/            # Restic 缓存
│   └── restic-staging/          # Restic 临时文件
└── EHS-system/                  # 项目代码
```

---

## 🛠️ 手动操作

### 手动运行数据库备份

```bash
# 进入容器
docker exec -it ehs-app bash

# 运行数据库备份
/app/scripts/restic/backup-db.sh manual
```

### 查看备份快照列表

```bash
# 进入容器
docker exec -it ehs-app bash

# 设置环境变量
export RESTIC_REPOSITORY=/app/data/restic-repo
export RESTIC_PASSWORD_FILE=/app/data/restic-pass

# 查看所有快照
restic snapshots

# 查看仓库统计信息
restic stats
```

### 恢复备份

```bash
# 查看最新快照 ID
restic snapshots

# 恢复到指定目录
restic restore <snapshot-id> --target /app/data/restore/

# 恢复特定文件
restic restore latest --target /tmp/restore --include /path/to/file
```

### 停止自动备份

```bash
# 方式 1：修改环境变量后重启
# 编辑 .env.docker.local
ENABLE_RESTIC_BACKUP=false

# 重启容器
docker-compose -f docker-compose.prod.yml restart app

# 方式 2：临时停止备份进程
docker exec -it ehs-app pkill -f restic-scheduler
```

---

## 📊 备份日志查看

### 查看备份调度日志

```bash
# 宿主机查看
tail -f ../data/restic-logs/docker-scheduler.log

# 或者进入容器查看
docker exec -it ehs-app tail -f /app/data/restic-logs/docker-scheduler.log
```

### 查看备份摘要

```bash
# 宿主机
cat ../data/restic-logs/backup-summary.txt

# 容器内
docker exec -it ehs-app cat /app/data/restic-logs/backup-summary.txt
```

---

## 🔧 故障排查

### 备份未启动

```bash
# 1. 检查环境变量
docker exec -it ehs-app printenv | grep RESTIC

# 2. 查看容器启动日志
docker logs ehs-app

# 3. 检查 restic 是否已安装
docker exec -it ehs-app which restic
```

### 权限问题

```bash
# 检查数据目录权限
ls -la ../data/

# 修复权限（如果需要）
sudo chown -R $(id -u):$(id -g) ../data/
```

### 磁盘空间不足

```bash
# 查看磁盘使用情况
df -h

# 查看 Restic 仓库大小
du -sh ../data/restic-repo/

# 清理旧快照（保留最近 30 天）
docker exec -it ehs-app bash -c "
  export RESTIC_REPOSITORY=/app/data/restic-repo
  export RESTIC_PASSWORD_FILE=/app/data/restic-pass
  restic forget --keep-daily 30 --prune
"
```

---

## 🔐 安全建议

1. **修改默认密码**
   - `RESTIC_PASSWORD` - Restic 备份密码
   - `MINIO_ROOT_PASSWORD` - MinIO 访问密码

2. **限制访问权限**
   ```bash
   chmod 600 .env.docker.local
   chmod 600 ../data/restic-pass
   ```

3. **定期验证备份**
   ```bash
   # 每月运行一次验证
   docker exec -it ehs-app bash /app/scripts/restic/verify.sh
   ```

4. **异地备份**
   - 建议将 `../data/restic-repo/` 定期同步到远程存储
   - 可使用 `rsync`、`rclone` 或云存储服务

---

## 📈 备份策略

### 当前策略

| 备份类型 | 频率 | 保留时间 | 说明 |
|---------|------|---------|------|
| 数据库增量 | 每小时 | 7天 | 自动运行 |
| 数据库全量 | 每日凌晨2点 | 30天 | LaunchAgent（宿主机）或手动 |
| MinIO 数据 | 手动/定时 | 30天 | 需要手动触发或配置 cron |

### 自定义备份计划

修改 [scripts/docker-entrypoint.sh](scripts/docker-entrypoint.sh) 中的调度逻辑：

```bash
# 当前：每小时备份一次
sleep 3600  # 1小时

# 改为：每6小时备份一次
sleep 21600  # 6小时
```

---

## 📞 技术支持

如遇问题，请查看：
- 📖 [完整部署文档](./DOCKER_DEPLOYMENT.md)
- 🐛 [Issue 跟踪](https://github.com/your-repo/issues)
- 📋 [备份日志](#备份日志查看)

---

**最后更新时间**：2026-02-02
