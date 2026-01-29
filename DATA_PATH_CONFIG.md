# EHS 系统数据路径配置说明

## 📁 目录结构

### 生产环境（Docker）

```
/Users/yangguang/Desktop/EHS/
├── data/                           # 所有数据统一保存在这里
│   ├── db/                         # 数据库文件
│   │   └── ehs.db                  # SQLite 数据库
│   ├── minio-data/                 # MinIO 对象存储数据
│   ├── minio-config/               # MinIO 配置
│   ├── minio-backup/               # MinIO 备份
│   ├── restic-repo/                # Restic 备份仓库
│   ├── restic-cache/               # Restic 缓存
│   ├── restic-logs/                # Restic 日志
│   ├── restic-staging/             # Restic 临时文件
│   └── backups/                    # 其他备份文件
│       └── logs/
│           └── archives/           # 日志归档
├── docker-images/                  # Docker 镜像导出目录
│   └── ehs-system-prod-*.tar.gz    # 导出的镜像文件
└── EHS-system/                     # 项目代码
    ├── docker-compose.prod.yml     # Docker Compose 配置
    ├── .env.docker.local           # 环境配置
    └── ...
```

---

## 🔧 配置说明

### 1. Docker Compose 挂载配置

**文件**: `docker-compose.prod.yml`

```yaml
services:
  app:
    volumes:
      # 挂载上层 data 目录到容器
      - ../data:/app/data
      - ./public/uploads:/app/public/uploads
      - ./ehs-private:/app/ehs-private
      - ./ehs-public:/app/ehs-public

  minio:
    volumes:
      # MinIO 数据保存到上层 data 目录
      - ../data/minio-data:/data
      - ../data/minio-config:/root/.minio
```

**说明**:
- 使用 `../data` 相对路径，指向上层目录
- 容器内路径为 `/app/data`
- 所有数据持久化到宿主机的 `/Users/yangguang/Desktop/EHS/data`

---

### 2. 环境变量配置

**文件**: `.env.docker.local`

```bash
# 数据库路径（容器内）
DATABASE_URL=file:/app/data/db/ehs.db

# MinIO 备份路径（容器内）
MINIO_BACKUP_TARGET=/app/data/minio-backup

# Restic 配置（容器内）
RESTIC_REPOSITORY=/app/data/restic-repo
RESTIC_PASSWORD=your-strong-password

# Restic 连接 MinIO（容器内使用服务名）
RESTIC_MINIO_ENDPOINT=http://minio:9000
RESTIC_MINIO_BUCKET=restic-backup
```

**说明**:
- 容器内路径统一使用 `/app/data`
- Restic 连接 MinIO 使用容器服务名 `minio`
- 所有路径都会映射到宿主机的 `/Users/yangguang/Desktop/EHS/data`

---

### 3. Restic 脚本配置

**文件**: `scripts/restic/common.sh`

```bash
# 使用绝对路径，指向上层 data 目录
BASE="/Users/yangguang/Desktop/EHS/data"
PROJECT="/Users/yangguang/Desktop/EHS/EHS-system"

# Restic 仓库和配置保存到上层 data 目录
export RESTIC_REPOSITORY="$BASE/restic-repo"
export RESTIC_PASSWORD_FILE="$BASE/restic-pass"
export RESTIC_CACHE_DIR="$BASE/restic-cache"

# 数据路径配置
STAGING_DB_DIR="$BASE/restic-staging/db"
DB_PATH="$PROJECT/prisma/dev.db"
MINIO_DATA_DIR="$BASE/minio-data"
LOG_ARCHIVE_DIR="$BASE/backups/logs/archives"
LOG_DIR="$BASE/restic-logs"
```

**说明**:
- 使用绝对路径确保路径正确
- 所有 Restic 相关文件保存到 `/Users/yangguang/Desktop/EHS/data`
- 日志和备份统一管理

---

### 4. Docker 镜像导出路径

**文件**: `scripts/docker_image.py`

```python
export_parser.add_argument(
    "--output-dir",
    type=str,
    default="/Users/yangguang/Desktop/EHS/docker-images",
    help="输出目录"
)
```

**说明**:
- 镜像默认导出到 `/Users/yangguang/Desktop/EHS/docker-images`
- 文件名格式: `ehs-system-prod-YYYYMMDD-HHMMSS.tar.gz`

---

## 🚀 使用方法

### 初始化目录结构

```bash
# 创建所有必要的目录
mkdir -p /Users/yangguang/Desktop/EHS/data/{db,minio-data,minio-config,minio-backup,restic-repo,restic-cache,restic-logs,restic-staging/db,backups/logs/archives}
mkdir -p /Users/yangguang/Desktop/EHS/docker-images

# 创建 Restic 密码文件
echo "your-strong-password" > /Users/yangguang/Desktop/EHS/data/restic-pass
chmod 600 /Users/yangguang/Desktop/EHS/data/restic-pass
```

---

### 部署流程

#### 1. 配置环境变量

```bash
cd /Users/yangguang/Desktop/EHS/EHS-system

# 复制配置模板
cp .env.docker.example .env.docker.local

# 编辑配置
vim .env.docker.local
```

