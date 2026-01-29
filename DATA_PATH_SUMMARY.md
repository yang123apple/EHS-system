# EHS 系统数据路径配置完成总结

## ✅ 已完成的配置

我已经完成了所有数据路径的配置，确保 MinIO 和 Restic 的数据都保存到上层 `/data` 目录，并使用绝对路径引用。

---

## 📁 新的目录结构

```
/Users/yangguang/Desktop/EHS/
├── data/                           # 所有数据统一保存在这里 ✅
│   ├── db/                         # 数据库文件
│   │   └── ehs.db
│   ├── minio-data/                 # MinIO 对象存储数据
│   ├── minio-config/               # MinIO 配置
│   ├── minio-backup/               # MinIO 备份
│   ├── restic-repo/                # Restic 备份仓库
│   ├── restic-cache/               # Restic 缓存
│   ├── restic-logs/                # Restic 日志
│   ├── restic-staging/             # Restic 临时文件
│   ├── restic-pass                 # Restic 密码文件
│   └── backups/                    # 其他备份
│       └── logs/archives/
├── docker-images/                  # Docker 镜像导出目录 ✅
│   └── ehs-system-prod-*.tar.gz
└── EHS-system/                     # 项目代码
    ├── docker-compose.prod.yml     # ✅ 已更新
    ├── .env.docker                 # ✅ 已更新
    ├── .env.docker.example         # ✅ 已更新
    └── scripts/
        ├── restic/common.sh        # ✅ 已更新
        ├── docker_image.py         # ✅ 已更新
        └── init-data-dirs.sh       # ✅ 新增
```

---

## 🔧 关键配置更改

### 1. Docker Compose 配置 ✅

**文件**: `docker-compose.prod.yml`

**更改**:
```yaml
services:
  app:
    volumes:
      # 挂载上层 data 目录
      - ../data:/app/data  # ✅ 改为上层目录
    environment:
      # 新增 Restic 配置
      RESTIC_REPOSITORY: /app/data/restic-repo
      RESTIC_PASSWORD: ${RESTIC_PASSWORD}
      RESTIC_MINIO_ENDPOINT: http://minio:9000  # ✅ 容器内使用服务名
      AWS_ACCESS_KEY_ID: ${MINIO_ACCESS_KEY}
      AWS_SECRET_ACCESS_KEY: ${MINIO_SECRET_KEY}

  minio:
    volumes:
      # MinIO 数据保存到上层目录
      - ../data/minio-data:/data  # ✅ 改为上层目录
      - ../data/minio-config:/root/.minio
```

---

### 2. Restic 脚本配置 ✅

**文件**: `scripts/restic/common.sh`

**更改**:
```bash
# 使用绝对路径，指向上层 data 目录
BASE="/Users/yangguang/Desktop/EHS/data"  # ✅ 绝对路径
PROJECT="/Users/yangguang/Desktop/EHS/EHS-system"

# Restic 仓库和配置保存到上层 data 目录
export RESTIC_REPOSITORY="$BASE/restic-repo"
export RESTIC_PASSWORD_FILE="$BASE/restic-pass"
export RESTIC_CACHE_DIR="$BASE/restic-cache"

# 数据路径配置
MINIO_DATA_DIR="$BASE/minio-data"
LOG_ARCHIVE_DIR="$BASE/backups/logs/archives"
LOG_DIR="$BASE/restic-logs"
```

---

### 3. 环境变量配置 ✅

**文件**: `.env.docker` 和 `.env.docker.example`

**新增配置**:
```bash
# Restic 备份配置
RESTIC_REPOSITORY=/app/data/restic-repo
RESTIC_PASSWORD=CHANGE_ME_TO_STRONG_PASSWORD

# Restic 连接 MinIO（容器内使用服务名）
RESTIC_MINIO_ENDPOINT=http://minio:9000  # ✅ 使用容器服务名
RESTIC_MINIO_BUCKET=restic-backup
```

---

### 4. 镜像导出路径 ✅

**文件**: `scripts/docker_image.py`

**更改**:
```python
export_parser.add_argument(
    "--output-dir",
    type=str,
    default="/Users/yangguang/Desktop/EHS/docker-images",  # ✅ 绝对路径
    help="输出目录"
)
```

---

## 📝 新增文件

### 1. 数据路径配置文档 ✅

**文件**: `DATA_PATH_CONFIG.md`

**内容**:
- 完整的目录结构说明
- 配置说明和路径映射关系
- 使用方法和故障排查
- 最佳实践

---

### 2. 目录初始化脚本 ✅

**文件**: `scripts/init-data-dirs.sh`

**功能**:
- 自动创建所有必要的数据目录
- 生成 Restic 密码文件
- 设置正确的权限
- 显示目录结构

**使用方法**:
```bash
bash scripts/init-data-dirs.sh
```

---

## 🚀 使用流程

### 步骤 1: 初始化数据目录

```bash
# 运行初始化脚本
cd /Users/yangguang/Desktop/EHS/EHS-system
bash scripts/init-data-dirs.sh
```

