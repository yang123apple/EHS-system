# 隐患删除参数验证Bug修复报告

## 问题描述

在执行隐患作废操作时，系统抛出错误：

```
缺少必要参数：hazardId 和 reason
src/lib/apiClient.ts (220:11) @ ApiClient.handleResponseError
```

错误发生在调用隐患作废API (`/api/hazards/void`) 时，后端验证参数失败。

## 问题分析

### 调用链路

1. **前端调用**：`src/app/hidden-danger/page.tsx` 的 `confirmDelete` 函数
   ```typescript
   await hazardService.voidHazard(showDeleteConfirm.id, voidReason);
   ```

2. **服务层**：`src/services/hazard.service.ts` 的 `voidHazard` 方法
   ```typescript
   async voidHazard(id: string, reason: string) {
     return api.post('/api/hazards/void', { hazardId: id, reason });
   }
   ```

3. **后端API**：`src/app/api/hazards/void/route.ts`
   ```typescript
   const { hazardId, reason } = body;
   if (!hazardId || !reason) {
     return NextResponse.json(
       { error: '缺少必要参数：hazardId 和 reason' },
       { status: 400 }
     );
   }
   ```

### 根本原因

**潜在的参数传递问题**：
- 如果 `showDeleteConfirm.id` 或 `voidReason` 为 `undefined`，JavaScript 的 `JSON.stringify()` 会忽略值为 `undefined` 的属性
- 这导致请求体中缺少必要的参数，服务器验证失败

**示例**：
```javascript
JSON.stringify({ hazardId: undefined, reason: undefined })
// 结果: "{}"

JSON.stringify({ hazardId: "abc", reason: undefined })
// 结果: "{"hazardId":"abc"}"
```

## 解决方案

### 1. 前端参数验证增强

在 `src/app/hidden-danger/page.tsx` 的 `confirmDelete` 函数中添加严格的参数验证：

```typescript
const confirmDelete = async () => {
  if (!showDeleteConfirm) return;
  
  const isVoided = showDeleteConfirm.isVoided;
  
  // ✅ 验证隐患ID是否存在
  if (!showDeleteConfirm.id) {
    console.error('[删除隐患] 隐患ID不存在:', showDeleteConfirm);
    toast.error('隐患ID不存在，无法执行删除操作');
    return;
  }
  
  // 如果是未作废的隐患，验证作废原因
  if (!isVoided && (!voidReason || voidReason.trim() === '')) {
    toast.error('请填写作废原因');
    return;
  }
  
  try {
    if (isVoided) {
      // 已作废的隐患 → 硬删除
      console.log('[删除隐患] 执行硬删除，隐患ID:', showDeleteConfirm.id);
      await hazardService.destroyHazard(showDeleteConfirm.id);
      toast.success('隐患已彻底删除');
    } else {
      // 未作废的隐患 → 软删除
      const trimmedReason = voidReason.trim();
      console.log('[删除隐患] 执行软删除，隐患ID:', showDeleteConfirm.id, '原因:', trimmedReason);
      await hazardService.voidHazard(showDeleteConfirm.id, trimmedReason);
      toast.success('隐患已作废');
    }
    
    setShowDeleteConfirm(null);
    setVoidReason('');
    setSelectedHazard(null);
    await refresh();
  } catch (error) {
    console.error(isVoided ? '彻底删除失败:' : '作废失败:', error);
    toast.error(isVoided ? '彻底删除失败，请重试' : '作废失败，请重试');
  }
};
```

### 2. 修复TypeScript类型错误

在 `src/app/api/hazards/void/route.ts` 中，为 Prisma 查询添加明确的 `select` 语句：

```typescript
const updatedHazard = await prisma.hazardRecord.update({
  where: { id: hazardId },
  data: {
    isVoided: true,
    voidReason: reason,
    voidedAt: new Date(),
    voidedBy: voidedByInfo,
    logs: JSON.stringify([voidLog, ...currentLogs])
  },
  select: {
    id: true,
    code: true,
    isVoided: true,
    voidReason: true,
    voidedAt: true,
    voidedBy: true
  }
});
```

### 3. 重新生成Prisma Client

运行以下命令更新Prisma Client类型定义：

```bash
npx prisma generate
```

## 改进点

### 1. 参数验证
- ✅ 在调用API前验证隐患ID是否存在
- ✅ 验证作废原因是否为空（针对软删除）
- ✅ 使用 `trim()` 清理用户输入的空白字符

### 2. 调试能力
- ✅ 添加详细的 `console.log` 输出，记录关键参数值
- ✅ 区分硬删除和软删除的日志输出
- ✅ 记录操作执行路径，便于问题追踪

### 3. 用户体验
- ✅ 提供明确的错误提示信息
- ✅ 在验证失败时提前返回，避免无效的API请求
- ✅ 保持UI状态一致性

### 4. 类型安全
- ✅ 修复Prisma查询的TypeScript类型错误
- ✅ 确保所有字段都有明确的类型定义

## 测试验证

### 测试场景

1. **正常流程 - 软删除（作废）**
   - 操作：选择未作废的隐患，填写作废原因，确认作废
   - 预期：成功作废，显示成功提示，列表刷新

2. **正常流程 - 硬删除（彻底删除）**
   - 操作：选择已作废的隐患，确认彻底删除
   - 预期：成功删除，显示成功提示，列表刷新

3. **异常场景 - 空作废原因**
   - 操作：选择未作废的隐患，不填写作废原因，确认
   - 预期：显示"请填写作废原因"错误提示，不发送API请求

4. **异常场景 - 隐患ID缺失**
   - 操作：在 `showDeleteConfirm.id` 为 `undefined` 时触发删除
   - 预期：显示"隐患ID不存在"错误提示，不发送API请求

## 影响范围

### 修改文件
- `src/app/hidden-danger/page.tsx` - 添加参数验证和调试日志
- `src/app/api/hazards/void/route.ts` - 修复TypeScript类型错误

### 依赖更新
- Prisma Client - 重新生成以同步schema变更

### 向下兼容
- ✅ 完全向下兼容，不影响现有功能
- ✅ 只是增强了验证和错误处理

## 上线检查清单

- [x] 前端参数验证逻辑正确
- [x] 后端API类型定义正确
- [x] Prisma Client已重新生成
- [x] 调试日志已添加
- [x] 错误提示清晰明确
- [x] 测试场景覆盖充分

## 总结

本次修复通过以下措施解决了参数缺失问题：

1. **预防性验证**：在API调用前验证所有必需参数
2. **清晰的错误处理**：提供明确的用户反馈
3. **调试能力增强**：添加详细日志便于问题定位
4. **类型安全保障**：修复TypeScript类型错误，利用编译时检查

这些改进不仅解决了当前问题，还提升了系统的整体健壮性和可维护性。

---

**修复时间**：2026-01-23  
**修复人员**：系统维护团队  
**优先级**：P1（高优先级Bug修复）
