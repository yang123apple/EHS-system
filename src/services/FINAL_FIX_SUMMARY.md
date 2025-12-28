# 隐患派发逻辑修复总结

## 问题描述

用户反馈：所有隐患处理步骤都由同一个用户完成，没有按照工作流配置自动派发给不同的处理人。

## 根本原因分析

经过深入排查，发现了以下关键问题：

### 1. 派发引擎未被正确使用
虽然创建了 `HazardDispatchEngine`，但在实际流程中：
- `useHazardWorkflow.ts` 调用了派发引擎
- **但是**：派发引擎返回的处理人信息**没有被写入隐患记录**
- 导致每次操作后，隐患的 `responsibleId`、`verifierId` 等字段保持为空或不更新

### 2. 状态流转步骤ID映射错误
配置文件 `hazard-workflow.json` 中的步骤ID为：
- `report` - 上报
- `assign` - 指派
- `rectify` - 整改
- `verify` - 验收

但派发引擎的状态流转映射不正确：
- 指派动作（ASSIGN）后应该匹配 `rectify` 步骤的处理人（整改责任人）
- 而不是 `assign` 步骤的处理人（指派人）

### 3. 固定策略（fixed）的匹配逻辑不完善
`rectify` 步骤配置为：
```json
{
  "handlerStrategy": {
    "type": "fixed",
    "description": "执行人：整改责任人（系统自动）",
    "fixedUsers": []
  }
}
```

但 `handler-matcher.ts` 中的 `matchFixed` 函数：
- 只检查 `fixedUsers` 数组和 `userId` 字段
- 没有根据 `description` 自动推断应该匹配责任人

## 修复方案

### 修复 1：useHazardWorkflow.ts - 将派发引擎结果写入隐患记录

**文件**: `src/app/hidden-danger/_hooks/useHazardWorkflow.ts`

在构建更新数据时，增加逻辑将派发引擎匹配的处理人写入对应字段：

```typescript
// 【核心修复】根据不同动作，将派发引擎匹配的处理人写入对应字段
if (result.handlers.userIds.length > 0) {
  const handlerId = result.handlers.userIds[0];
  const handlerName = result.handlers.userNames[0];
  
  switch (action) {
    case 'assign':
      // 指派整改：如果payload中没有手动指定责任人，使用派发引擎匹配的
      if (!payload?.responsibleId && handlerId) {
        updates.responsibleId = handlerId;
        updates.responsibleName = handlerName;
        // 填充部门信息
        const handler = allUsers.find(u => u.id === handlerId);
        if (handler) {
          updates.responsibleDeptId = handler.department;
          updates.responsibleDeptName = departments.find(d => d.id === handler.department)?.name || '';
        }
      }
      break;
      
    case 'finish_rectify':
      // 提交整改：自动分配验收人
      if (handlerId) {
        updates.verifierId = handlerId;
        updates.verifierName = handlerName;
      }
      break;
  }
}
```

### 修复 2：hazardDispatchEngine.ts - 修正状态流转映射

**文件**: `src/services/hazardDispatchEngine.ts`

修正 `getTransition` 方法中的步骤ID映射：

```typescript
'reported': {
  [DispatchAction.ASSIGN]: { 
    newStatus: 'assigned', 
    nextStepId: 'rectify'  // 修改：指派后进入整改阶段，匹配整改责任人
  }
}
```

**关键变化**：
- 从 `nextStepId: 'assign'` 改为 `nextStepId: 'rectify'`
- 这样指派操作时会使用 `rectify` 步骤的处理人策略

### 修复 3：handler-matcher.ts - 增强固定策略匹配

**文件**: `src/app/hidden-danger/_utils/handler-matcher.ts`

1. **修改参数传递**：将完整的 `handlerStrategy` 传递给匹配器，而不仅仅是 `config`
```typescript
// 将整个 handlerStrategy 传递下去，包括 description、fixedUsers 等
const config = step.handlerStrategy;
```

