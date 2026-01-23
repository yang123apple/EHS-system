# 隐患删除参数传递 Bug 修复报告

## 问题描述

在隐患详情弹窗中点击删除按钮时，出现以下错误：

```
缺少必要参数：hazardId 和 reason
src/lib/apiClient.ts (220:11) @ ApiClient.handleResponseError
```

调用栈显示：
- `ApiClient.handleResponseError` → `ApiClient.post` → `confirmDelete` (page.tsx:262)

## 根本原因分析

### 问题定位过程

1. **初步排查**：在 `page.tsx` 的 `confirmDelete` 函数中添加调试日志
2. **关键发现**：调试日志显示 `showDeleteConfirm` 是字符串而不是对象
   ```
   [删除隐患] 隐患ID不存在，完整对象: "cmkpimdjb00034ew4prpey7qf"
   ```
3. **追溯源头**：检查 `onDelete` 的调用链

### 参数传递链分析

```
HazardDetailModal (index.tsx:109)
  ↓ onClick={() => onDelete(hazard.id)}  ❌ 传递字符串ID
  ↓
page.tsx setShowDeleteConfirm(hazard)
  ↓ showDeleteConfirm = "cmkpimdjb00034ew4prpey7qf" (字符串)
  ↓
confirmDelete() 访问 showDeleteConfirm.id
  ↓ undefined (字符串没有 id 属性)
  ↓
验证失败: !showDeleteConfirm.id === true
```

### 根本原因

**HazardDetailModal/index.tsx** 第 109 行存在错误调用：

```typescript
// ❌ 错误：传递字符串 ID
<button onClick={() => onDelete(hazard.id)} ...>

// ✅ 正确：应该传递完整对象
<button onClick={() => onDelete(hazard)} ...>
```

这导致：
1. `page.tsx` 的 `handleDelete` 函数接收到字符串而不是对象
2. `showDeleteConfirm` 状态被设置为字符串 `"cmkpimdjb00034ew4prpey7qf"`
3. `confirmDelete` 函数尝试访问 `showDeleteConfirm.id` 时得到 `undefined`
4. 参数验证失败，终止删除操作

### 为什么 JSON.stringify 导致空对象

当参数为 `undefined` 时：
```javascript
JSON.stringify({ hazardId: undefined, reason: undefined })
// 返回: "{}" (空对象)
```

这解释了为什么后端 API 报告"缺少必要参数"。

## 修复方案

### 修复内容

**文件**: `src/app/hidden-danger/_components/modals/HazardDetailModal/index.tsx`

**修改位置**: 第 109 行

```diff
- <button onClick={() => onDelete(hazard.id)} className="text-red-500 p-1.5 lg:p-2 hover:bg-red-50 rounded-lg transition-colors">
+ <button onClick={() => onDelete(hazard)} className="text-red-500 p-1.5 lg:p-2 hover:bg-red-50 rounded-lg transition-colors">
```

### 修复后的参数传递链

```
HazardDetailModal (index.tsx:109)
  ↓ onClick={() => onDelete(hazard)}  ✅ 传递完整对象
  ↓
page.tsx setShowDeleteConfirm(hazard)
  ↓ showDeleteConfirm = { id: "xxx", code: "YH-xxx", ... } (对象)
  ↓
confirmDelete() 访问 showDeleteConfirm.id
  ↓ "cmkpimdjb00034ew4prpey7qf" (正确的ID)
  ↓
参数验证通过
  ↓
成功调用 hazardService.voidHazard(id, reason)
```

## 相关代码审查

### 1. page.tsx 中的 handleDelete 函数

```typescript
const handleDelete = (hazard: HazardRecord) => {
  setShowDeleteConfirm(hazard); // ✅ 期望接收对象
};
```

### 2. HazardDataTable.tsx 中的正确用法

```typescript
// ✅ 表格中的删除按钮正确传递了完整对象
<button onClick={(e) => {
  e.stopPropagation(); 
  onDelete(h); // 传递完整的 HazardRecord 对象
}}>
```

### 3. confirmDelete 函数的类型期望

```typescript
const confirmDelete = async () => {
  if (!showDeleteConfirm) return;
  
  // 需要访问对象属性
  const isVoided = showDeleteConfirm.isVoided;
  
  // 验证隐患ID
  if (!showDeleteConfirm.id) {
    toast.error('隐患ID不存在，无法执行删除操作');
    return;
  }
  
  // 调用服务层
  if (isVoided) {
    await hazardService.destroyHazard(showDeleteConfirm.id);
  } else {
    await hazardService.voidHazard(showDeleteConfirm.id, voidReason.trim());
  }
};
```

## 测试验证

### 测试场景

1. **软删除（作废）**
   - 从详情弹窗点击删除按钮
   - 验证能否正确识别隐患状态（isVoided）
   - 验证参数能否正确传递到后端 API

2. **硬删除（彻底删除）**
   - 对已作废隐患点击删除按钮
   - 验证能否执行硬删除操作

### 预期结果

- ✅ 参数验证通过
- ✅ 正确识别隐患状态（作废 vs 未作废）
- ✅ 成功调用相应的 API（/api/hazards/void 或 /api/hazards/destroy）
- ✅ 删除操作成功完成

## 经验教训

### 1. 类型一致性的重要性

在整个调用链中保持参数类型一致：
- 组件间传递：完整对象
- 服务层调用：仅传递必要的 ID 和参数
- API 调用：明确的请求体结构

### 2. 调试策略

- 使用 `console.log` 验证参数类型和值
- 检查完整的调用链，而不只是错误发生的位置
- 对比相同功能的不同实现（如表格 vs 详情弹窗）

### 3. 参数验证

在关键函数入口添加参数验证：
```typescript
if (!showDeleteConfirm.id) {
  console.error('[删除隐患] 隐患ID不存在', showDeleteConfirm);
  return;
}
```

### 4. TypeScript 类型检查

虽然使用了 TypeScript，但 `any` 类型会绕过类型检查：
```typescript
// ⚠️ any 类型无法捕获此类错误
export default function HazardDetailModal({ hazard, onDelete }: any)

// ✅ 应该使用明确的类型定义
interface HazardDetailModalProps {
  hazard: HazardRecord;
  onDelete: (hazard: HazardRecord) => void;
  // ...
}
```

## 后续优化建议

1. **添加类型定义**
   - 为 `HazardDetailModal` 组件添加明确的 Props 类型
   - 避免使用 `any` 类型

2. **统一参数传递模式**
   - 在所有删除操作中统一使用对象传递
   - 在服务层统一提取 ID

3. **增强错误处理**
   - 在组件层面添加参数验证
   - 提供更友好的错误提示

## 修复时间线

- **发现时间**: 2026/1/23 21:45
- **定位时间**: 2026/1/23 21:50
- **修复时间**: 2026/1/23 21:53
- **总耗时**: 约 8 分钟

## 结论

此 Bug 是由于组件间参数传递不一致导致的：
- **错误**: 传递字符串 ID
- **正确**: 传递完整对象

通过修改一行代码即可修复，但暴露了以下问题：
1. 缺乏统一的参数传递规范
2. 组件 Props 类型定义不够严格
3. 需要加强代码审查和测试覆盖

建议在后续开发中：
- 统一参数传递模式
- 加强 TypeScript 类型约束
- 完善单元测试覆盖
