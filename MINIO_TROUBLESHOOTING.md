# MinIO 故障排查指南

## Docker 镜像拉取失败

### 问题描述

```
unable to get image 'minio/minio:latest': request returned 500 Internal Server Error
```

### 解决方案

#### 方案 1: 使用特定版本标签（推荐）

已更新 `docker-compose.minio.yml` 使用特定版本而不是 `latest`：

```yaml
image: minio/minio:RELEASE.2024-12-20T18-18-20Z
```

如果仍然失败，可以尝试其他稳定版本：

```yaml
image: minio/minio:RELEASE.2024-11-20T22-40-07Z
```

#### 方案 2: 检查 Docker Desktop

1. **确保 Docker Desktop 正在运行**
   - Windows: 检查系统托盘中的 Docker 图标
   - 运行: `docker ps` 确认 Docker 可用

2. **重启 Docker Desktop**
   - 完全退出 Docker Desktop
   - 重新启动

3. **检查 Docker API 版本**
   ```bash
   docker version
   ```
   确保 Client 和 Server 版本兼容

#### 方案 3: 手动拉取镜像

```bash
# 拉取 MinIO 镜像
docker pull minio/minio:RELEASE.2024-12-20T18-18-20Z

# 然后启动服务
docker-compose -f docker-compose.minio.yml up -d
```

#### 方案 4: 使用国内镜像源（如果网络问题）

修改 Docker 配置使用国内镜像源，或使用代理。

#### 方案 5: 本地安装 MinIO（不推荐，但可用）

如果 Docker 无法使用，可以本地安装 MinIO：

**Windows:**
1. 下载 MinIO: https://dl.min.io/server/minio/release/windows-amd64/minio.exe
2. 创建启动脚本 `start-minio.bat`:
```batch
@echo off
set MINIO_ROOT_USER=admin
set MINIO_ROOT_PASSWORD=change-me-now
minio.exe server C:\data\minio --console-address ":9001"
```

**Linux/Mac:**
```bash
# 下载
wget https://dl.min.io/server/minio/release/linux-amd64/minio
chmod +x minio

# 启动
export MINIO_ROOT_USER=admin
export MINIO_ROOT_PASSWORD=change-me-now
./minio server ./data/minio --console-address ":9001"
```

## 常见问题

### Q: Docker Desktop 无法启动

**解决**:
1. 检查系统要求（Windows 需要 WSL2）
2. 更新 Docker Desktop 到最新版本
3. 检查防火墙设置

### Q: 端口被占用

**检查端口占用**:
```bash
# Windows
netstat -ano | findstr :9000
netstat -ano | findstr :9001

# Linux/Mac
lsof -i :9000
lsof -i :9001
```

**解决**: 修改 `docker-compose.minio.yml` 中的端口映射

### Q: 权限问题

**Windows**: 确保以管理员身份运行 Docker Desktop

**Linux**: 确保用户有 Docker 权限
```bash
sudo usermod -aG docker $USER
```

### Q: 数据目录不存在

**解决**: 创建数据目录
```bash
# Windows (PowerShell)
New-Item -ItemType Directory -Path .\data\minio-data -Force
New-Item -ItemType Directory -Path .\data\minio-config -Force

# Linux/Mac
mkdir -p ./data/minio-data
mkdir -p ./data/minio-config
```

## 验证 MinIO 运行状态

### 1. 检查容器状态

```bash
docker ps | grep minio
```

应该看到 `ehs-minio` 容器正在运行。

### 2. 检查健康状态

```bash
curl http://localhost:9000/minio/health/live
```

应该返回 `200 OK`。

### 3. 访问 MinIO Console

打开浏览器访问: http://localhost:9001

- 用户名: `admin`
- 密码: `change-me-now`

### 4. 测试 API 连接

```bash
node scripts/test-minio.js
```

## 下一步

如果 MinIO 成功启动：

1. ✅ 验证配置: `node verify-minio-config.js`
2. ✅ 测试连接: `node scripts/test-minio.js`
3. ✅ 启动应用: `npm run dev`
4. ✅ 检查状态: 访问 `http://localhost:3000/api/storage/status`

