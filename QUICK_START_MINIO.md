# MinIO 快速启动指南

## 当前问题

Docker 无法从 Docker Hub 拉取 MinIO 镜像，可能是网络问题。

## 解决方案

### 方案 1: 使用本地 MinIO（推荐，最快）

如果 Docker 拉取镜像有困难，可以直接使用本地安装的 MinIO：

#### Windows

1. **下载 MinIO**
   ```powershell
   # 方法 1: 使用安装脚本
   .\install-minio-windows.ps1
   
   # 方法 2: 手动下载
   # 访问: https://dl.min.io/server/minio/release/windows-amd64/minio.exe
   # 下载后放到项目目录的 bin 文件夹
   ```

2. **启动 MinIO**
   ```cmd
   .\start-minio-local.bat
   ```

#### Linux/Mac

1. **安装 MinIO**
   ```bash
   # Linux
   wget https://dl.min.io/server/minio/release/linux-amd64/minio
   chmod +x minio
   sudo mv minio /usr/local/bin/
   
   # Mac
   brew install minio/stable/minio
   ```

2. **启动 MinIO**
   ```bash
   chmod +x start-minio-local.sh
   ./start-minio-local.sh
   ```

### 方案 2: 配置 Docker 镜像加速器

如果必须使用 Docker，可以配置国内镜像加速器：

#### Windows (Docker Desktop)

1. 打开 Docker Desktop
2. 进入 Settings → Docker Engine
3. 添加以下配置：
   ```json
   {
     "registry-mirrors": [
       "https://docker.mirrors.ustc.edu.cn",
       "https://hub-mirror.c.163.com",
       "https://mirror.baidubce.com"
     ]
   }
   ```
4. 点击 "Apply & Restart"
5. 重新拉取镜像：
   ```bash
   docker-compose -f docker-compose.minio.yml up -d
   ```

#### Linux

```bash
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json <<-'EOF'
{
  "registry-mirrors": [
    "https://docker.mirrors.ustc.edu.cn",
    "https://hub-mirror.c.163.com",
    "https://mirror.baidubce.com"
  ]
}
EOF
sudo systemctl daemon-reload
sudo systemctl restart docker
```

### 方案 3: 使用代理

如果有代理，可以配置 Docker 使用代理：

1. Docker Desktop → Settings → Resources → Proxies
2. 配置代理设置
3. 重启 Docker Desktop

## 验证 MinIO 运行

无论使用哪种方式启动，验证方法相同：

### 1. 检查服务状态

```bash
# 如果使用 Docker
docker ps | grep minio

# 如果使用本地安装
# 检查进程或查看启动脚本的输出
```

### 2. 测试 API 连接

```bash
curl http://localhost:9000/minio/health/live
```

应该返回 `200 OK`。

### 3. 测试 Node.js 连接

```bash
node scripts/test-minio.js
```

### 4. 访问 MinIO Console

打开浏览器访问: http://localhost:9001

- **用户名**: `admin`
- **密码**: `change-me-now`

### 5. 检查应用状态

启动应用后，查看控制台输出：

```bash
npm run dev
```

应该看到：
```
📦 初始化 MinIO 对象存储服务...
✅ MinIO 初始化成功
   • 端点: localhost:9000
   • Buckets: ehs-private, ehs-public
```

## 推荐方案

**建议使用方案 1（本地 MinIO）**，因为：
- ✅ 无需 Docker，启动更快
- ✅ 不依赖网络拉取镜像
- ✅ 配置简单，直接可用
- ✅ 功能完全相同

Docker 修复后，可以随时切换回 Docker 方式。

## 下一步

MinIO 启动成功后：

1. ✅ 验证配置: `node verify-minio-config.js`
2. ✅ 测试连接: `node scripts/test-minio.js`
3. ✅ 启动应用: `npm run dev`
4. ✅ 检查状态: 访问 `http://localhost:3000/api/storage/status`

