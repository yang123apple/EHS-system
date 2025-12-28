# 隐患派发系统架构说明

## 📋 概述

本文档说明了重新整理后的隐患派发逻辑架构，旨在提供清晰、可维护、可扩展的派发系统。

## 🎯 重新整理的目标

1. **统一派发入口**：通过 `HazardDispatchEngine` 统一管理所有派发逻辑
2. **清晰的职责分离**：处理人匹配、抄送人匹配、状态流转各司其职
3. **可追溯性**：完整记录派发历史和状态变更
4. **易于扩展**：模块化设计，便于添加新功能
5. **类型安全**：完整的 TypeScript 类型定义

## 🏗️ 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                  HazardDispatchEngine                    │
│                     (派发引擎核心)                        │
│  - 状态流转管理                                          │
│  - 派发编排                                              │
│  - 日志生成                                              │
│  - 权限验证                                              │
└────────────┬────────────────────────┬────────────────────┘
             │                        │
     ┌───────▼────────┐      ┌───────▼────────┐
     │ handler-matcher │      │  cc-matcher    │
     │  (处理人匹配)   │      │  (抄送人匹配)  │
     │                 │      │                 │
     │ - 固定人员      │      │ - 固定人员      │
     │ - 上报人        │      │ - 上报人主管    │
     │ - 责任人        │      │ - 责任人主管    │
     │ - 部门主管      │      │ - 处理人主管    │
     │ - 职位匹配      │      │ - 区域匹配      │
     │ - 区域匹配      │      │ - 类型匹配      │
     │ - 类型匹配      │      │ - 角色匹配      │
     │ - 风险匹配      │      └────────────────┘
     └─────────────────┘
             │
             │
     ┌───────▼────────┐
     │departmentUtils │
     │  (部门工具)     │
     │                 │
     │ - 查找部门主管  │
     │ - 查找部门成员  │
     │ - 部门结构遍历  │
     └─────────────────┘
```

## 📦 核心模块

### 1. HazardDispatchEngine (派发引擎)
**位置**: `src/services/hazardDispatchEngine.ts`

**职责**:
- 统一管理派发流程
- 执行状态流转
- 协调处理人和抄送人匹配
- 生成派发日志
- 验证派发合法性

**核心方法**:
```typescript
// 执行派发
static async dispatch(context: DispatchContext): Promise<DispatchResult>

// 批量派发
static async batchDispatch(contexts: DispatchContext[]): Promise<DispatchResult[]>

// 验证派发合法性
static validateDispatch(hazard, action, operator): { valid: boolean; error?: string }

// 获取可用操作
static getAvailableActions(hazard, operator): DispatchAction[]
```

### 2. handler-matcher (处理人匹配器)
**位置**: `src/app/hidden-danger/_utils/handler-matcher.ts`

**职责**:
- 根据工作流策略匹配处理人
- 支持多种匹配策略（固定、上报人、责任人、部门主管等）

**核心方法**:
```typescript
export async function matchHandler(params: {
  hazard: any;
  step: any;
  allUsers: SimpleUser[];
  departments: Department[];
}): Promise<{
  success: boolean;
  userNames: string[];
  matchedBy?: string;
  error?: string;
}>
```

**支持的策略**:
- `fixed`: 固定处理人
- `reporter`: 上报人
- `reporter_manager`: 上报人部门主管
- `responsible`: 责任人
- `responsible_manager`: 责任人主管
- `assigned_department_manager`: 责任部门主管
- `dept_manager`: 指定部门主管
- `role`: 职位匹配
- `location_match`: 区域匹配
- `type_match`: 类型匹配
- `risk_match`: 风险等级匹配

### 3. cc-matcher (抄送人匹配器)
**位置**: `src/app/hidden-danger/_utils/cc-matcher.ts`

**职责**:
- 根据抄送规则匹配抄送人
- 支持多规则组合

**核心方法**:
```typescript
export async function matchAllCCRules(
  hazard: HazardRecord,
  ccRules: HazardCCRule[],
  allUsers: SimpleUser[],
  departments: any[],
  reporter?: SimpleUser,
  handler?: SimpleUser
): Promise<{
  userIds: string[];
  userNames: string[];
  details: any[];
}>
```

**支持的规则类型**:
- `fixed_users`: 固定人员
- `reporter`: 上报人
- `reporter_manager`: 上报人主管
- `responsible`: 责任人
- `responsible_manager`: 责任人主管
- `handler_manager`: 处理人主管
- `dept_by_location`: 按区域匹配部门
- `dept_by_type`: 按类型匹配部门
- `role_match`: 角色匹配

### 4. departmentUtils (部门工具)
**位置**: `src/utils/departmentUtils.ts`

**职责**:
- 提供部门相关的通用工具函数
- 查找部门负责人
- 查找部门成员

**核心方法**:
```typescript
// 获取部门负责人
export function getDepartmentManager(
  deptId: string,
  departments: Department[],
  users: SimpleUser[]
): SimpleUser | null

