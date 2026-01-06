# MinIO 快速开始指南

## 1. 安装依赖

```bash
npm install minio
```

## 2. 启动 MinIO 服务

```bash
# 使用 Docker Compose
docker-compose -f docker-compose.minio.yml up -d

# 验证服务运行
docker ps | grep minio
```

## 3. 配置环境变量

创建 `.env.local` 文件：

```env
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=change-me-now
```

## 4. 启动应用服务器

```bash
npm run dev
```

启动后，查看控制台输出，应该看到 MinIO 初始化状态：

```
========================================
🚀 正在初始化应用程序...
========================================
⏰ 启动备份调度服务（存算分离架构）...
📦 初始化 MinIO 对象存储服务...
✅ MinIO 初始化成功
   • 端点: localhost:9000
   • Buckets: ehs-private, ehs-public
========================================
✅ 应用初始化完成
========================================
服务状态:
  ✅ 备份调度服务: 已启动
  ✅ MinIO 对象存储: 已启动
```

### 如果 MinIO 未启动

如果看到以下提示，说明 MinIO 未正确启动：

```
⚠️  MinIO 配置未找到，跳过初始化
```

或

```
❌ MinIO 初始化失败: ...
   提示: 请检查 MinIO 服务是否运行...
   启动命令: docker-compose -f docker-compose.minio.yml up -d
```

**解决方法**:
1. 检查 MinIO 容器是否运行：`docker ps | grep minio`
2. 启动 MinIO：`docker-compose -f docker-compose.minio.yml up -d`
3. 检查环境变量配置是否正确

## 5. 测试 MinIO 连接

```bash
# 测试 MinIO 连接和配置
node scripts/test-minio.js
```

## 6. 检查 MinIO 状态（API）

```bash
# 通过 API 检查状态
curl http://localhost:3000/api/storage/status
```

## 7. 使用文件上传组件

```tsx
import FileUploader from '@/components/storage/FileUploader';

export default function UploadPage() {
  return (
    <FileUploader
      bucket="private"
      prefix="hazards/2024/01"
      accept=".pdf,.docx,.jpg,.png"
      maxSize={50 * 1024 * 1024}
      onUploadSuccess={(objectName, url) => {
        console.log('上传成功:', objectName);
        // 保存到数据库
      }}
    />
  );
}
```

## 8. 设置备份

```bash
# 执行一次备份
bash scripts/minio-backup.sh sync

# 或设置定时任务（每天凌晨2点）
# 编辑 crontab: crontab -e
# 添加: 0 2 * * * /path/to/scripts/minio-backup.sh sync
```

## 访问 MinIO Console

- URL: http://localhost:9001
- 用户名: admin
- 密码: change-me-now

## 常见问题

### Q: 如何修改 MinIO 密码？

A: 修改 `docker-compose.minio.yml` 中的 `MINIO_ROOT_PASSWORD` 环境变量，然后重启容器。

### Q: 数据存储在哪里？

A: 数据存储在 `./data/minio-data` 目录（在 docker-compose 中配置）。

### Q: 如何备份到远程服务器？

A: 设置环境变量 `MINIO_BACKUP_TARGET` 为远程端点，然后执行备份脚本。

### Q: 启动时 MinIO 初始化失败怎么办？

A: 
1. 检查 MinIO 服务是否运行：`docker ps | grep minio`
2. 检查环境变量配置
3. 查看详细错误信息
4. 运行测试脚本：`node scripts/test-minio.js`

