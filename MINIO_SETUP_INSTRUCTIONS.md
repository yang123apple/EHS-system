# MinIO 配置设置说明

## 快速设置

### 方法 1: 使用配置脚本（推荐）

**Windows:**
```cmd
setup-minio-config.bat
```

**Linux/Mac:**
```bash
chmod +x setup-minio-config.sh
./setup-minio-config.sh
```

### 方法 2: 手动创建配置文件

1. 在项目根目录创建 `.env.local` 文件
2. 复制以下内容：

```env
# MinIO 对象存储配置
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=change-me-now
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=change-me-now
MINIO_PRIMARY_ENDPOINT=http://localhost:9000
MINIO_PRIMARY_ACCESS_KEY=admin
MINIO_PRIMARY_SECRET_KEY=change-me-now
MINIO_BACKUP_TARGET=./data/minio-backup
```

### 方法 3: 从示例文件复制

```bash
# Windows
copy .env.local.example .env.local

# Linux/Mac
cp .env.local.example .env.local
```

## 配置说明

### 必需配置

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `MINIO_ENDPOINT` | localhost | MinIO 服务器地址 |
| `MINIO_PORT` | 9000 | MinIO API 端口 |
| `MINIO_ACCESS_KEY` | admin | 访问密钥（用户名） |
| `MINIO_SECRET_KEY` | change-me-now | 密钥（密码） |

### 可选配置

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `MINIO_USE_SSL` | false | 是否使用 SSL |
| `MINIO_ROOT_USER` | admin | Docker Compose 使用的 Root 用户 |
| `MINIO_ROOT_PASSWORD` | change-me-now | Docker Compose 使用的 Root 密码 |

## 验证配置

### 1. 检查配置文件

确保 `.env.local` 文件存在且包含正确的配置。

### 2. 启动 MinIO

```bash
docker-compose -f docker-compose.minio.yml up -d
```

### 3. 测试连接

```bash
node scripts/test-minio.js
```

### 4. 启动应用

```bash
npm run dev
```

查看控制台输出，应该看到：

```
📦 初始化 MinIO 对象存储服务...
✅ MinIO 初始化成功
   • 端点: localhost:9000
   • Buckets: ehs-private, ehs-public
```

## 配置与 Docker Compose 的对应关系

确保 `.env.local` 中的配置与 `docker-compose.minio.yml` 中的配置一致：

| .env.local | docker-compose.minio.yml |
|------------|-------------------------|
| `MINIO_ACCESS_KEY` | `MINIO_ROOT_USER` |
| `MINIO_SECRET_KEY` | `MINIO_ROOT_PASSWORD` |

## 生产环境配置

### 修改密码

1. 修改 `.env.local`:
```env
MINIO_ACCESS_KEY=your-secure-access-key
MINIO_SECRET_KEY=your-very-strong-password
```

2. 修改 `docker-compose.minio.yml`:
```yaml
environment:
  MINIO_ROOT_USER: your-secure-access-key
  MINIO_ROOT_PASSWORD: your-very-strong-password
```

3. 重启服务:
```bash
docker-compose -f docker-compose.minio.yml down
docker-compose -f docker-compose.minio.yml up -d
```

### 使用远程 MinIO

```env
MINIO_ENDPOINT=minio.yourdomain.com
MINIO_PORT=9000
MINIO_USE_SSL=true
MINIO_ACCESS_KEY=your-access-key
MINIO_SECRET_KEY=your-secret-key
```

## 故障排查

### 问题: 配置文件不存在

**解决**: 运行配置脚本或手动创建 `.env.local` 文件

### 问题: 连接失败

**检查**:
1. MinIO 服务是否运行: `docker ps | grep minio`
2. 端口是否正确: `curl http://localhost:9000/minio/health/live`
3. 认证信息是否匹配

### 问题: 配置不生效

**解决**:
1. 确保 `.env.local` 在项目根目录
2. 重启 Next.js 应用
3. 检查环境变量: `node scripts/test-minio.js`

## 下一步

配置完成后：

1. ✅ 启动 MinIO: `docker-compose -f docker-compose.minio.yml up -d`
2. ✅ 测试连接: `node scripts/test-minio.js`
3. ✅ 启动应用: `npm run dev`
4. ✅ 查看状态: 访问 `http://localhost:3000/api/storage/status`

