# EHS 系统完整镜像使用和更新指南

## 目录

1. [完整镜像说明](#完整镜像说明)
2. [首次部署](#首次部署)
3. [数据持久化配置（重要！）](#数据持久化配置重要)
4. [更新镜像流程](#更新镜像流程)
5. [数据备份和恢复](#数据备份和恢复)
6. [故障排查](#故障排查)
7. [最佳实践](#最佳实践)

---

## 完整镜像说明

### 什么是完整镜像

EHS 系统完整镜像是一个包含所有必要组件的一体化 Docker 镜像，适合快速部署和演示。

**特点**：
- ✅ 开箱即用，无需额外配置
- ✅ 包含应用代码、数据库、MinIO 服务
- ✅ 使用非冲突端口（3100, 9100, 9101）
- ✅ 内置 Supervisor 进程管理
- ✅ 自动健康检查

**适用场景**：
- 快速演示和测试
- 单机部署
- 开发环境
- 离线环境部署

### 镜像内容

| 组件 | 说明 | 端口 |
|------|------|------|
| Next.js 应用 | EHS 管理系统主应用 | 3100 |
| SQLite 数据库 | 包含初始数据和 admin 用户 | - |
| MinIO 服务器 | 对象存储服务（S3 兼容） | 9100 (API), 9101 (控制台) |
| MinIO Client (mc) | MinIO 命令行工具 | - |
| Restic | 备份工具 | - |
| Supervisor | 进程管理器 | - |

### 默认凭证

**应用登录**：
- 用户名：`admin`
- 密码：`admin`

**MinIO 控制台**：
- 用户名：`admin`
- 密码：`change-me-now`

⚠️ **安全提示**：生产环境请务必修改默认密码！

---

## 首次部署

### 前置要求

- Docker 20.10+ 或 Docker Desktop
- 至少 2GB 可用内存
- 至少 5GB 可用磁盘空间

### 方法 1：使用预构建镜像（推荐）

```bash
# 1. 导入镜像
docker load < ehs-system-full-v1.0.tar.gz

# 2. 创建数据目录（用于持久化）
mkdir -p ~/ehs-data

# 3. 启动容器
docker run -d \
  --name ehs-system \
  -p 3100:3100 \
  -p 9100:9100 \
  -p 9101:9101 \
  -v ~/ehs-data:/app/data \
  ehs-system-full:v1.0

# 4. 查看日志
docker logs -f ehs-system

# 5. 等待健康检查通过
docker ps | grep ehs-system
# 应该显示 (healthy)
```

### 方法 2：从源码构建

```bash
# 1. 克隆代码
git clone <repository-url>
cd EHS-system

# 2. 准备数据库
npx prisma migrate deploy
npx prisma db seed

# 3. 确保核心数据存在
ls -la data/core_data/

# 4. 构建镜像
./build-full-image.sh

# 5. 启动容器
docker run -d \
  --name ehs-system \
  -p 3100:3100 \
  -p 9100:9100 \
  -p 9101:9101 \
  -v ~/ehs-data:/app/data \
  ehs-system-full:v1.0
```

### 访问服务

部署完成后，访问以下地址：

- **EHS 应用**：http://localhost:3100
- **MinIO 控制台**：http://localhost:9101

---

## 数据持久化配置（重要！）

### 为什么需要数据持久化

⚠️ **关键概念**：Docker 容器是临时的，容器删除后内部数据会丢失。

**数据持久化的好处**：
- ✅ 容器删除后数据不丢失
- ✅ 更新镜像时保留用户数据
- ✅ 方便备份和迁移
- ✅ 支持容器重建

### 存算分离架构

```
宿主机（持久化存储）
├── ~/ehs-data/
│   ├── db/ehs.db              ← 数据库文件
│   ├── minio-data/            ← MinIO 对象存储
│   ├── backups/               ← 自动备份
│   └── ...
    ↓ (通过 volume 挂载)
容器内（临时计算）
└── /app/data/                 ← 挂载点
    ├── db/ehs.db              ← 指向宿主机
    ├── minio-data/            ← 指向宿主机
    └── ...
```

### 配置方法

#### 基本配置（推荐）

```bash
# 创建数据目录
mkdir -p ~/ehs-data

# 启动容器时挂载 volume
docker run -d \
  --name ehs-system \
  -p 3100:3100 \
  -p 9100:9100 \
  -p 9101:9101 \
  -v ~/ehs-data:/app/data \
  ehs-system-full:v1.0
```

#### 高级配置（分离挂载）

```bash
# 创建详细的目录结构
mkdir -p ~/ehs-data/{db,minio-data,backups,uploads}

# 分别挂载不同目录
docker run -d \
  --name ehs-system \
  -p 3100:3100 \
  -p 9100:9100 \
  -p 9101:9101 \
  -v ~/ehs-data/db:/app/data/db \
  -v ~/ehs-data/minio-data:/app/data/minio-data \
  -v ~/ehs-data/backups:/app/data/backups \
  -v ~/ehs-data/uploads:/app/public/uploads \
  ehs-system-full:v1.0
```

### 验证数据持久化

```bash
# 1. 检查数据目录
ls -la ~/ehs-data/db/
# 应该看到 ehs.db 文件

# 2. 测试数据持久化
# 在应用中创建一些数据（如新建隐患记录）

# 3. 重启容器
docker restart ehs-system

# 4. 验证数据仍然存在
# 登录应用，检查之前创建的数据是否还在
```

---

## 更新镜像流程

### 核心原则

⚠️ **重要**：更新镜像前必须确保数据已持久化到宿主机！

**更新流程概览**：
1. 备份数据
2. 停止旧容器
3. 更新镜像
4. 启动新容器（挂载原有数据）
5. 验证数据完整性

### 场景 1：更新应用代码（无数据库变更）

**适用情况**：修复 bug、UI 优化、功能增强（不涉及数据库结构变更）

```bash
# 1. 备份数据（保险起见）
cp -r ~/ehs-data ~/ehs-data-backup-$(date +%Y%m%d-%H%M%S)

# 2. 停止并删除旧容器
docker stop ehs-system
docker rm ehs-system

# 3. 导入新镜像
docker load < ehs-system-full-v1.1.tar.gz

# 4. 启动新容器（使用原有数据）
docker run -d \
  --name ehs-system \
  -p 3100:3100 \
  -p 9100:9100 \
  -p 9101:9101 \
  -v ~/ehs-data:/app/data \
  ehs-system-full:v1.1

# 5. 查看启动日志
docker logs -f ehs-system

# 6. 验证数据完整性
# 登录应用，检查数据是否完整
```

**数据安全保证**：
- ✅ 数据在宿主机，容器删除不影响
- ✅ 新容器自动挂载原有数据
- ✅ 应用版本更新，数据保持不变

---

### 场景 2：更新应用代码 + 数据库迁移

**适用情况**：添加新功能需要修改数据库结构（新增表、字段等）

```bash
# 1. 备份数据（重要！）
mkdir -p ~/ehs-backups
cp ~/ehs-data/db/ehs.db ~/ehs-backups/ehs-$(date +%Y%m%d-%H%M%S).db
tar -czf ~/ehs-backups/minio-$(date +%Y%m%d-%H%M%S).tar.gz ~/ehs-data/minio-data

# 2. 记录当前数据统计（用于验证）
docker exec ehs-system sh -c "sqlite3 /app/data/db/ehs.db 'SELECT COUNT(*) FROM User;'"
docker exec ehs-system sh -c "sqlite3 /app/data/db/ehs.db 'SELECT COUNT(*) FROM HazardRecord;'"
# 记下这些数字

# 3. 停止并删除旧容器
docker stop ehs-system
docker rm ehs-system

# 4. 导入新镜像
docker load < ehs-system-full-v1.2.tar.gz

# 5. 启动新容器
docker run -d \
  --name ehs-system \
  -p 3100:3100 \
  -p 9100:9100 \
  -p 9101:9101 \
  -v ~/ehs-data:/app/data \
  ehs-system-full:v1.2

# 6. 查看迁移日志
docker logs ehs-system | grep "prisma migrate"
# 应该看到迁移成功的消息

# 7. 验证数据完整性
docker exec ehs-system sh -c "sqlite3 /app/data/db/ehs.db 'SELECT COUNT(*) FROM User;'"
docker exec ehs-system sh -c "sqlite3 /app/data/db/ehs.db 'SELECT COUNT(*) FROM HazardRecord;'"
# 数量应该与步骤 2 一致

# 8. 功能测试
# - 登录系统
# - 查看现有数据
# - 测试新功能
```

**数据安全保证**：
- ✅ 迁移前已备份
- ✅ Prisma 迁移是事务性的（失败会回滚）
- ✅ 数据在宿主机，可随时恢复

---

### 场景 3：从完整镜像迁移到 docker-compose

**适用情况**：需要更灵活的部署方式，独立管理各个服务

```bash
# 1. 从运行的容器中导出数据
mkdir -p ~/EHS/data/db ~/EHS/data/minio-data
docker cp ehs-system:/app/data/db/ehs.db ~/EHS/data/db/ehs.db
docker cp ehs-system:/app/data/minio-data ~/EHS/data/

# 2. 停止完整镜像容器
docker stop ehs-system
docker rm ehs-system

# 3. 准备 docker-compose 环境
cd ~/EHS/EHS-system
cp .env.docker .env.docker.local
vim .env.docker.local
# 修改 MINIO_ENDPOINT 为实际 IP 或域名

# 4. 使用 docker-compose 启动
docker-compose --env-file .env.docker.local -f docker-compose.prod.yml up -d

# 5. 验证数据迁移成功
docker exec ehs-app sqlite3 /app/data/db/ehs.db "SELECT COUNT(*) FROM User;"

# 6. 访问服务
# 应用：http://localhost:3000
# MinIO：http://localhost:9001
```

**优势**：
- ✅ 数据和应用完全分离
- ✅ 可以独立更新各个服务
- ✅ 更容易扩展和维护
- ✅ 支持多容器编排

---

## 数据备份和恢复

### 自动备份（系统内置）

EHS 系统内置了自动备份功能：

**备份计划**：
- 每日 02:00 - 数据库全量备份
- 每日 02:30 - 文件增量备份
- 每小时 - 数据库增量备份
- 每 15 天 - 日志归档

**查看备份**：
```bash
# 查看备份文件
docker exec ehs-system ls -la /app/data/backups/

# 查看备份日志
docker exec ehs-system cat /app/data/backups/logs/backup.log
```

### 手动备份

#### 快速备份（推荐）

```bash
# 创建备份目录
mkdir -p ~/ehs-backups

# 备份整个数据目录
tar -czf ~/ehs-backups/ehs-full-$(date +%Y%m%d-%H%M%S).tar.gz ~/ehs-data
```

#### 分项备份

```bash
# 1. 备份数据库
cp ~/ehs-data/db/ehs.db ~/ehs-backups/ehs-$(date +%Y%m%d-%H%M%S).db

# 2. 备份 MinIO 数据
tar -czf ~/ehs-backups/minio-$(date +%Y%m%d-%H%M%S).tar.gz ~/ehs-data/minio-data

# 3. 备份上传文件
tar -czf ~/ehs-backups/uploads-$(date +%Y%m%d-%H%M%S).tar.gz ~/ehs-data/uploads

# 4. 验证备份文件
ls -lh ~/ehs-backups/
```

#### 使用备份脚本

```bash
# 使用项目提供的备份脚本
cd ~/EHS/EHS-system
./scripts/backup-data.sh

# 脚本会自动：
# - 创建时间戳备份
# - 压缩数据
# - 验证备份完整性
# - 清理旧备份（保留最近 30 天）
```

### 恢复数据

#### 从完整备份恢复

```bash
# 1. 停止容器
docker stop ehs-system

# 2. 恢复数据
tar -xzf ~/ehs-backups/ehs-full-20260130-120000.tar.gz -C ~/

# 3. 重启容器
docker start ehs-system

# 4. 验证
docker logs ehs-system
```

#### 从分项备份恢复

```bash
# 1. 停止容器
docker stop ehs-system

# 2. 恢复数据库
cp ~/ehs-backups/ehs-20260130-120000.db ~/ehs-data/db/ehs.db

# 3. 恢复 MinIO 数据
rm -rf ~/ehs-data/minio-data
tar -xzf ~/ehs-backups/minio-20260130-120000.tar.gz -C ~/ehs-data/

# 4. 恢复上传文件
rm -rf ~/ehs-data/uploads
tar -xzf ~/ehs-backups/uploads-20260130-120000.tar.gz -C ~/ehs-data/

# 5. 重启容器
docker start ehs-system

# 6. 验证数据
docker exec ehs-system sqlite3 /app/data/db/ehs.db "SELECT COUNT(*) FROM User;"
```

---

## 故障排查

### 问题 1：容器无法启动

**症状**：
```bash
docker ps | grep ehs-system
# 看不到容器
```

**排查步骤**：

```bash
# 1. 查看容器日志
docker logs ehs-system

# 2. 检查端口占用
lsof -i :3100
lsof -i :9100
lsof -i :9101

# 3. 检查数据目录权限
ls -la ~/ehs-data/

# 4. 检查磁盘空间
df -h
```

**常见原因和解决方法**：

| 原因 | 解决方法 |
|------|----------|
| 端口被占用 | 停止占用端口的进程，或修改映射端口 |
| 数据目录权限问题 | `chmod -R 755 ~/ehs-data` |
| 磁盘空间不足 | 清理磁盘空间或扩容 |
| 数据库文件损坏 | 从备份恢复 |

---

### 问题 2：登录失败（admin/admin 无法登录）

**症状**：使用 admin/admin 登录失败

**排查步骤**：

```bash
# 1. 检查数据库中是否有 admin 用户
docker exec ehs-system sh -c "sqlite3 /app/data/db/ehs.db \"SELECT id, username, isActive FROM User WHERE username='admin';\""

# 2. 如果没有 admin 用户，手动创建
docker exec ehs-system sh -c "cd /app && cat > create-admin.js <<'EOF'
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    let dept = await prisma.department.findFirst();
    if (!dept) {
      dept = await prisma.department.create({
        data: {
          id: 'dept_default',
          name: 'EHS部门',
          level: 1,
          managerId: '88888888'
        }
      });
    }

    const hashedPassword = await bcrypt.hash('admin', 10);

    const admin = await prisma.user.create({
      data: {
        id: '88888888',
        username: 'admin',
        name: '超级管理员',
        password: hashedPassword,
        role: 'admin',
        departmentId: dept.id,
        permissions: JSON.stringify({ all: ['all'] }),
        isActive: true,
      }
    });

    console.log('✅ Admin 用户创建成功');
  } catch (error) {
    console.error('❌ 创建失败:', error.message);
  } finally {
    await prisma.\\\$disconnect();
  }
}

createAdmin();
EOF"

# 3. 运行脚本
docker exec ehs-system sh -c "cd /app && DATABASE_URL='file:/app/data/db/ehs.db' node create-admin.js"

# 4. 验证
docker exec ehs-system sh -c "sqlite3 /app/data/db/ehs.db \"SELECT username FROM User WHERE username='admin';\""
```

---

### 问题 3：更新后数据丢失

**症状**：更新镜像后，之前的数据不见了

**原因**：没有使用 volume 挂载，数据在容器内

**解决方法**：

```bash
# 1. 立即停止容器（不要删除！）
docker stop ehs-system

# 2. 从容器中复制数据
docker cp ehs-system:/app/data/db/ehs.db ~/ehs-data/db/ehs.db
docker cp ehs-system:/app/data/minio-data ~/ehs-data/

# 3. 删除旧容器
docker rm ehs-system

# 4. 使用 volume 重新启动
docker run -d \
  --name ehs-system \
  -p 3100:3100 \
  -p 9100:9100 \
  -p 9101:9101 \
  -v ~/ehs-data:/app/data \
  ehs-system-full:v1.0
```

---

### 问题 4：MinIO 无法访问

**症状**：文件上传失败，或无法访问 MinIO 控制台

**排查步骤**：

```bash
# 1. 检查 MinIO 进程
docker exec ehs-system ps aux | grep minio

# 2. 检查 MinIO 日志
docker exec ehs-system tail -f /var/log/supervisor/minio.log

# 3. 重启 MinIO 服务
docker exec ehs-system supervisorctl restart minio

# 4. 检查 MinIO 健康状态
curl http://localhost:9100/minio/health/live
```

---

## 最佳实践

### 1. 存算分离原则

**始终使用 volume 挂载**：

```bash
# ✅ 正确：数据持久化
docker run -d \
  -v ~/ehs-data:/app/data \
  ehs-system-full:v1.0

# ❌ 错误：数据在容器内
docker run -d \
  ehs-system-full:v1.0
```

### 2. 更新前检查清单

每次更新镜像前，执行以下检查：

```bash
# ✅ 1. 确认数据位置
ls -la ~/ehs-data/db/ehs.db

# ✅ 2. 备份数据
tar -czf ~/ehs-backups/ehs-$(date +%Y%m%d-%H%M%S).tar.gz ~/ehs-data

# ✅ 3. 记录数据统计
docker exec ehs-system sh -c "sqlite3 /app/data/db/ehs.db 'SELECT COUNT(*) FROM User;'"
docker exec ehs-system sh -c "sqlite3 /app/data/db/ehs.db 'SELECT COUNT(*) FROM HazardRecord;'"

# ✅ 4. 检查磁盘空间
df -h

# ✅ 5. 执行更新
# ... 更新步骤 ...

# ✅ 6. 验证数据完整性
# 数量应该与更新前一致

# ✅ 7. 功能测试
# - 登录系统
# - 查看数据
# - 测试核心功能
```

### 3. 定期维护

**每周任务**：
```bash
# 检查容器状态
docker ps | grep ehs-system

# 查看日志（检查异常）
docker logs --tail 100 ehs-system | grep -i error

# 检查磁盘使用
du -sh ~/ehs-data/*
```

**每月任务**：
```bash
# 手动备份
tar -czf ~/ehs-backups/monthly-$(date +%Y%m).tar.gz ~/ehs-data

# 清理旧日志
docker exec ehs-system find /app/data/backups/logs -name "*.log" -mtime +30 -delete

# 检查数据库完整性
docker exec ehs-system sqlite3 /app/data/db/ehs.db "PRAGMA integrity_check;"
```

### 4. 安全建议

**修改默认密码**：
```bash
# 应用 admin 密码
# 登录后在"个人设置"中修改

# MinIO 密码
# 在启动容器时通过环境变量修改
docker run -d \
  -e MINIO_ROOT_PASSWORD=your-strong-password \
  -v ~/ehs-data:/app/data \
  ehs-system-full:v1.0
```

**限制网络访问**：
```bash
# 仅允许本地访问
docker run -d \
  -p 127.0.0.1:3100:3100 \
  -p 127.0.0.1:9100:9100 \
  -p 127.0.0.1:9101:9101 \
  -v ~/ehs-data:/app/data \
  ehs-system-full:v1.0
```

### 5. 监控和告警

**健康检查**：
```bash
# 检查容器健康状态
docker inspect ehs-system | grep -A 10 Health

# 访问健康检查端点
curl http://localhost:3100/api/health
```

**资源监控**：
```bash
# 查看容器资源使用
docker stats ehs-system

# 设置资源限制
docker run -d \
  --memory="2g" \
  --cpus="2" \
  -v ~/ehs-data:/app/data \
  ehs-system-full:v1.0
```

---

## 附录

### 常用命令速查

```bash
# 启动容器
docker start ehs-system

# 停止容器
docker stop ehs-system

# 重启容器
docker restart ehs-system

# 查看日志
docker logs -f ehs-system

# 进入容器
docker exec -it ehs-system sh

# 查看容器状态
docker ps | grep ehs-system

# 查看资源使用
docker stats ehs-system

# 备份数据
tar -czf ~/ehs-backups/backup-$(date +%Y%m%d).tar.gz ~/ehs-data

# 恢复数据
tar -xzf ~/ehs-backups/backup-20260130.tar.gz -C ~/
```

### 目录结构

```
~/ehs-data/                    # 数据根目录
├── db/                        # 数据库
│   ├── ehs.db                 # 主数据库文件
│   ├── ehs.db-wal             # WAL 日志
│   └── ehs.db-shm             # 共享内存
├── minio-data/                # MinIO 对象存储
│   ├── ehs-private/           # 私有存储桶
│   └── ehs-public/            # 公共存储桶
├── backups/                   # 自动备份
│   ├── full/                  # 全量备份
│   ├── incremental/           # 增量备份
│   └── logs/                  # 备份日志
├── restic-repo/               # Restic 备份仓库
└── uploads/                   # 上传文件
```

### 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `PORT` | 应用端口 | 3100 |
| `DATABASE_URL` | 数据库路径 | file:/app/data/db/ehs.db |
| `MINIO_ROOT_USER` | MinIO 用户名 | admin |
| `MINIO_ROOT_PASSWORD` | MinIO 密码 | change-me-now |

---

## 获取帮助

如果遇到问题：

1. 查看本文档的[故障排查](#故障排查)部分
2. 检查容器日志：`docker logs ehs-system`
3. 查看应用日志：`docker exec ehs-system tail -f /var/log/supervisor/nextjs.log`
4. 查看 GitHub Issues
5. 联系技术支持

---

**文档版本**：v1.0
**最后更新**：2026-01-30
**适用镜像**：ehs-system-full:v1.0+
