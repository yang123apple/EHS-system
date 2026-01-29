# Docker 部署方案修复说明

## 📋 修复概览

本次修复解决了原 GPT 方案中的所有致命缺陷和中等风险问题，提供了一个生产就绪的 Docker 部署方案。

---

## 🔴 致命缺陷修复

### 1. Prisma Schema 硬编码数据库路径

**问题描述:**
- 原 `prisma/schema.prisma` 硬编码了 `url = "file:./dev.db"`
- 导致容器内的 `DATABASE_URL` 环境变量被完全忽略
- 数据库文件创建在 `/app/dev.db`，不在挂载卷上
- 容器重建后数据丢失

**修复方案:**
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")  // ✅ 现在从环境变量读取
}
```

**影响文件:**
- [prisma/schema.prisma:7](prisma/schema.prisma#L7)

---

### 2. MinIO Endpoint 配置错误

**问题描述:**
- 原 `.env.docker` 默认值 `MINIO_ENDPOINT=minio`（容器 DNS 名称）
- 预签名 URL 会包含这个 endpoint，浏览器无法访问
- 用户上传文件后无法下载/预览

**修复方案:**
1. 将 `.env.docker` 改为详细的配置模板，包含：
   - 清晰的使用说明
   - 三种部署场景示例（本机/局域网/公网）
   - 明确的错误示例和正确示例对比
   - 占位符 `YOUR_SERVER_IP_OR_DOMAIN` 强制用户修改

2. 创建 `.env.docker.example` 作为可提交的模板文件

3. 移除 `docker-compose.prod.yml` 中的默认值，强制从环境变量读取

**影响文件:**
- [.env.docker](/.env.docker) - 改为详细模板
- [.env.docker.example](/.env.docker.example) - 新增示例文件
- [docker-compose.prod.yml:17-26](docker-compose.prod.yml#L17-L26) - 移除不安全的默认值

---

## 🟡 中等风险问题修复

### 3. Dockerfile Builder 阶段路径不一致

**问题描述:**
- Builder 阶段 `DATABASE_URL="file:./prisma/dev.db"`
- Schema 中是 `file:./dev.db`
- 虽不影响 `prisma generate`，但维护上容易混乱

**修复方案:**
```dockerfile
ENV DATABASE_URL="file:./dev.db"  // ✅ 与 schema 保持一致
```

**影响文件:**
- [Dockerfile:7](Dockerfile#L7)

---

### 4. Runner 阶段 COPY 空目录

**问题描述:**
- `COPY --from=builder /app/data ./data` 复制不存在的目录
- 浪费镜像层空间

**修复方案:**
- 删除该行
- 改为在 RUN 指令中创建目录结构

**影响文件:**
- [Dockerfile:31](Dockerfile#L31) - 已删除

---

### 5. MinIO Healthcheck 使用不存在的 curl

**问题描述:**
- MinIO 官方镜像可能不包含 `curl`
- Healthcheck 失败导致 app 服务永远等待

**修复方案:**
```yaml
healthcheck:
  test: ["CMD", "mc", "ready", "local"]  // ✅ 使用 MinIO 内置的 mc 命令
```

**影响文件:**
- [docker-compose.prod.yml:59](docker-compose.prod.yml#L59)

---

### 6. App 服务缺少 Healthcheck

**问题描述:**
- 应用容器没有健康检查
- 无法判断应用是否真正启动成功

**修复方案:**
1. 在 Dockerfile 中添加 healthcheck：
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1
```

2. 在 docker-compose.prod.yml 中添加 healthcheck：
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

3. 创建健康检查 API 端点 `/api/health`：
   - 检查数据库连接
   - 返回服务状态
   - 503 状态码表示不健康

4. 在 runner 镜像中安装 curl：
```dockerfile
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
```

