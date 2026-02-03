# 隐患编号回收利用系统 - 实施指南

## 📋 概述

本文档介绍了隐患编号回收利用系统的完整实施方案，实现了软删除后编号自动回收并重用的功能。

## 🎯 功能特性

- ✅ **编号回收**：软删除后自动释放编号到编号池
- ✅ **智能重用**：优先重用小序号，保持编号连续性
- ✅ **并发安全**：使用数据库事务保证并发操作一致性
- ✅ **过期管理**：支持编号过期时间，定期自动清理
- ✅ **完整追溯**：记录编号释放和重用的完整历史
- ✅ **硬删除兼容**：硬删除时从编号池永久移除

## 📁 文件清单

### 新增文件

1. **数据库 Schema**
   - `prisma/schema.prisma` - 新增 `HazardCodePool` 表

2. **服务层**
   - `src/services/hazardCodePool.service.ts` - 编号池核心服务

3. **API 修改**
   - `src/app/api/hazards/route.ts` - 修改编号生成逻辑
   - `src/app/api/hazards/void/route.ts` - 集成编号释放
   - `src/app/api/hazards/destroy/route.ts` - 集成编号移除

4. **脚本**
   - `scripts/init-hazard-code-pool.ts` - 数据迁移脚本
   - `scripts/clean-expired-hazard-codes.ts` - 定时清理脚本

5. **测试**
   - `src/__tests__/unit/services/hazardCodePool.service.test.ts` - 单元测试

## 🚀 实施步骤

### 步骤 1: 数据库迁移

```bash
# 1. 生成 Prisma 迁移
npx prisma migrate dev --name add_hazard_code_pool

# 2. 应用迁移到生产环境
npx prisma migrate deploy
```

### 步骤 2: 初始化编号池

```bash
# 将现有已作废的隐患编号加入编号池
npx ts-node scripts/init-hazard-code-pool.ts
```

**预期输出：**
```
🚀 开始初始化隐患编号池...

📊 找到 15 条已作废隐患

✅ 编号池初始化完成！

📈 统计信息：
   - 成功添加: 15 条
   - 跳过: 0 条

📅 按日期分布：
   - 2025-02-01: 5 个编号
   - 2025-02-02: 10 个编号

🎯 编号池当前可用编号总数: 15
```

### 步骤 3: 验证功能

#### 3.1 创建隐患

```bash
# 创建隐患（应该重用编号池中的编号）
curl -X POST http://localhost:3000/api/hazards \
  -H "Content-Type: application/json" \
  -d '{
    "type": "安全隐患",
    "location": "测试区域",
    "desc": "测试描述",
    "riskLevel": "medium",
    "reporterId": "user-1",
    "reporterName": "张三"
  }'
```

**预期日志：**
```
♻️ [编号回收] 重用编号: Hazard20250201001 (序号: 1)
```

#### 3.2 软删除隐患

```bash
# 软删除隐患（应该释放编号到编号池）
curl -X POST http://localhost:3000/api/hazards/void \
  -H "Content-Type: application/json" \
  -d '{
    "hazardId": "hazard-id",
    "reason": "录入错误"
  }'
```

**预期日志：**
```
♻️ [编号回收] 编号 Hazard20250201001 已释放到编号池
✅ [隐患作废] 隐患 Hazard20250201001 已作废
```

#### 3.3 硬删除隐患

```bash
# 硬删除隐患（应该从编号池永久移除）
curl -X DELETE http://localhost:3000/api/hazards/destroy?id=hazard-id
```

**预期日志：**
```
🗑️ [编号回收] 编号 Hazard20250201001 已从编号池永久移除
✅ [硬删除] 隐患 Hazard20250201001 已物理删除
   - 编号池记录：1 条
```

### 步骤 4: 配置定时清理

选择以下任一方式配置定时清理任务：

#### 方式 1: Node.js Cron（推荐）

安装依赖：
```bash
npm install node-cron
```

在应用启动文件中添加：
```typescript
// src/app/api/cron/route.ts 或 server.ts

import cron from 'node-cron';
import { cleanExpiredCodes } from '@/scripts/clean-expired-hazard-codes';

// 每天凌晨 2 点执行
cron.schedule('0 2 * * *', async () => {
  console.log('🕐 执行定时任务：清理过期编号');
  try {
    await cleanExpiredCodes();
  } catch (error) {
    console.error('定时任务执行失败:', error);
  }
});
```

#### 方式 2: 系统级 Crontab（Linux/Unix）

```bash
# 编辑 crontab
crontab -e

# 添加以下行（每天凌晨 2 点执行）
0 2 * * * cd /path/to/EHS-system && npx ts-node scripts/clean-expired-hazard-codes.ts >> /var/log/ehs-cron.log 2>&1
```

#### 方式 3: 手动执行

```bash
# 定期手动执行
npx ts-node scripts/clean-expired-hazard-codes.ts
```

### 步骤 5: 运行测试

```bash
# 运行单元测试
npm test hazardCodePool.service.test.ts

# 运行所有测试
npm test
```

## 📊 数据库表结构

