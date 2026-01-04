# 自动派发系统 - 部署指南

## ✅ 已完成

### 1. 数据库迁移
```bash
npx prisma migrate dev
# ✓ 已应用: 20260104160216_add_auto_assign_with_reverse_relation
```

### 2. 依赖安装
```bash
npm install bullmq ioredis
# ✓ 已安装: 19 packages (BullMQ 队列系统)
```

### 3. 功能测试
```bash
node scripts/test-auto-assign.js
# ✓ 所有测试通过 ✅
#   - 事件驱动模式: ✓
#   - 规则驱动模式: ✓
#   - 正则匹配: ✓
#   - 岗位层级匹配: ✓
```

---

## 🚀 部署步骤

### 方式一: 不使用队列 (简单模式)
**适用场景**: 流量较小,不需要异步处理

1. **功能已可用** - 无需额外配置
2. **工作流程**:
   - 用户注册 → 自动触发 `assignOnboardingPlanToUser()`
   - 用户首次登录 → 检查事件驱动规则 (同步)
   - 每日凌晨 → 可选运行 `node scripts/run-autoassign-scan.js`

### 方式二: 使用 BullMQ 队列 (推荐生产环境)
**适用场景**: 高流量、需要重试机制、异步处理

#### 步骤 1: 启动 Redis
```bash
# Windows (需要 WSL/Docker)
wsl -d Ubuntu redis-server

# 或使用 Docker
docker run -d -p 6379:6379 redis:alpine

# 或使用云服务 (阿里云/腾讯云 Redis)
# 设置环境变量: REDIS_URL=redis://your-redis-host:6379
```

#### 步骤 2: 启动 Worker
```bash
# 开发环境
node scripts/workers/autoassign-worker.js

# 生产环境 (使用 pm2)
npm install -g pm2
pm2 start scripts/workers/autoassign-worker.js --name "autoassign-worker"
pm2 save
pm2 startup  # 开机自启
```

#### 步骤 3: 配置定时任务 (可选)
```bash
# 方案 A: Node-cron (需要安装 npm install node-cron)
# 在 worker 中添加 cron.schedule('0 2 * * *', runRuleScan)

# 方案 B: Windows 任务计划程序
# 创建任务: 每日 2:00 AM 运行 node scripts/run-autoassign-scan.js

# 方案 C: Linux crontab
# 0 2 * * * cd /path/to/project && node scripts/run-autoassign-scan.js
```

---

## 📋 核心文件清单

### 数据库层
- `prisma/schema.prisma` - AutoAssignRule 模型定义
- `prisma/migrations/20260104160216_*` - 数据库迁移文件

### 服务层
- `src/services/autoAssign.service.ts` - 核心匹配引擎 (支持 AND/OR/regex/levelGte/Lte)
- `src/services/onboardingService.ts` - 入职自动分配
- `src/services/queue.service.ts` - BullMQ 队列封装

### API 层
- `src/app/api/auto-assign-rules/route.ts` - 规则 CRUD API
- `src/app/api/users/route.ts` - 用户创建时触发自动分配

### 前端组件
- `src/components/training/AutoAssignBuilder.tsx` - 可视化条件编辑器
- `src/app/training/auto-assign-rules/page.tsx` - 规则管理界面

### 脚本工具
- `scripts/workers/autoassign-worker.js` - BullMQ Worker (已修复 TS 导入问题)
- `scripts/run-autoassign-scan.js` - 定时扫描脚本
- `scripts/test-auto-assign.js` - 集成测试脚本

---

## 🔧 配置说明

### 环境变量
```env
# .env.local
DATABASE_URL="file:./data/dev.db"  # 或生产数据库
REDIS_URL="redis://localhost:6379"  # 使用队列时必需
```

### 条件语法示例
```json
{
  "conjunction": "AND",
  "conditions": [
    { "field": "jobTitle", "operator": "equals", "value": "操作工" },
    { "field": "jobLevel", "operator": "levelGte", "value": "3" }
  ]
}
```

**支持的操作符**:
- `equals` - 精确匹配
- `contains` - 包含字符串
- `startsWith` - 以...开头
- `in` - 在列表中 (逗号分隔)
- `regex` - 正则表达式
- `levelGte` - 层级 ≥
- `levelLte` - 层级 ≤

---

## 🧪 测试命令

```bash
# 运行集成测试
node scripts/test-auto-assign.js

# 测试规则扫描
node scripts/run-autoassign-scan.js

# 启动 Worker (需要 Redis)
node scripts/workers/autoassign-worker.js
```

---

## ⚠️ 已知限制

1. **Redis 依赖** (仅队列模式):
   - Windows 需要 WSL/Docker
   - 可选择云服务 (阿里云 Redis)

2. **TypeScript 模块导入**:
   - Worker 使用内联逻辑避免 TS 模块导入问题
   - 生产环境建议编译 TS → JS

3. **SQLite Json 类型**:
   - `condition` 字段使用 `String` 类型存储 JSON
   - 读取时需 `JSON.parse(rule.condition)`

---

## 📝 下一步优化建议

1. **性能优化**:
   - 添加规则缓存 (Redis)
   - 批量分配接口 (减少数据库查询)

2. **监控与日志**:
   - Worker 日志持久化 (Winston/Pino)
   - 分配成功率统计

3. **UI 增强**:
   - 规则执行历史记录
   - 分配预览功能 (显示哪些用户会被匹配)

---

## 📞 故障排查

### 问题: Worker 启动失败
```bash
# 检查 Redis 连接
redis-cli ping  # 应返回 PONG

# 查看 Worker 日志
node scripts/workers/autoassign-worker.js
```

### 问题: 规则不生效
```bash
# 检查规则状态
node -e "const { PrismaClient } = require('@prisma/client'); new PrismaClient().$connect().then(p => p.autoAssignRule.findMany()).then(console.log)"

# 手动触发测试
node scripts/test-auto-assign.js
```

### 问题: 条件语法错误
- 使用前端可视化编辑器 (带正则测试面板)
- 或参考 `AUTO_ASSIGN_README.md` 中的示例

---

**✅ 当前状态**: 核心功能已完成并通过测试,可直接使用 (简单模式) 或配置 Redis 后使用队列模式。
