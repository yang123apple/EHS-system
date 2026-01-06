# MinIO 配置指南

## 配置文件位置

MinIO 配置存储在 `.env.local` 文件中（已添加到 .gitignore，不会被提交到版本控制）。

## 配置说明

### 基本配置

```env
# MinIO 服务器端点
MINIO_ENDPOINT=localhost          # MinIO 服务器地址
MINIO_PORT=9000                   # MinIO API 端口
MINIO_USE_SSL=false               # 是否使用 SSL（生产环境建议 true）

# MinIO 访问凭证
MINIO_ACCESS_KEY=admin            # 访问密钥（用户名）
MINIO_SECRET_KEY=change-me-now    # 密钥（密码）
```

### 与 Docker Compose 的对应关系

`.env.local` 中的配置需要与 `docker-compose.minio.yml` 中的配置保持一致：

| .env.local | docker-compose.minio.yml | 说明 |
|------------|-------------------------|------|
| `MINIO_ACCESS_KEY` | `MINIO_ROOT_USER` | 访问密钥（用户名） |
| `MINIO_SECRET_KEY` | `MINIO_ROOT_PASSWORD` | 密钥（密码） |
| `MINIO_ENDPOINT` | - | 服务器地址（通常是 localhost） |
| `MINIO_PORT` | `ports: "9000:9000"` | API 端口 |

## 配置步骤

### 1. 创建配置文件

如果 `.env.local` 文件不存在，系统会自动使用默认值：
- `MINIO_ENDPOINT=localhost`
- `MINIO_PORT=9000`
- `MINIO_ACCESS_KEY=admin`
- `MINIO_SECRET_KEY=change-me-now`

### 2. 修改配置（可选）

如果需要修改默认配置：

```env
# 修改访问凭证（生产环境必须修改）
MINIO_ACCESS_KEY=your-access-key
MINIO_SECRET_KEY=your-secret-key

# 如果 MinIO 运行在远程服务器
MINIO_ENDPOINT=minio.example.com
MINIO_PORT=9000
MINIO_USE_SSL=true
```

### 3. 同步 Docker Compose 配置

如果修改了 `.env.local`，也需要更新 `docker-compose.minio.yml`：

```yaml
environment:
  MINIO_ROOT_USER: ${MINIO_ROOT_USER:-admin}
  MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-change-me-now}
```

或者直接在 `docker-compose.minio.yml` 中设置环境变量：

```yaml
environment:
  MINIO_ROOT_USER: your-access-key
  MINIO_ROOT_PASSWORD: your-secret-key
```

### 4. 重启服务

```bash
# 重启 MinIO 容器
docker-compose -f docker-compose.minio.yml down
docker-compose -f docker-compose.minio.yml up -d

# 重启 Next.js 应用
npm run dev
```

## 验证配置

### 方法 1: 查看启动日志

启动应用后，查看控制台输出：

```
📦 初始化 MinIO 对象存储服务...
✅ MinIO 初始化成功
   • 端点: localhost:9000
   • Buckets: ehs-private, ehs-public
```

### 方法 2: 运行测试脚本

```bash
node scripts/test-minio.js
```

### 方法 3: 检查 API 状态

```bash
curl http://localhost:3000/api/storage/status
```

## 生产环境配置建议

### 1. 使用强密码

```env
MINIO_ACCESS_KEY=minio-admin-2024
MINIO_SECRET_KEY=Your-Very-Strong-Password-Here-123!@#
```

### 2. 启用 SSL

```env
MINIO_USE_SSL=true
MINIO_ENDPOINT=minio.yourdomain.com
```

### 3. 使用环境变量文件

生产环境建议使用 Docker secrets 或 Kubernetes secrets，而不是直接在配置文件中存储密码。

### 4. 定期轮换密钥

定期更换访问密钥和密码，提高安全性。

## 常见问题

### Q: 配置后仍然连接失败？

A: 检查以下几点：
1. MinIO 服务是否运行：`docker ps | grep minio`
2. 端口是否正确：`curl http://localhost:9000/minio/health/live`
3. 认证信息是否匹配
4. 防火墙是否阻止连接

### Q: 如何修改密码？

A: 
1. 修改 `.env.local` 中的 `MINIO_SECRET_KEY`
2. 修改 `docker-compose.minio.yml` 中的 `MINIO_ROOT_PASSWORD`
3. 重启 MinIO 容器

### Q: 配置不生效？

A:
1. 确保 `.env.local` 文件在项目根目录
2. 重启 Next.js 应用
3. 检查环境变量是否正确加载：`node scripts/test-minio.js`

## 配置示例

### 开发环境

```env
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=change-me-now
```

### 生产环境

```env
MINIO_ENDPOINT=minio.production.com
MINIO_PORT=9000
MINIO_USE_SSL=true
MINIO_ACCESS_KEY=minio-prod-admin
MINIO_SECRET_KEY=SuperSecurePassword123!@#
```

