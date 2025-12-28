# 隐患派发逻辑修复说明

## 🐛 问题描述

在使用隐患系统时，虽然配置了工作流的处理人策略（如"上报人主管"、"责任人"等），但实际执行时所有步骤都由同一个用户完成，没有按照配置的流程正确派发给不同的处理人。

## 🔍 问题根源

1. **未使用派发引擎**：
   - 原来的 `useHazardWorkflow.ts` 只实现了抄送人匹配
   - 处理人需要手动选择，完全没有使用工作流配置中的 `handlerStrategy`
   - 状态流转是硬编码的，没有动态匹配处理人

2. **步骤ID不匹配**：
   - 派发引擎中的步骤ID与 `hazard-workflow.json` 配置文件不一致
   - 导致无法找到正确的工作流步骤配置

## ✅ 修复方案

### 1. 集成派发引擎

**修改文件**：`src/app/hidden-danger/_hooks/useHazardWorkflow.ts`

**修改内容**：
- 移除了旧的抄送匹配逻辑
- 引入 `HazardDispatchEngine` 统一处理派发
- 自动匹配处理人和抄送人
- 使用配置的工作流策略

**关键代码**：
```typescript
// 使用派发引擎
const result = await HazardDispatchEngine.dispatch({
  hazard,
  action: dispatchAction,
  operator: {
    id: user?.id || 'system',
    name: user?.name || '系统'
  },
  workflowSteps: workflowConfig.steps,
  allUsers,
  departments,
  comment: payload?.comment,
  additionalData: payload
});

// 派发结果包含：
// - 自动匹配的处理人（result.handlers）
// - 自动匹配的抄送人（result.ccUsers）
// - 新状态（result.newStatus）
// - 操作日志（result.log）
```

### 2. 修复步骤ID映射

**修改文件**：`src/services/hazardDispatchEngine.ts`

**修改内容**：
- 修正状态到步骤ID的映射关系
- 确保与 `data/hazard-workflow.json` 中的步骤ID一致

**步骤ID映射表**：
```typescript
{
  'reported': 'report',      // 上报步骤
  'assigned': 'assign',      // 指派步骤
  'rectifying': 'rectify',   // 整改步骤
  'verified': 'verify',      // 验收步骤
  'closed': 'verify'         // 已闭环
}
```

**状态流转表**：
```typescript
'reported' + ASSIGN → 'assigned' (nextStepId: 'assign')
'assigned' + RECTIFY → 'rectifying' (nextStepId: 'rectify')
'rectifying' + RECTIFY → 'verified' (nextStepId: 'verify')
'verified' + VERIFY → 'closed' (nextStepId: 'verify')
```

## 🎯 修复后的工作流程

### 1. 指派整改（reported → assigned）

**操作**：管理员点击"确认并下发任务"

**派发引擎执行**：
1. 状态流转：`reported` → `assigned`
2. 查找步骤：`assign` （开始整改）
3. 匹配处理人：根据 `assign` 步骤的 `handlerStrategy` 自动匹配
   - 如果配置为 `reporter_manager`，自动找到上报人的主管
   - 如果配置为 `fixed`，使用配置的固定人员
4. 匹配抄送人：根据 `assign` 步骤的 `ccRules` 自动匹配
5. 生成日志：记录处理人和抄送人

**结果**：下一步处理人自动匹配，无需手动选择

### 2. 提交整改（assigned → rectifying → verified）

**操作**：责任人点击"提交整改"

**派发引擎执行**：
1. 状态流转：`rectifying` → `verified`
2. 查找步骤：`verify` （验收闭环）
3. 匹配处理人：根据 `verify` 步骤的 `handlerStrategy` 自动匹配验收人
   - 如果配置为 `fixed`，自动匹配配置的验收人
   - 如果配置为 `reporter_manager`，自动匹配上报人主管
4. 匹配抄送人：根据 `verify` 步骤的 `ccRules` 自动匹配
5. 生成日志

