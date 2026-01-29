# Docker 构建故障排查指南

## 问题 1: 网络连接 Docker Hub 超时

### 症状

```
failed to authorize: DeadlineExceeded: failed to fetch oauth token:
Post "https://auth.docker.io/token": dial tcp 199.16.156.7:443: i/o timeout
```

### 原因

- Docker Hub 连接超时
- 网络防火墙限制
- DNS 解析问题

### 解决方案

#### 方案 1: 配置 Docker 镜像加速器（推荐）

**macOS/Linux:**

编辑 Docker 配置文件：

```bash
# macOS
vim ~/.docker/daemon.json

# Linux
sudo vim /etc/docker/daemon.json
```

添加以下内容：

```json
{
  "registry-mirrors": [
    "https://docker.mirrors.ustc.edu.cn",
    "https://hub-mirror.c.163.com",
    "https://mirror.baidubce.com"
  ]
}
```

重启 Docker：

```bash
# macOS
# Docker Desktop -> Restart

# Linux
sudo systemctl restart docker
```

#### 方案 2: 使用代理

**临时使用代理:**

```bash
# 设置代理环境变量
export HTTP_PROXY=http://your-proxy:port
export HTTPS_PROXY=http://your-proxy:port

# 构建镜像
docker compose -f docker-compose.prod.yml build
```

**永久配置代理:**

编辑 `~/.docker/config.json`:

```json
{
  "proxies": {
    "default": {
      "httpProxy": "http://your-proxy:port",
      "httpsProxy": "http://your-proxy:port"
    }
  }
}
```

#### 方案 3: 使用已有的基础镜像

如果你已经有 `node:20-bookworm-slim` 镜像：

```bash
# 检查是否已有镜像
docker images | grep node

# 如果有，直接构建
docker compose -f docker-compose.prod.yml build --no-cache
```

#### 方案 4: 手动拉取基础镜像

```bash
# 使用镜像加速器拉取
docker pull docker.mirrors.ustc.edu.cn/library/node:20-bookworm-slim

# 重新标记
docker tag docker.mirrors.ustc.edu.cn/library/node:20-bookworm-slim node:20-bookworm-slim

# 构建
docker compose -f docker-compose.prod.yml build
```

---

## 问题 2: Next.js 16 Turbopack 构建错误

### 症状

```
ERROR: This build is using Turbopack, with a `webpack` config and no `turbopack` config.
```

### 原因

Next.js 16 默认使用 Turbopack，但配置文件中有 webpack 配置。

### 解决方案

已在 `next.config.ts` 中添加 `turbopack` 配置：

```typescript
const nextConfig: NextConfig = {
  reactCompiler: true,

  // Turbopack 配置
  turbopack: {
    resolveAlias: {
      'pdfjs-dist/build/pdf.worker.min.mjs': 'pdfjs-dist/build/pdf.worker.min.mjs',
    },
  },

  // Webpack 配置（仅在使用 --webpack 时生效）
  webpack: (config) => {
    // ...
    return config;
  },
};
```

---

## 问题 3: Docker Compose version 警告

### 症状

```
WARN: the attribute `version` is obsolete
```

### 解决方案

编辑 `docker-compose.prod.yml`，删除第一行的 `version: "3.8"`：

```yaml
# 删除这行
# version: "3.8"

services:
  app:
    # ...
```

---

## 完整构建流程

### 1. 配置镜像加速器

```bash
# 编辑 Docker 配置
vim ~/.docker/daemon.json

# 添加镜像加速器
{
  "registry-mirrors": [
    "https://docker.mirrors.ustc.edu.cn"
  ]
}

# 重启 Docker
# macOS: Docker Desktop -> Restart
# Linux: sudo systemctl restart docker
```

### 2. 验证网络连接

```bash
# 测试能否连接 Docker Hub
docker pull hello-world

# 如果成功，说明网络正常
```

### 3. 构建镜像

```bash
# 清理缓存重新构建
docker compose -f docker-compose.prod.yml build --no-cache

# 或者使用普通构建
docker compose -f docker-compose.prod.yml build
```

### 4. 查看构建日志

```bash
# 实时查看构建过程
docker compose -f docker-compose.prod.yml build 2>&1 | tee build.log
```

---

## 常见错误和解决方案

### 错误 1: npm ci 失败

```bash
# 清理 npm 缓存
docker system prune -a
docker compose -f docker-compose.prod.yml build --no-cache
```

### 错误 2: Prisma generate 失败

```bash
# 检查 prisma/schema.prisma 文件
cat prisma/schema.prisma

# 确保 datasource 使用环境变量
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```

### 错误 3: 磁盘空间不足

```bash
# 清理 Docker 资源
docker system prune -a --volumes

# 查看磁盘使用
docker system df
```

---

## 调试技巧

### 1. 分步构建

```bash
# 只构建 builder 阶段
docker build --target builder -t ehs-builder .

# 进入 builder 容器调试
docker run -it ehs-builder sh
```

### 2. 查看构建缓存

```bash
# 查看镜像层
docker history ehs-system:prod

# 查看镜像详情
docker inspect ehs-system:prod
```

### 3. 使用 BuildKit

```bash
# 启用 BuildKit（更好的缓存和并行构建）
export DOCKER_BUILDKIT=1

# 构建
docker compose -f docker-compose.prod.yml build
```

---

## 推荐配置

### Docker Desktop 设置（macOS）

1. 打开 Docker Desktop
2. Settings -> Docker Engine
3. 添加镜像加速器配置
4. 调整资源限制：
   - CPUs: 4+
   - Memory: 4GB+
   - Disk: 20GB+

### 网络优化

```bash
# 设置 DNS
{
  "dns": ["8.8.8.8", "114.114.114.114"],
  "registry-mirrors": [
    "https://docker.mirrors.ustc.edu.cn"
  ]
}
```

---

## 获取帮助

如果以上方案都无法解决问题：

1. 查看完整构建日志：`docker compose -f docker-compose.prod.yml build 2>&1 | tee build.log`
2. 检查 Docker 版本：`docker --version`
3. 检查网络连接：`curl -I https://hub.docker.com`
4. 查看 Docker 状态：`docker info`

---

**最后更新**: 2026-01-28