// 获取部门所有成员
export function getDepartmentUsers(
  deptId: string,
  departments: Department[],
  users: SimpleUser[]
): SimpleUser[]

// 获取部门信息
export function getDepartmentById(
  deptId: string,
  departments: Department[]
): Department | null
```

## 🔄 派发流程

### 标准派发流程

```
1. 接收派发请求
   ├─ 隐患信息
   ├─ 派发动作
   ├─ 操作者
   └─ 额外数据

2. 验证派发合法性
   ├─ 检查状态流转是否合法
   └─ 检查操作权限

3. 执行状态流转
   ├─ 根据当前状态和动作确定新状态
   └─ 确定下一步骤

4. 匹配处理人
   ├─ 获取步骤配置
   ├─ 根据策略匹配处理人
   └─ 返回处理人列表

5. 匹配抄送人
   ├─ 遍历抄送规则
   ├─ 匹配符合条件的人员
   └─ 去重合并结果

6. 生成派发日志
   ├─ 记录操作者
   ├─ 记录动作和状态变更
   ├─ 记录处理人和抄送人
   └─ 记录备注

7. 返回派发结果
   ├─ 新状态
   ├─ 处理人列表
   ├─ 抄送人列表
   └─ 派发日志
```

### 状态机

```typescript
const transitions = {
  'reported': {
    ASSIGN → 'assigned'    // 指派整改
    REJECT → 'closed'      // 驳回闭环
  },
  'assigned': {
    RECTIFY → 'rectifying'      // 提交整改
    REJECT → 'reported'         // 驳回重新指派
    EXTEND_DEADLINE → 'assigned' // 延期申请
  },
  'rectifying': {
    VERIFY → 'verified'    // 验收通过
    REJECT → 'assigned'    // 驳回重新整改
  },
  'verified': {
    VERIFY → 'closed'      // 最终闭环
    REJECT → 'rectifying'  // 驳回重新验收
  },
  'closed': {}             // 已闭环，无后续操作
}
```

## 📊 数据流

```
┌─────────────┐
│  前端组件    │
└──────┬──────┘
       │
       │ 1. 用户操作 (指派/整改/验收等)
       ▼
┌─────────────────────┐
│  API Route          │
│  /api/hazards/...   │
└──────┬──────────────┘
       │
       │ 2. 调用派发引擎
       ▼
┌──────────────────────────┐
│  HazardDispatchEngine    │
│  - 状态流转               │
│  - 匹配处理人             │
│  - 匹配抄送人             │
│  - 生成日志               │
└──────┬───────────────────┘
       │
       │ 3. 返回派发结果
       ▼
┌─────────────────────┐
│  更新数据库          │
│  - 更新隐患状态      │
│  - 保存日志          │
│  - 更新处理人/抄送人 │
└──────┬──────────────┘
       │
       │ 4. 发送通知
       ▼