**结果**：验收人自动匹配，整改信息自动记录

### 3. 验收闭环（verified → closed）

**操作**：验收人点击"验收通过"

**派发引擎执行**：
1. 状态流转：`verified` → `closed`
2. 查找步骤：`verify`
3. 匹配抄送人：通知相关人员隐患已闭环
4. 生成日志

**结果**：隐患闭环，所有相关人员收到通知

## 📊 配置示例

### hazard-workflow.json 配置

```json
{
  "version": 4,
  "steps": [
    {
      "id": "assign",
      "name": "开始整改",
      "handlerStrategy": {
        "type": "reporter_manager",  // 自动匹配上报人主管
        "approvalMode": "OR"
      },
      "ccRules": [
        {
          "type": "responsible_manager",  // 抄送责任人主管
          "config": {}
        }
      ]
    },
    {
      "id": "rectify",
      "name": "提交整改",
      "handlerStrategy": {
        "type": "fixed",  // 固定处理人（整改责任人）
        "fixedUsers": []
      },
      "ccRules": [...]
    },
    {
      "id": "verify",
      "name": "验收闭环",
      "handlerStrategy": {
        "type": "fixed",  // 固定验收人
        "fixedUsers": [
          { "userId": "77010550", "userName": "孙斌" },
          { "userId": "33641446", "userName": "杨光" }
        ]
      },
      "ccRules": [...]
    }
  ]
}
```

## 🔧 验证方法

### 1. 测试指派流程

```javascript
// 1. 创建隐患（状态：reported）
// 2. 点击"指派整改"
// 3. 查看控制台日志：
console.log('🚀 使用派发引擎处理:', {
  action: 'assign',
  dispatchAction: 'assign',
  hazardId: 'xxx',
  operator: '管理员'
});

console.log('✅ 派发成功:', {
  newStatus: 'assigned',
  handlers: ['张三'],  // 自动匹配的处理人
  ccUsers: ['李四', '王五']  // 自动匹配的抄送人
});
```

### 2. 检查处理人匹配

在浏览器控制台查看：
```
[handler-matcher] 开始匹配处理人: { strategy: 'reporter_manager', ... }
[handler-matcher] 匹配到上报人部门主管: 张三
```

### 3. 检查抄送人匹配

在浏览器控制台查看：
```
[cc-matcher] 开始匹配抄送人主管
[cc-matcher] 匹配到部门负责人: 李四
```

## 📝 注意事项

1. **工作流配置必须正确**：
   - 步骤ID必须为：`report`, `assign`, `rectify`, `verify`
   - `handlerStrategy` 必须配置有效的策略
   - `ccRules` 可以为空数组

2. **部门数据必须完整**：
   - 部门必须配置 `managerId`（负责人ID）
   - 用户必须有 `departmentId` 字段

3. **用户数据必须完整**：
   - 必须包含 `id`, `name`, `departmentId`
   - 角色/职位信息用于某些匹配策略

4. **日志记录**：
   - 所有派发操作都会生成详细日志
   - 日志包含处理人和抄送人信息
   - 便于追溯和审计

## 🚀 后续优化建议

1. **添加更多匹配策略**：
   - 基于隐患类型的智能路由
   - 基于区域的自动分配
   - 基于工作量的负载均衡

2. **增强权限控制**：
   - 细粒度的操作权限
   - 基于角色的访问控制
   - 审批流程集成

3. **通知系统集成**：
   - 自动发送站内信
   - 邮件/短信通知
   - 微信/钉钉推送

4. **数据分析**：
   - 处理效率统计
   - 派发准确率分析
   - 瓶颈识别

## 📚 相关文档

- [派发引擎架构](./HAZARD_DISPATCH_ARCHITECTURE.md)
- [派发引擎使用指南](./hazardDispatchEngine.usage.md)
- [处理人匹配器](../app/hidden-danger/_utils/handler-matcher.ts)
- [抄送人匹配器](../app/hidden-danger/_utils/cc-matcher.ts)
