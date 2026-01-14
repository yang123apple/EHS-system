# 跨平台启动指南

本指南说明如何在 Windows 和 Mac/Linux 上启动 EHS 系统。

## 快速开始

### Windows

```bash
# 使用批处理脚本
dev.bat

# 或者使用 npm
npm run dev
```

### Mac/Linux

```bash
# 使用 Shell 脚本
./dev.sh

# 或者使用 npm（推荐）
npm run dev
```

## MinIO 启动

系统会自动检测 MinIO 是否已运行，如果未运行会自动启动。

### 方式 1: 自动启动（推荐）

运行 `npm run dev` 或对应的启动脚本时，系统会自动检测并在后台启动 MinIO。

### 方式 2: 手动启动 MinIO

#### Windows

```bash
# 使用批处理脚本
start-minio-local.bat

# 或使用 PowerShell
.\start-minio.ps1
```

#### Mac/Linux

```bash
# 使用 Shell 脚本
./start-minio-local.sh
```

### 方式 3: 使用 Docker（最推荐）

```bash
# 跨平台通用命令
docker-compose -f docker-compose.minio.yml up -d
```

## MinIO 可执行文件

系统支持以下 MinIO 启动方式（按优先级）：

1. **项目 bin 目录中的可执行文件**
   - Windows: `bin/minio.exe`
   - Mac/Linux: `bin/minio`
   
2. **系统 PATH 中的 minio 命令**

3. **Docker 容器**

### 下载 MinIO 到 bin 目录

#### Windows

MinIO 应该已经在 `bin/minio.exe`，如果没有：

```powershell
# 使用 PowerShell 脚本
.\install-minio-windows.ps1

# 或手动下载
# 访问: https://dl.min.io/server/minio/release/windows-amd64/minio.exe
# 下载到 bin/ 目录
```

#### Mac/Linux

```bash
# 脚本会自动检测并提示下载
# 或手动下载

# Mac (Intel)
curl -L -o bin/minio https://dl.min.io/server/minio/release/darwin-amd64/minio

# Mac (Apple Silicon / M1/M2)
curl -L -o bin/minio https://dl.min.io/server/minio/release/darwin-arm64/minio

# Linux
curl -L -o bin/minio https://dl.min.io/server/minio/release/linux-amd64/minio

# 设置执行权限
chmod +x bin/minio
```

## 系统要求

### Windows
- Node.js 18+
- 可选: Docker Desktop（推荐）
- 可选: PowerShell 5.1+（用于 .ps1 脚本）

### Mac/Linux
- Node.js 18+
- 可选: Docker（推荐）
- Bash 4.0+

## 常见问题

### Q: 在 Mac 上看到 `minio.exe` 无法运行

A: `.exe` 文件是 Windows 可执行文件，不能在 Mac 上运行。请：
1. 下载 Mac 版本的 MinIO 到 `bin/minio`
2. 或使用 Docker: `docker-compose -f docker-compose.minio.yml up -d`
3. 或使用 Homebrew: `brew install minio/stable/minio`

### Q: MinIO 启动失败

A: 检查：
1. 端口 9000 和 9001 是否被占用
2. 数据目录 `data/minio-data` 是否存在且可写
3. 环境变量 `MINIO_ROOT_USER` 和 `MINIO_ROOT_PASSWORD` 是否正确设置

### Q: 如何查看 MinIO 日志

A: 
- 如果使用 Docker: `docker logs ehs-minio`
- 如果使用本地可执行文件，日志会输出到启动它的终端

## 开发脚本说明

- `npm run dev` - 启动开发服务器（自动启动 MinIO）
- `npm run build` - 构建生产版本
- `npm run start` - 启动生产服务器

所有脚本都支持跨平台运行。
