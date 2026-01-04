自动派发（Auto Assign）功能说明
=================================

1) 概览
--
本功能包含：
- 可视化条件编辑器（便于业务用户配置触发规则）
- 事件驱动（Event-Driven）与规则驱动（Rule-Based）两种模式
- 自动派发规则的管理 API 与管理界面
- 使用队列（BullMQ）将事件入队，由 worker 处理分配，提高可靠性与可重试性

2) 已修改/新增的关键文件
--
- `prisma/schema.prisma`：新增 `AutoAssignRule` 模型，存储规则。
- `src/components/training/AutoAssignBuilder.tsx`：可视化条件编辑器组件。
- `src/app/training/tasks/create/page.tsx`：集成条件编辑器并提交 `autoAssign` 配置。
- `src/app/api/auto-assign-rules/route.ts`：规则 CRUD API。
- `src/app/training/auto-assign-rules/page.tsx`：规则管理页面（列表/启停/删除）。
- `src/services/autoAssign.service.ts`：自动派发核心逻辑（事件/规则处理）。
- `src/services/queue.service.ts`：队列封装（BullMQ）。
- `scripts/workers/autoassign-worker.js`：worker 示例脚本，负责消费队列并执行分配。
- `scripts/run-autoassign-scan.js`：夜间跑批脚本（兜底扫描 rule 模式）。

3) 运行前的准备（必须）
--
- 运行 Prisma 迁移以创建 `AutoAssignRule` 表：

```powershell
npx prisma migrate dev --name add_auto_assign_rule
npx prisma generate
```

- 安装队列依赖并准备 Redis（若使用队列）：

```powershell
npm install bullmq ioredis
# 启动 Redis（示例，开发机）
# Windows: 使用 WSL 或 Docker 运行 Redis，或使用远程 Redis 服务
```

4) 如何部署队列 worker
--
- 在生产环境中，建议把 `scripts/workers/autoassign-worker.js` 作为独立进程/容器运行并由进程管理（pm2/systemd/docker-compose/k8s）。
- 设置环境变量 `REDIS_URL` 指向 Redis 实例。
- 示例（使用 node 直接运行）:

```powershell
# 在项目根目录
node scripts/workers/autoassign-worker.js
```

5) 定时扫描（规则驱动兜底）
--
- 使用平台定时任务（Windows 任务计划 / Linux cron / Kubernetes CronJob）每日夜间执行：

```powershell
node scripts/run-autoassign-scan.js
```

6) 前端使用说明
--
- 在“发布学习任务”页面启用“自动派发”，使用可视化编辑器添加条件并选择模式：
  - 事件驱动（Event-Driven）：例如用户首次登录、岗位变动、文档更新、考试结束
  - 规则驱动（Rule-Based）：用于夜间扫描、批量补指派和数据纠错

7) 注意与建议
--
- 若并发高或需要可靠重试，务必使用队列 + worker；直接异步调用仅适合低频场景。
- 为业务用户提供可视化规则编辑与测试面板会大幅降低误配置风险。
- 在 CI/CD 中加入 Prisma 迁移步骤，确保表结构与代码匹配。