### HazardCodePool 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | String | 主键 |
| code | String | 编号（唯一） |
| datePrefix | String | 日期前缀（如：20250202） |
| sequence | Int | 序号（1-999） |
| status | String | 状态：available/used/expired |
| releasedBy | String? | 释放操作人ID |
| releasedAt | DateTime | 释放时间 |
| usedAt | DateTime? | 使用时间 |
| usedBy | String? | 使用操作人ID |
| expiresAt | DateTime? | 过期时间 |
| createdAt | DateTime | 创建时间 |
| updatedAt | DateTime | 更新时间 |

### 关键索引

```prisma
@@index([status])
@@index([datePrefix, status])     // 核心查询索引
@@index([datePrefix, sequence])   // 保证连续性
@@index([expiresAt])              // 清理任务索引
```

## 🔍 监控与运维

### 查询编号池状态

```sql
-- 查看所有可用编号
SELECT code, datePrefix, sequence, releasedAt, expiresAt
FROM HazardCodePool
WHERE status = 'available'
ORDER BY datePrefix DESC, sequence ASC;

-- 统计各日期的可用编号数量
SELECT
  datePrefix,
  COUNT(*) as availableCount
FROM HazardCodePool
WHERE status = 'available'
GROUP BY datePrefix
ORDER BY datePrefix DESC;

-- 查看即将过期的编号
SELECT code, datePrefix, expiresAt
FROM HazardCodePool
WHERE status = 'available'
  AND expiresAt < datetime('now', '+7 days')
ORDER BY expiresAt ASC;
```

### 使用 API 查询统计

```typescript
import { HazardCodePoolService } from '@/services/hazardCodePool.service';

// 获取今天的编号池统计
const today = '20250202';
const stats = await HazardCodePoolService.getPoolStats(today);
console.log(stats);
// {
//   total: 100,
//   available: 30,
//   used: 70,
//   expired: 5,
//   datePrefix: '20250202'
// }

// 获取所有编号池统计
const allStats = await HazardCodePoolService.getPoolStats();
```

## ⚠️ 注意事项

### 1. 编号唯一性

数据库中 `HazardRecord.code` 字段有 `@unique` 约束，确保：
- 一个编号只能被一个活跃隐患使用
- 编号池中的编号不能被正在使用的隐患占用

### 2. 过期策略

- 默认过期时间：30天
- 可在释放时自定义：`releaseCode(code, userId, 60)` // 60天后过期
- 过期编号会被定时任务清理，不可恢复

### 3. 跨日期编号

- 每天的编号独立管理
- 不会跨天重用（如 20250201001 不会在 2月2日被使用）

### 4. 并发安全

- 使用数据库事务保证并发安全
- 多个请求同时创建隐患时，不会获取到相同编号

### 5. 硬删除 vs 软删除

| 操作 | 编号处理 | 数据保留 | 可恢复性 |
|------|----------|----------|----------|
| 软删除 | 释放到编号池 | 保留 | 可恢复（需标记编号为已使用） |
| 硬删除 | 永久移除 | 删除 | 不可恢复 |

## 🔧 故障排查

### 问题 1: 编号没有被重用

**可能原因：**
- 编号池中没有可用编号
- 编号已过期但未清理

**解决方案：**
```bash
# 1. 检查编号池
npx prisma studio
# 打开 HazardCodePool 表，查看 status='available' 的记录

# 2. 手动清理过期编号
npx ts-node scripts/clean-expired-hazard-codes.ts

# 3. 查看日志
tail -f /var/log/ehs-cron.log
```

### 问题 2: 编号冲突

**可能原因：**
- 并发操作导致
- 数据库迁移不完整

**解决方案：**
```bash
# 1. 检查数据库约束
npx prisma db push --accept-data-loss

# 2. 重新初始化编号池
npx ts-node scripts/init-hazard-code-pool.ts
```

### 问题 3: 编号池无限增长

**可能原因：**
- 定时清理任务未配置
- 过期时间设置过长

**解决方案：**
```bash
# 1. 手动清理
npx ts-node scripts/clean-expired-hazard-codes.ts

# 2. 调整过期时间（在释放时）
await HazardCodePoolService.releaseCode(code, userId, 7); // 改为7天
```

## 📈 性能优化

### 索引优化

编号池表已配置以下索引：

```prisma
@@index([datePrefix, status])   // 核心查询：当天可用编号
@@index([datePrefix, sequence]) // 保证序号连续性
@@index([expiresAt])            // 清理任务优化
```

### 查询优化建议

```typescript
// ✅ 推荐：使用日期过滤
const stats = await HazardCodePoolService.getPoolStats('20250202');

// ❌ 避免：全表扫描
const allStats = await prisma.hazardCodePool.findMany(); // 慢
```

## 📝 更新日志

### v1.0.0 (2025-02-02)

- ✨ 新增编号池表和服务
- ♻️ 实现编号回收和重用
- 🧹 添加定时清理功能
- ✅ 完善单元测试
- 📚 完整实施文档

## 🤝 贡献

如有问题或建议，请提交 Issue 或 Pull Request。

## 📄 许可

MIT License
