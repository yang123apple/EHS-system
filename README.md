# EHS 系统 - 环境健康安全管理系统

一个基于 Next.js 的现代化环境健康安全（EHS）管理系统，支持项目管理、隐患排查、整改跟踪等功能。

## ✨ 特性

- 🚀 基于 Next.js 15 和 React 19
- 💾 使用 Prisma ORM 和 SQLite 数据库
- 📦 MinIO 对象存储支持
- 🐳 完整的 Docker 部署方案
- 🔄 自动化备份和恢复
- 📊 实时数据统计和报表
- 🔒 安全的文件上传和管理

## 📚 文档导航

### 快速开始
- **[快速开始指南](QUICKSTART.md)** - 5 分钟上手，包含所有常见场景
- **[Docker 快速参考](DOCKER_QUICKSTART.md)** - Docker 命令速查表

### 部署文档
- **[完整工作流](WORKFLOW.md)** - 开发-构建-部署完整流程
- **[Docker 部署指南](DOCKER_DEPLOYMENT.md)** - 详细的部署步骤和故障排查
- **[部署方案总结](DEPLOYMENT_SUMMARY.md)** - 架构说明和最佳实践
- **[修复说明](DOCKER_CHANGES.md)** - Docker 方案的改进和修复

### 开发文档
- **[本地开发](#本地开发)** - 开发环境设置
- **[API 文档](#api-文档)** - API 接口说明

---

## 🚀 快速开始

### 本地开发

```bash
# 1. 克隆代码
git clone <repository-url>
cd EHS-system

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev

# 4. 访问应用
# 浏览器打开: http://localhost:3000
```

### Docker 部署

```bash
# 1. 配置环境
cp .env.docker.example .env.docker.local
vim .env.docker.local  # 修改 MINIO_ENDPOINT 为实际 IP

# 2. 一键部署
python3 scripts/docker_oneclick.py

# 3. 访问应用
# 浏览器打开: http://YOUR_SERVER_IP:3000
```

详细说明请查看 [QUICKSTART.md](QUICKSTART.md)

---

## 📦 项目结构

```
EHS-system/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── api/          # API 路由
│   │   │   └── health/   # 健康检查端点
│   │   └── ...
│   ├── components/       # React 组件
│   ├── lib/              # 工具库
│   │   ├── prisma.ts     # Prisma 客户端
│   │   └── minio.ts      # MinIO 客户端
│   └── services/         # 业务逻辑
│
├── prisma/
│   └── schema.prisma     # 数据库模型
│
├── scripts/              # 工具脚本
│   ├── docker_oneclick.py    # 一键部署
│   ├── docker_update.py      # 服务更新
│   ├── docker_backup.py      # 数据备份
│   ├── docker_restore.py     # 数据恢复
│   └── docker_image.py       # 镜像管理
│
├── public/               # 静态文件
│   └── uploads/          # 上传文件（挂载卷）
│
├── data/                 # 数据目录（挂载卷）
│   ├── db/               # SQLite 数据库
│   ├── minio-data/       # MinIO 数据
│   └── minio-backup/     # MinIO 备份
│
├── docker-compose.prod.yml   # Docker Compose 配置
├── Dockerfile                # Docker 镜像定义
├── .env.docker.example       # 环境变量模板
└── package.json              # 项目依赖
```

---

## 🛠️ 工具脚本

### 部署和更新

```bash
# 一键部署
python3 scripts/docker_oneclick.py

# 更新服务（自动备份、拉取代码、构建、重启）
python3 scripts/docker_update.py

# 滚动更新（最小停机时间）
python3 scripts/docker_update.py --mode rolling

# 完全重建
python3 scripts/docker_update.py --mode recreate
```

### 数据管理

```bash
# 备份数据
python3 scripts/docker_backup.py

# 恢复数据
python3 scripts/docker_restore.py --backup-dir ./backups/backup-YYYYMMDD-HHMMSS

# 导出镜像
python3 scripts/docker_image.py export --image ehs-system:prod

# 导入镜像
python3 scripts/docker_image.py import ./ehs-system-prod-*.tar.gz
```

详细说明请查看 [QUICKSTART.md](QUICKSTART.md)

---

## 💻 本地开发

### 环境要求

- Node.js 20+
- npm 或 yarn
- Git

### 开发命令

```bash
# 启动开发服务器
npm run dev

# 构建生产代码
npm run build

# 启动生产服务器
npm start

# 代码检查
npm run lint

# 运行测试
npm test

# 数据库操作
npx prisma migrate dev      # 开发环境迁移
npx prisma migrate deploy   # 生产环境迁移
npx prisma studio           # 数据库可视化工具
```

### 环境变量

开发环境使用 `.env` 文件：

```bash
DATABASE_URL="file:./dev.db"
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=your-password
```

生产环境使用 `.env.docker.local` 文件，详见 [.env.docker.example](.env.docker.example)

---

## 🐳 Docker 部署

### 系统要求

- Docker 20.10+
- Docker Compose 2.0+
- 4GB+ RAM
- 10GB+ 磁盘空间

### 部署架构

```
┌─────────────────────────────────────────┐
│           Docker Host                    │
│                                          │
│  ┌────────────────┐  ┌────────────────┐ │
│  │   ehs-app      │  │   ehs-minio    │ │
│  │  (Next.js)     │  │   (MinIO)      │ │
│  │  Port: 3000    │  │  Port: 9000    │ │
│  │  Health: ✓     │  │  Port: 9001    │ │
│  └────────┬───────┘  └────────┬───────┘ │
│           │                   │          │
│           └───────┬───────────┘          │
│                   │                      │
│           ┌───────▼───────┐              │
│           │  ehs-network  │              │
│           └───────────────┘              │
│                                          │
│  Volume Mounts:                          │
│  • ./data → /app/data                    │
│  • ./public/uploads → /app/public/uploads│
└─────────────────────────────────────────┘
```

### 配置说明

**关键配置项**（必须修改）：

```bash
# .env.docker.local

# ⚠️ 必须改为浏览器可访问的 IP 或域名
MINIO_ENDPOINT=192.168.1.100

# ⚠️ 与上面保持一致
MINIO_PRIMARY_ENDPOINT=http://192.168.1.100:9000

# ⚠️ 修改为强密码
MINIO_SECRET_KEY=your-strong-password
MINIO_ROOT_PASSWORD=your-strong-password
```

详细配置说明请查看 [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md)

---

## 📊 API 文档

### 健康检查

```bash
GET /api/health
```

**响应示例**：

```json
{
  "status": "healthy",
  "timestamp": "2026-01-28T12:00:00.000Z",
  "services": {
    "database": "ok",
    "application": "ok"
  }
}
```

### 其他 API

详细 API 文档请查看 `src/app/api/` 目录下的各个路由文件。

---

## 🔧 故障排查

### 常见问题

#### 1. 文件上传后无法访问

**原因**: `MINIO_ENDPOINT` 配置错误

**解决**:
```bash
vim .env.docker.local  # 修改为浏览器可访问的 IP
docker restart ehs-app
```

#### 2. 容器无法启动

**排查**:
```bash
docker logs ehs-app           # 查看日志
sudo lsof -i :3000            # 检查端口占用
docker ps -a                  # 查看容器状态
```

#### 3. 数据库错误

**解决**:
```bash
docker exec ehs-app npx prisma migrate deploy  # 重新执行迁移
```

更多问题请查看 [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) 的"常见问题"部分。

---

## 🔒 安全建议

1. **修改默认密码**: 务必修改 `.env.docker.local` 中的所有密码
2. **使用 HTTPS**: 生产环境建议配置 SSL 证书
3. **防火墙配置**: 限制端口访问，只开放必要的端口
4. **定期备份**: 设置自动备份任务
5. **更新镜像**: 定期更新 Docker 镜像到最新版本

---

## 📝 更新日志

### v2.0.0 (2026-01-28)

**Docker 部署方案重大更新**

- ✅ 修复 Prisma schema 硬编码问题，确保数据持久化
- ✅ 修复 MinIO endpoint 配置问题，支持浏览器访问
- ✅ 添加完整的健康检查机制
- ✅ 新增自动化备份和恢复脚本
- ✅ 新增服务更新脚本（支持滚动更新）
- ✅ 新增镜像导出/导入工具
- ✅ 提供完整的文档和工作流指南

详细修复说明请查看 [DOCKER_CHANGES.md](DOCKER_CHANGES.md)

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 开发流程

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

---

## 📄 许可证

[MIT License](LICENSE)

---

## 📞 获取帮助

### 文档资源

- **快速开始**: [QUICKSTART.md](QUICKSTART.md)
- **完整工作流**: [WORKFLOW.md](WORKFLOW.md)
- **部署指南**: [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md)
- **快速参考**: [DOCKER_QUICKSTART.md](DOCKER_QUICKSTART.md)

### 技术支持

- 查看文档中的"常见问题"部分
- 提交 GitHub Issue
- 联系技术支持团队

---

## 🎯 路线图

- [ ] 支持 PostgreSQL 数据库
- [ ] 添加用户权限管理
- [ ] 支持多租户
- [ ] 移动端适配
- [ ] 数据导出和报表功能增强
- [ ] 集成第三方通知服务

---

**感谢使用 EHS 系统！** 🎉

如有问题或建议，欢迎反馈。