**必须修改的配置**:
```bash
# MinIO 端点（改为实际 IP）
MINIO_ENDPOINT=192.168.1.100

# MinIO 主端点
MINIO_PRIMARY_ENDPOINT=http://192.168.1.100:9000

# 所有密码
MINIO_SECRET_KEY=your-strong-password
MINIO_ROOT_PASSWORD=your-strong-password
RESTIC_PASSWORD=your-strong-password
```

#### 2. 构建和启动

```bash
# 构建镜像
docker compose -f docker-compose.prod.yml build

# 启动服务
python3 scripts/docker_oneclick.py
```

#### 3. 验证数据路径

```bash
# 检查数据目录
ls -la /Users/yangguang/Desktop/EHS/data/

# 应该看到:
# - db/ehs.db (数据库文件)
# - minio-data/ (MinIO 数据)
# - restic-repo/ (Restic 仓库)
```

---

### 导出镜像

```bash
# 导出镜像到指定目录
python3 scripts/docker_image.py export --image ehs-system:prod

# 镜像保存在
ls -lh /Users/yangguang/Desktop/EHS/docker-images/
```

---

### 备份数据

```bash
# 使用 Docker 备份脚本
python3 scripts/docker_backup.py

# 备份保存在
ls -lh ./backups/backup-YYYYMMDD-HHMMSS/
```

---

### 使用 Restic 备份

```bash
# 初始化 Restic 仓库（首次使用）
cd /Users/yangguang/Desktop/EHS/EHS-system
bash scripts/restic/backup-db.sh

# 备份数据库
bash scripts/restic/backup-db.sh

# 查看快照
restic -r /Users/yangguang/Desktop/EHS/data/restic-repo snapshots

# 验证备份
bash scripts/restic/verify.sh
```

---

## 📊 路径映射关系

### 容器内 → 宿主机

| 容器内路径 | 宿主机路径 | 用途 |
|-----------|-----------|------|
| `/app/data/db/ehs.db` | `/Users/yangguang/Desktop/EHS/data/db/ehs.db` | 数据库 |
| `/app/data/minio-backup` | `/Users/yangguang/Desktop/EHS/data/minio-backup` | MinIO 备份 |
| `/app/data/restic-repo` | `/Users/yangguang/Desktop/EHS/data/restic-repo` | Restic 仓库 |
| `/data` (MinIO) | `/Users/yangguang/Desktop/EHS/data/minio-data` | MinIO 数据 |

---

## 🔍 故障排查

### 问题 1: 数据库文件找不到

**检查**:
```bash
# 检查挂载是否正确
docker inspect ehs-app | grep -A 10 Mounts

# 检查文件是否存在
ls -la /Users/yangguang/Desktop/EHS/data/db/
```

**解决**:
```bash
# 确保目录存在
mkdir -p /Users/yangguang/Desktop/EHS/data/db

# 重启容器
docker restart ehs-app
```

---

### 问题 2: MinIO 数据丢失

**检查**:
```bash
# 检查 MinIO 挂载
docker inspect ehs-minio | grep -A 10 Mounts

# 检查数据目录
ls -la /Users/yangguang/Desktop/EHS/data/minio-data/
```

**解决**:
```bash
# 确保目录存在
mkdir -p /Users/yangguang/Desktop/EHS/data/minio-data

# 重启 MinIO
docker restart ehs-minio
```

---

### 问题 3: Restic 无法连接 MinIO

**检查**:
```bash
# 检查环境变量
docker exec ehs-app env | grep RESTIC

# 应该看到:
# RESTIC_MINIO_ENDPOINT=http://minio:9000
```

**解决**:
```bash
# 确保 .env.docker.local 中配置正确
vim .env.docker.local

# 重启容器
docker compose --env-file .env.docker.local -f docker-compose.prod.yml restart
```

---

## 💡 最佳实践

### 1. 定期备份

```bash
# 设置 cron 任务
crontab -e

# 每天凌晨 2 点备份
0 2 * * * cd /Users/yangguang/Desktop/EHS/EHS-system && python3 scripts/docker_backup.py >> /Users/yangguang/Desktop/EHS/data/backup.log 2>&1
```

### 2. 监控磁盘空间

```bash
# 检查 data 目录大小
du -sh /Users/yangguang/Desktop/EHS/data/*

# 清理旧备份（保留最近 30 天）
find /Users/yangguang/Desktop/EHS/data/backups -type d -mtime +30 -exec rm -rf {} +
```

### 3. 数据迁移

```bash
# 备份整个 data 目录
tar -czf ehs-data-backup.tar.gz /Users/yangguang/Desktop/EHS/data

# 传输到新服务器
scp ehs-data-backup.tar.gz user@new-server:/path/to/

# 在新服务器上解压
tar -xzf ehs-data-backup.tar.gz -C /
```

---

## 📝 总结

### 关键配置

1. **数据统一保存**: 所有数据保存在 `/Users/yangguang/Desktop/EHS/data`
2. **使用绝对路径**: Restic 脚本使用绝对路径确保正确
3. **容器内使用服务名**: Restic 连接 MinIO 使用 `http://minio:9000`
4. **镜像导出路径**: 默认保存到 `/Users/yangguang/Desktop/EHS/docker-images`

### 优点

- ✅ 数据集中管理，便于备份
- ✅ 使用绝对路径，避免路径错误
- ✅ 容器重启数据不丢失
- ✅ 便于数据迁移和恢复

---

**最后更新**: 2026-01-28