┌─────────────────────┐
│  通知系统            │
│  - 站内信            │
│  - 邮件              │
│  - 短信              │
└─────────────────────┘
```

## 🔧 配置管理

### 工作流配置
**位置**: `data/hazard-workflow.json`

```json
{
  "version": 4,
  "steps": [
    {
      "id": "assign",
      "name": "开始整改",
      "handlerStrategy": {
        "type": "reporter_manager",
        "approvalMode": "OR"
      },
      "ccRules": [
        {
          "id": "cc_xxx",
          "type": "responsible_manager",
          "config": {}
        }
      ]
    }
  ]
}
```

### 处理人策略配置

```typescript
{
  type: 'fixed',              // 策略类型
  approvalMode: 'OR',         // 审批模式：OR/AND/CONDITIONAL
  fixedUsers: [               // 固定人员列表
    { userId: '123', userName: '张三' }
  ],
  targetDeptId: 'dept001',    // 目标部门
  roleName: '安全员',         // 职位名称
  locationMatches: [...],     // 区域匹配规则
  typeMatches: [...],         // 类型匹配规则
  riskMatches: [...]          // 风险匹配规则
}
```

### 抄送规则配置

```typescript
{
  id: 'cc_001',
  type: 'fixed_users',
  config: {
    userIds: ['123', '456'],
    userNames: ['张三', '李四']
  },
  description: '固定抄送安全部'
}
```

## 🔐 权限控制

### 操作权限矩阵

| 状态 | 操作 | 允许角色 |
|------|------|----------|
| reported | ASSIGN | 管理员、主管 |
| reported | REJECT | 管理员 |
| assigned | RECTIFY | 责任人 |
| assigned | EXTEND_DEADLINE | 责任人 |
| assigned | REJECT | 管理员 |
| rectifying | VERIFY | 管理员、主管 |
| rectifying | REJECT | 管理员 |
| verified | VERIFY | 管理员 |
| verified | REJECT | 管理员 |

### 权限扩展

可以在 `HazardDispatchEngine.validateDispatch()` 方法中添加更复杂的权限逻辑：

```typescript
static validateDispatch(hazard, action, operator) {
  // 1. 检查状态流转
  const transition = this.getTransition(hazard.status, action);
  
  // 2. 检查角色权限
  if (action === DispatchAction.ASSIGN) {
    if (!['管理员', 'EHS主管'].includes(operator.role)) {
      return { valid: false, error: '无权限指派整改' };
    }
  }
  
  // 3. 检查特定条件
  if (action === DispatchAction.RECTIFY) {
    if (operator.id !== hazard.responsibleId) {
      return { valid: false, error: '只有责任人可以提交整改' };
    }
  }
  
  return { valid: true };
}
```

## 📈 监控与日志

### 派发日志结构

```typescript
{
  operatorName: '张三',
  action: '指派整改',
  time: '2025-12-25T09:00:00Z',
  changes: `指派整改 → 状态变更为"已指派"
处理人: 李四
备注: 请在3天内完成整改`,
  ccUsers: ['77010550', '33641446'],
  ccUserNames: ['孙斌', '杨光']
}
```

### 监控指标

建议监控以下指标：
- 派发成功率
- 平均派发时间
- 匹配失败率
- 各状态停留时间
- 驳回率

## 🚀 使用示例

### 快速开始

```typescript
import { HazardDispatchEngine, DispatchAction } from '@/services/hazardDispatchEngine';

// 指派整改
const result = await HazardDispatchEngine.dispatch({
  hazard,
  action: DispatchAction.ASSIGN,
  operator: currentUser,
  workflowSteps,
  allUsers,
  departments,
  comment: '请尽快处理',
  additionalData: {
    responsibleId: '123',
    responsibleName: '张三'
  }
});

if (result.success) {
  // 更新数据库
  await updateHazard({
    id: hazard.id,
    status: result.newStatus,
    logs: [result.log, ...hazard.logs],
    ccUsers: result.ccUsers.userIds
  });
  
  // 发送通知
  await sendNotifications(result.handlers.userIds, result.ccUsers.userIds);
}
```

详细使用示例请参考：`src/services/hazardDispatchEngine.usage.md`

## 🔄 迁移指南

### 从旧系统迁移

如果您的项目之前使用分散的派发逻辑，可以按以下步骤迁移：

1. **保留现有的 handler-matcher 和 cc-matcher**
   - 无需修改，新引擎会调用它们

2. **替换派发调用点**
   - 将分散的派发逻辑替换为 `HazardDispatchEngine.dispatch()`

3. **更新 API 路由**
   - 创建统一的派发接口 `/api/hazards/dispatch`

4. **更新前端组件**
   - 使用 `getAvailableActions()` 获取可用操作
   - 调用统一的派发接口

5. **测试验证**
   - 验证各种场景下的派发逻辑
   - 确保日志记录正确

## 🎓 最佳实践

1. **始终验证派发合法性**
   ```typescript
   const validation = HazardDispatchEngine.validateDispatch(hazard, action, operator);
   if (!validation.valid) {
     return alert(validation.error);
   }
   ```

2. **妥善处理错误**
   ```typescript
   const result = await HazardDispatchEngine.dispatch(context);
   if (!result.success) {
     console.error('派发失败:', result.error);
     return;
   }
   ```

3. **保存完整日志**
   ```typescript
   logs: [result.log, ...(hazard.logs || [])]
   ```

4. **及时发送通知**
   ```typescript
   await sendNotifications({
     handlers: result.handlers.userIds,
     ccUsers: result.ccUsers.userIds
   });
   ```

5. **使用事务确保一致性**
   ```typescript
   await db.transaction(async (tx) => {
     await tx.updateHazard(...);
     await tx.createNotifications(...);
   });
   ```

## 📝 总结

重新整理后的隐患派发系统具有以下优势：

✅ **统一管理**：所有派发逻辑集中在 `HazardDispatchEngine`  
✅ **清晰架构**：处理人匹配、抄送人匹配、状态流转职责明确  
✅ **易于维护**：模块化设计，便于定位和修改问题  
✅ **可扩展性**：轻松添加新的派发动作和匹配策略  
✅ **类型安全**：完整的 TypeScript 类型定义  
✅ **可追溯性**：完整的派发历史和日志记录  

该架构为隐患管理系统提供了坚实的基础，可以支持未来的业务扩展和优化。
