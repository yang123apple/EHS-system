# 系统日志目标ID显示修复报告

## 问题描述

在隐患管理系统的操作日志详情弹窗中，"目标ID"字段显示为空（显示为"-"），但应该显示隐患的ID（数据库主键，CUID格式）或隐患编号（code，格式如：Hazard20250112001）。

**问题截图位置**：
- 页面：http://localhost:3000/hidden-danger
- 操作：点击"系统操作日志" -> 查看任意日志的"操作详情"
- 问题字段：目标ID 显示为 "-"

## 根本原因分析

### 1. 数据流追踪

```
隐患创建/更新 API (src/app/api/hazards/route.ts)
    ↓ 调用 logApiOperation
middleware/auth.ts 中的 logApiOperation 函数
    ↓ 提取 targetId
从 details 对象中查找: fullNum | documentId | permitId | targetId
    ↓ ❌ 问题：没有查找 hazardId
传递给 AuditService
    ↓
保存到数据库 SystemLog 表的 targetId 字段
    ↓
前端 SystemLogView 组件读取并显示
```

### 2. 问题定位

在 `src/middleware/auth.ts` 的 `logApiOperation` 函数（第257行）：

```typescript
// ❌ 旧代码 - 没有包含 hazardId
const targetId = details?.fullNum || details?.documentId || details?.permitId || details?.targetId || '';
```

但在 `src/app/api/hazards/route.ts` 中调用时传入的是：

```typescript
await logApiOperation(user, 'hidden_danger', 'report', {
  hazardId: res.code || res.id,  // ❌ 使用的键名是 hazardId，但上面没有提取
  type: res.type,
  location: res.location,
  riskLevel: res.riskLevel
});
```

**根本原因**：字段名不匹配，导致 `targetId` 最终为空字符串。

## 修复方案

### 修复1：后端日志记录（src/middleware/auth.ts）

**修改位置**：第298行

```typescript
// ✅ 新代码 - 添加对 hazardId 的支持
const targetId = details?.hazardId || details?.fullNum || details?.documentId || details?.permitId || details?.targetId || '';
```

**影响范围**：
- ✅ 修复后，新创建/更新的隐患日志将正确记录 targetId
- ⚠️ 历史日志（targetId 为空的）需要通过前端兜底显示

### 修复2：前端显示兜底（src/app/hidden-danger/_components/views/SystemLogView.tsx）

**修改位置**：第337-358行（操作详情弹窗中的"目标ID"字段）

```typescript
// ✅ 新逻辑：优先级 targetId > snapshot.code > snapshot.id > '-'
{(() => {
  // 优先使用 targetId（新日志）
  if (selectedDetailsLog.targetId) {
    return selectedDetailsLog.targetId;
  }
  // 从 snapshot 中尝试获取 code 或 id（兜底，用于历史日志）
  try {
    if (selectedDetailsLog.snapshot && typeof selectedDetailsLog.snapshot === 'object') {
      const snapshot = selectedDetailsLog.snapshot;
      if (snapshot.code) {
        return snapshot.code;  // 隐患编号（最佳显示）
      }
      if (snapshot.id) {
        return snapshot.id;    // 数据库ID（备选）
      }
    }
  } catch (e) {
    console.error('解析snapshot失败:', e);
  }
  return '-';
})()}
```

**优势**：
1. 新日志直接从 `targetId` 字段读取（性能最优）
2. 历史日志从 `snapshot` 中解析（向后兼容）
3. 优先显示业务编号 `code`（用户友好）
4. 降级显示数据库 `id`（技术备选）

## 验证步骤

### 1. 验证新日志记录

```bash
# 1. 创建一个新隐患
# 2. 查看系统操作日志
# 3. 点击该日志的"操作详情"
# 4. 确认"目标ID"显示为 Hazard20260122XXX（编号格式）
```

### 2. 验证历史日志兜底

```sql
-- 查询历史日志（targetId 为空的记录）
SELECT id, action, targetType, targetId, snapshot 
FROM SystemLog 
WHERE targetType = 'hazard' AND (targetId IS NULL OR targetId = '')
ORDER BY createdAt DESC LIMIT 5;
```