**输出**:
```
================================================
EHS 系统数据目录初始化
================================================

📁 创建数据目录结构...

✓ 创建目录: /Users/yangguang/Desktop/EHS/data/db
✓ 创建目录: /Users/yangguang/Desktop/EHS/data/minio-data
✓ 创建目录: /Users/yangguang/Desktop/EHS/data/restic-repo
...

📝 创建 Restic 密码文件...
✓ 创建 Restic 密码文件
⚠️  密码已保存到: /Users/yangguang/Desktop/EHS/data/restic-pass
⚠️  请妥善保管此密码！

✅ 初始化完成！
```

---

### 步骤 2: 配置环境变量

```bash
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

---

### 步骤 3: 构建和启动

```bash
# 构建镜像
docker compose -f docker-compose.prod.yml build

# 启动服务
python3 scripts/docker_oneclick.py
```

---

### 步骤 4: 验证配置

```bash
# 检查数据目录
ls -la /Users/yangguang/Desktop/EHS/data/

# 应该看到:
# - db/ehs.db (数据库文件)
# - minio-data/ (MinIO 数据)
# - restic-repo/ (Restic 仓库)

# 检查容器挂载
docker inspect ehs-app | grep -A 10 Mounts
docker inspect ehs-minio | grep -A 10 Mounts
```

---

## 📊 路径映射关系

| 容器内路径 | 宿主机路径 | 用途 |
|-----------|-----------|------|
| `/app/data/db/ehs.db` | `/Users/yangguang/Desktop/EHS/data/db/ehs.db` | 数据库 |
| `/app/data/minio-backup` | `/Users/yangguang/Desktop/EHS/data/minio-backup` | MinIO 备份 |
| `/app/data/restic-repo` | `/Users/yangguang/Desktop/EHS/data/restic-repo` | Restic 仓库 |
| `/data` (MinIO) | `/Users/yangguang/Desktop/EHS/data/minio-data` | MinIO 数据 |

---

## 🔍 Restic 连接 MinIO 配置

### 容器内配置 ✅

```bash
# 容器内使用服务名连接 MinIO
RESTIC_MINIO_ENDPOINT=http://minio:9000

# 这样配置的原因:
# 1. 容器之间通过 Docker 网络通信
# 2. 使用服务名 "minio" 作为主机名
# 3. 不需要暴露到宿主机网络
```

### 本地脚本配置 ✅

```bash
# 本地 Restic 脚本使用绝对路径
BASE="/Users/yangguang/Desktop/EHS/data"
export RESTIC_REPOSITORY="$BASE/restic-repo"

# 如果需要连接 MinIO，使用宿主机地址
# export AWS_ACCESS_KEY_ID="admin"
# export AWS_SECRET_ACCESS_KEY="password"
# restic -r s3:http://localhost:9000/restic-backup ...
```

---

## 💡 关键优势

### 1. 数据集中管理 ✅

- 所有数据保存在 `/Users/yangguang/Desktop/EHS/data`
- 便于备份整个数据目录
- 便于数据迁移

### 2. 使用绝对路径 ✅

- Restic 脚本使用绝对路径
- 避免相对路径错误
- 确保路径引用正确

### 3. 容器内使用服务名 ✅

- Restic 连接 MinIO 使用 `http://minio:9000`
- 利用 Docker 网络 DNS
- 不依赖宿主机网络配置

### 4. 镜像导出到指定位置 ✅

- 镜像保存到 `/Users/yangguang/Desktop/EHS/docker-images`
- 与数据目录分离
- 便于管理和传输

---

## 📝 Git 提交状态

已暂存的文件:
```
修改的文件:
- docker-compose.prod.yml (挂载路径改为上层目录)
- .env.docker.example (新增 Restic 配置)
- scripts/restic/common.sh (使用绝对路径)
- scripts/docker_image.py (镜像导出路径)

新增的文件:
- DATA_PATH_CONFIG.md (数据路径配置文档)
- scripts/init-data-dirs.sh (目录初始化脚本)
```

---

## 🎯 下一步操作

### 1. 初始化数据目录

```bash
bash scripts/init-data-dirs.sh
```

### 2. 配置环境变量

```bash
cp .env.docker.example .env.docker.local
vim .env.docker.local
```

### 3. 构建和部署

```bash
# 如果本地网络正常
docker compose -f docker-compose.prod.yml build
python3 scripts/docker_oneclick.py

# 或者在服务器上构建（推荐）
git add .
git commit -m "feat: 配置数据路径到上层目录，使用绝对路径"
git push origin main

# 在服务器上
git pull
bash scripts/init-data-dirs.sh
cp .env.docker.example .env.docker.local
vim .env.docker.local
docker compose -f docker-compose.prod.yml build
python3 scripts/docker_oneclick.py
```

---

## ✅ 总结

所有配置已完成：

1. ✅ MinIO 数据保存到 `/Users/yangguang/Desktop/EHS/data/minio-data`
2. ✅ Restic 仓库保存到 `/Users/yangguang/Desktop/EHS/data/restic-repo`
3. ✅ 使用绝对路径确保路径正确
4. ✅ Restic 连接 MinIO 使用容器服务名 `http://minio:9000`
5. ✅ 镜像导出到 `/Users/yangguang/Desktop/EHS/docker-images`
6. ✅ 创建了完整的配置文档和初始化脚本

现在可以安全地构建和部署了！

---

**最后更新**: 2026-01-28