2. **增加描述自动推断**：在 `matchFixed` 函数中增加根据描述匹配的逻辑
```typescript
// 6. 【关键修复】如果配置为空，根据描述自动推断
if (config?.description) {
  // 如果描述中提到"责任人"或"整改"
  if ((config.description.includes('责任人') || config.description.includes('整改')) 
      && hazard.responsibleId) {
    const responsible = allUsers.find(u => u.id === hazard.responsibleId);
    if (responsible) {
      console.log('[handler-matcher] 根据描述自动匹配责任人:', responsible.name);
      return [responsible];
    }
  }
}
```

## 修复后的工作流程

### 1. 指派整改（assign 动作）
1. 用户在 `AssignForm` 中选择责任人（或使用智能匹配）
2. 调用 `processAction('assign', hazard, data)` 
3. 派发引擎：
   - 状态：`reported` → `assigned`
   - 查找步骤：`rectify`（整改步骤）
   - 匹配处理人：根据 `rectify` 步骤的 `fixed` 策略，通过 description 自动匹配责任人
4. `useHazardWorkflow`：
   - 如果用户手动选择了责任人（payload.responsibleId存在），使用用户选择
   - 如果没有手动选择，使用派发引擎匹配的结果
   - 将责任人信息写入隐患记录

### 2. 提交整改（finish_rectify 动作）
1. 责任人提交整改结果
2. 调用 `processAction('finish_rectify', hazard, data)`
3. 派发引擎：
   - 状态：`rectifying` → `verified`
   - 查找步骤：`verify`（验收步骤）
   - 匹配处理人：根据 `verify` 步骤的 `fixed` 策略，匹配固定的验收人
4. `useHazardWorkflow`：
   - 自动将派发引擎匹配的验收人写入 `verifierId`、`verifierName`

### 3. 验收闭环（verify_pass 动作）
1. 验收人验收通过
2. 调用 `processAction('verify_pass', hazard, data)`
3. 派发引擎：
   - 状态：`verified` → `closed`
   - 完成闭环

## 验证方法

### 1. 测试指派流程
```
1. 上报一个隐患
2. 点击"指派整改"
3. 查看浏览器控制台日志：
   - 应该看到 "🚀 使用派发引擎处理"
   - 应该看到 "🎯 自动填充责任人: xxx"
4. 提交后检查隐患详情，responsibleId 和 responsibleName 应该已填充
```

### 2. 测试整改提交
```
1. 以责任人身份登录
2. 提交整改
3. 查看控制台日志：
   - 应该看到 "🎯 自动分配验收人: xxx"
4. 检查隐患详情，verifierId 和 verifierName 应该已填充
```

### 3. 测试验收流程
```
1. 以验收人身份登录（应该是配置中的固定用户）
2. 进行验收操作
3. 验证隐患状态正确变更为 closed
```

## 配置检查清单

确保 `data/hazard-workflow.json` 配置正确：

### rectify 步骤（整改）
```json
{
  "id": "rectify",
  "handlerStrategy": {
    "type": "fixed",
    "description": "执行人：整改责任人（系统自动）",
    "fixedUsers": []
  }
}
```
- ✅ description 中包含"责任人"关键词
- ✅ 匹配器会根据 description 自动匹配 hazard.responsibleId

### verify 步骤（验收）
```json
{
  "id": "verify",
  "handlerStrategy": {
    "type": "fixed",
    "description": "默认：管理员角色",
    "fixedUsers": [
      { "userId": "77010550", "userName": "孙斌" },
      { "userId": "33641446", "userName": "杨光" }
    ]
  }
}
```
- ✅ fixedUsers 数组配置了验收人
- ✅ 匹配器会返回这些固定用户

## 总结

核心问题是**派发引擎的结果没有被正确应用到隐患记录中**。修复包括三个方面：

1. **数据写入**：确保派发引擎匹配的处理人被写入隐患记录
2. **流程映射**：修正状态流转时的步骤ID映射
3. **智能匹配**：增强固定策略的自动推断能力

修复后，系统将能够：
- ✅ 指派时自动匹配或使用手动选择的责任人
- ✅ 提交整改时自动分配验收人
- ✅ 每个步骤自动匹配抄送人
- ✅ 完整记录操作日志

所有操作都会在控制台输出详细日志，便于验证和调试。