预期结果：
- 前端应该从 `snapshot.code` 或 `snapshot.id` 中提取并显示

### 3. 数据库验证

```sql
-- 检查新创建的日志是否有 targetId
SELECT id, action, targetType, targetId, createdAt 
FROM SystemLog 
WHERE targetType = 'hazard' 
ORDER BY createdAt DESC LIMIT 5;
```

预期结果：
- 新日志的 `targetId` 字段应该有值（Hazard编号或ID）

## 相关文件清单

### 修改的文件
1. ✅ `src/middleware/auth.ts` - 添加 hazardId 字段支持
2. ✅ `src/app/hidden-danger/_components/views/SystemLogView.tsx` - 前端显示兜底逻辑

### 相关但未修改的文件
- `src/app/api/hazards/route.ts` - 调用 logApiOperation 的地方（已正确传入 hazardId）
- `src/services/audit.service.ts` - 审计服务核心逻辑
- `prisma/schema.prisma` - SystemLog 表定义

## 影响范围

### ✅ 已修复
- [x] 新创建的隐患日志 targetId 正确记录
- [x] 新更新的隐患日志 targetId 正确记录  
- [x] 历史日志通过 snapshot 兜底显示
- [x] 操作详情弹窗正确显示目标ID

### ⚠️ 已知限制
- 如果历史日志的 snapshot 中也没有 code 和 id，仍会显示 "-"
- 这是合理的，因为这些日志可能是系统早期创建的，数据不完整

### 🔄 向后兼容性
- ✅ 完全向后兼容
- ✅ 不影响现有功能
- ✅ 历史数据可正常显示

## 测试建议

### 手动测试
1. **新日志测试**
   - [ ] 创建新隐患，检查操作日志的目标ID
   - [ ] 更新隐患，检查操作日志的目标ID
   - [ ] 删除隐患，检查操作日志的目标ID

2. **历史日志测试**
   - [ ] 查看历史日志（targetId 为空的），确认显示 code
   - [ ] 查看详情弹窗，确认"目标ID"字段不为空

3. **边界测试**
   - [ ] snapshot 为 null 的日志
   - [ ] snapshot 中没有 code 和 id 的日志

### 自动化测试（建议）

```typescript
// 测试 logApiOperation 正确提取 hazardId
describe('logApiOperation', () => {
  it('应该从 details.hazardId 中提取 targetId', async () => {
    const details = { hazardId: 'Hazard20260122001', type: 'fire' };
    await logApiOperation(mockUser, 'hidden_danger', 'report', details);
    // 验证保存的日志记录中 targetId = 'Hazard20260122001'
  });
});

// 测试前端显示逻辑
describe('SystemLogView targetId display', () => {
  it('应该优先显示 targetId', () => {
    const log = { targetId: 'Hazard001', snapshot: { code: 'Hazard002' } };
    // 应该显示 'Hazard001'
  });
  
  it('应该从 snapshot.code 兜底', () => {
    const log = { targetId: null, snapshot: { code: 'Hazard002' } };
    // 应该显示 'Hazard002'
  });
  
  it('应该从 snapshot.id 二级兜底', () => {
    const log = { targetId: null, snapshot: { id: 'cmxxx' } };
    // 应该显示 'cmxxx'
  });
});
```

## 总结

### 问题根源
字段名不匹配：API 调用时使用 `hazardId`，但 `logApiOperation` 函数未提取该字段。

### 解决方案
1. **后端修复**：在 `logApiOperation` 中添加 `hazardId` 字段的提取
2. **前端兜底**：在前端显示时，从 `snapshot` 中提取 `code` 或 `id` 作为后备

### 预期效果
- ✅ 新日志：目标ID 正确显示（Hazard编号）
- ✅ 历史日志：从 snapshot 中解析显示（向后兼容）
- ✅ 用户体验：操作详情弹窗完整展示所有信息

---

**修复时间**：2026-01-22 20:57  
**修复人员**：系统开发团队  
**验证状态**：✅ 代码已修复，等待测试验证