**影响文件:**
- [Dockerfile:40-42](Dockerfile#L40-L42) - 添加 healthcheck
- [Dockerfile:25](Dockerfile#L25) - 安装 curl
- [docker-compose.prod.yml:36-41](docker-compose.prod.yml#L36-L41) - 添加 healthcheck
- [src/app/api/health/route.ts](src/app/api/health/route.ts) - 新增健康检查端点

---

### 7. next.config.ts 无用配置

**问题描述:**
- `turbopack: {}` 仅用于 `next dev`，生产构建不使用

**修复方案:**
- 删除该配置项

**影响文件:**
- [next.config.ts:6](next.config.ts#L6) - 已删除

---

## 📚 新增文档和工具

### 1. 详细部署文档

**文件:** [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md)

**内容:**
- 完整的部署前准备清单
- 详细的配置说明（三种部署场景）
- 分步部署指南（一键脚本 + 手动部署）
- 验证部署的完整流程
- 常见问题排查（6 个典型问题）
- 维护操作手册（日志/重启/更新/备份）
- 监控和性能建议
- 安全建议

---

### 2. 快速参考卡片

**文件:** [DOCKER_QUICKSTART.md](DOCKER_QUICKSTART.md)

**内容:**
- 30 秒快速部署命令
- 必须修改的配置清单
- 常用命令速查表
- 常见问题快速解决方案
- 健康检查命令
- 备份恢复命令
- 调试技巧
- 部署检查清单

---

### 3. 环境变量示例文件

**文件:** [.env.docker.example](/.env.docker.example)

**用途:**
- 可提交到 Git 的配置模板
- 包含详细的配置说明
- 提供三种部署场景示例
- 默认值为 `localhost`（本机部署）

---

### 4. 健康检查 API

**文件:** [src/app/api/health/route.ts](src/app/api/health/route.ts)

**功能:**
- 检查数据库连接
- 返回服务状态 JSON
- 支持 Docker healthcheck
- 支持监控系统集成

---

### 5. .gitignore 更新

**修改:** [.gitignore:28](/.gitignore#L28)

**变更:**
- 排除所有 `.env*` 文件
- 但允许提交 `.env.docker.example`
- 保护敏感配置不被提交

---

## 📊 修复前后对比

| 项目 | 修复前 | 修复后 |
|------|--------|--------|
| **数据持久化** | ❌ 数据库在非挂载路径 | ✅ 数据库在挂载卷上 |
| **文件访问** | ❌ 预签名 URL 不可用 | ✅ 浏览器可访问 |
| **健康检查** | ❌ MinIO 检查失败 | ✅ 使用 mc 命令 |
| **应用监控** | ❌ 无健康检查 | ✅ 完整健康检查 |
| **配置安全** | ❌ 硬编码默认值 | ✅ 强制用户配置 |
| **文档完整性** | ❌ 仅简单说明 | ✅ 详细文档 + 快速参考 |
| **错误排查** | ❌ 无指导 | ✅ 6 个常见问题解决方案 |
| **维护操作** | ❌ 无文档 | ✅ 完整维护手册 |

---

## 🚀 使用新方案

### 快速开始

```bash
# 1. 配置环境
cp .env.docker.example .env.docker.local
vim .env.docker.local  # 修改 MINIO_ENDPOINT

# 2. 一键部署
python3 scripts/docker_oneclick.py

# 3. 验证
curl http://localhost:3000/api/health
```

### 详细文档

- **首次部署**: 阅读 [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md)
- **快速参考**: 查看 [DOCKER_QUICKSTART.md](DOCKER_QUICKSTART.md)
- **配置模板**: 参考 [.env.docker.example](/.env.docker.example)

---

## ✅ 验证清单

部署后请验证以下项目：

- [ ] 容器状态为 `healthy`: `docker ps`
- [ ] 健康检查通过: `curl http://localhost:3000/api/health`
- [ ] 数据库文件存在: `ls -la ./data/db/ehs.db`
- [ ] 应用可访问: 浏览器打开 `http://YOUR_IP:3000`
- [ ] MinIO 可访问: 浏览器打开 `http://YOUR_IP:9001`
- [ ] 文件上传功能正常
- [ ] 文件下载/预览正常

---

## 🔧 故障排查

如遇问题，按以下顺序排查：

1. **查看容器日志**: `docker logs ehs-app`
2. **检查健康状态**: `docker ps` 查看 STATUS 列
3. **验证配置**: `cat .env.docker.local`
4. **测试健康检查**: `curl http://localhost:3000/api/health`
5. **查看详细文档**: [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) 常见问题部分

---

## 📝 总结

本次修复：
- ✅ 解决了 **2 个致命缺陷**（数据丢失、文件无法访问）
- ✅ 修复了 **5 个中等风险问题**
- ✅ 新增了 **4 个文档/工具文件**
- ✅ 创建了 **1 个健康检查 API**
- ✅ 提供了 **完整的部署和维护指南**

现在的方案是一个**生产就绪**的 Docker 部署方案，可以安全地用于实际部署。

---

**修复日期**: 2026-01-28
**修复版本**: 2.0.0
