# 隐患派发引擎使用指南

## 概述

`HazardDispatchEngine` 是隐患系统的核心派发引擎，统一管理隐患的派发逻辑，包括：
- 处理人自动匹配
- 抄送人自动匹配
- 状态流转管理
- 派发历史记录

## 核心概念

### 派发动作 (DispatchAction)

```typescript
enum DispatchAction {
  SUBMIT = 'submit',           // 提交上报
  ASSIGN = 'assign',           // 指派整改
  RECTIFY = 'rectify',         // 提交整改
  VERIFY = 'verify',           // 验收闭环
  REJECT = 'reject',           // 驳回
  EXTEND_DEADLINE = 'extend'   // 延期
}
```

### 状态流转图

```
reported (已上报)
  ├─ ASSIGN → assigned (已指派)
  └─ REJECT → closed (已闭环)

assigned (已指派)
  ├─ RECTIFY → rectifying (整改中)
  ├─ REJECT → reported (已上报)
  └─ EXTEND_DEADLINE → assigned (已指派，延期)

rectifying (整改中)
  ├─ VERIFY → verified (已验收)
  └─ REJECT → assigned (已指派)

verified (已验收)
  ├─ VERIFY → closed (已闭环)
  └─ REJECT → rectifying (整改中)

closed (已闭环)
  └─ (无可用操作)
```

## 使用方法

### 1. 基本派发

```typescript
import { HazardDispatchEngine, DispatchAction } from '@/services/hazardDispatchEngine';

// 准备派发上下文
const context = {
  hazard: currentHazard,              // 当前隐患记录
  action: DispatchAction.ASSIGN,      // 派发动作
  operator: {                          // 操作者信息
    id: currentUser.id,
    name: currentUser.name
  },
  workflowSteps: workflowConfig.steps, // 工作流配置
  allUsers: userList,                  // 所有用户列表
  departments: deptList,               // 所有部门列表
  comment: '请尽快处理',              // 可选：备注
  additionalData: {                    // 可选：额外数据
    responsibleId: '12345',
    responsibleName: '张三',
    responsibleDeptId: 'dept001',
    responsibleDeptName: '生产部'
  }
};

// 执行派发
const result = await HazardDispatchEngine.dispatch(context);

if (result.success) {
  console.log('派发成功！');
  console.log('新状态:', result.newStatus);
  console.log('处理人:', result.handlers.userNames);
  console.log('抄送人:', result.ccUsers.userNames);
  
  // 更新隐患记录
  await updateHazard({
    id: hazard.id,
    status: result.newStatus,
    logs: [result.log, ...(hazard.logs || [])],
    ccUsers: result.ccUsers.userIds,
    ccUserNames: result.ccUsers.userNames
  });
} else {
  console.error('派发失败:', result.error);
}
```

### 2. 验证派发合法性

在执行派发前验证操作是否合法：

```typescript
const validation = HazardDispatchEngine.validateDispatch(
  hazard,
  DispatchAction.ASSIGN,
  operator
);

if (!validation.valid) {
  alert(validation.error);
  return;
}

// 继续派发...
```

### 3. 获取可用操作

根据当前状态和用户权限获取可用的操作列表：

```typescript
const availableActions = HazardDispatchEngine.getAvailableActions(
  hazard,
  currentUser
);

// 渲染操作按钮
availableActions.forEach(action => {
  renderButton(action);
});
```

### 4. 批量派发

批量处理多个隐患：

```typescript
const contexts = selectedHazards.map(hazard => ({
  hazard,
  action: DispatchAction.ASSIGN,
  operator: currentUser,
  workflowSteps,
  allUsers,
  departments,
  additionalData: {
    responsibleId: defaultResponsibleId,
    responsibleName: defaultResponsibleName
  }
}));

const results = await HazardDispatchEngine.batchDispatch(contexts);

// 处理结果
results.forEach((result, index) => {
  if (result.success) {
    console.log(`隐患 ${index + 1} 派发成功`);
  } else {
    console.error(`隐患 ${index + 1} 派发失败:`, result.error);
  }
});
```

## 完整示例

### 示例 1：指派整改

```typescript
async function assignHazard(
  hazard: HazardRecord,
  responsible: { id: string; name: string; deptId: string; deptName: string },
  deadline: string,
  requirement: string,
  operator: { id: string; name: string }
) {
  // 1. 验证操作合法性
  const validation = HazardDispatchEngine.validateDispatch(
    hazard,
    DispatchAction.ASSIGN,
    operator
  );

  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // 2. 执行派发
  const result = await HazardDispatchEngine.dispatch({
    hazard,
    action: DispatchAction.ASSIGN,
    operator,
    workflowSteps: await getWorkflowConfig(),
    allUsers: await getAllUsers(),
    departments: await getAllDepartments(),
    comment: requirement,
    additionalData: {
      responsibleId: responsible.id,
      responsibleName: responsible.name,
      responsibleDeptId: responsible.deptId,
      responsibleDeptName: responsible.deptName,
      deadline
    }
  });

  if (!result.success) {
    throw new Error(result.error);
  }

  // 3. 更新数据库
  await updateHazard({
    id: hazard.id,
    status: result.newStatus,
    responsibleId: responsible.id,
    responsibleName: responsible.name,
    responsibleDeptId: responsible.deptId,
    responsibleDeptName: responsible.deptName,
    deadline,
    rectifyRequirement: requirement,
    logs: [result.log, ...(hazard.logs || [])],
    ccUsers: result.ccUsers.userIds,
    ccUserNames: result.ccUsers.userNames
  });

  // 4. 发送通知
  await sendNotifications({
    handlers: result.handlers.userIds,
    ccUsers: result.ccUsers.userIds,
    message: `您有新的隐患需要处理：${hazard.code}`
  });

  return result;
}
```

### 示例 2：提交整改

```typescript
async function submitRectification(
  hazard: HazardRecord,
  rectifyDesc: string,
  rectifyPhotos: string[],
  operator: { id: string; name: string }
) {
  // 1. 验证权限（只有责任人可以提交整改）
  if (operator.id !== hazard.responsibleId) {
    throw new Error('只有责任人可以提交整改');
  }

  // 2. 执行派发
  const result = await HazardDispatchEngine.dispatch({
    hazard,
    action: DispatchAction.RECTIFY,
    operator,
    workflowSteps: await getWorkflowConfig(),
    allUsers: await getAllUsers(),
    departments: await getAllDepartments(),
    comment: '已完成整改',
    additionalData: {
      rectifyDesc,
      rectifyPhotos
    }
  });

  if (!result.success) {
    throw new Error(result.error);
  }

  // 3. 更新数据库
  await updateHazard({
    id: hazard.id,
    status: result.newStatus,
    rectifyDesc,
    rectifyPhotos,
    rectifyTime: new Date().toISOString(),
    logs: [result.log, ...(hazard.logs || [])],
    ccUsers: result.ccUsers.userIds,
    ccUserNames: result.ccUsers.userNames
  });

  // 4. 发送通知
  await sendNotifications({
    handlers: result.handlers.userIds,
    ccUsers: result.ccUsers.userIds,
    message: `隐患 ${hazard.code} 已提交整改，请验收`
  });

  return result;
}
```

### 示例 3：验收闭环

```typescript
async function verifyHazard(
  hazard: HazardRecord,
  passed: boolean,
  comment: string,
  operator: { id: string; name: string }
) {
  const action = passed ? DispatchAction.VERIFY : DispatchAction.REJECT;

  // 执行派发
  const result = await HazardDispatchEngine.dispatch({
    hazard,
    action,
    operator,
    workflowSteps: await getWorkflowConfig(),
    allUsers: await getAllUsers(),
    departments: await getAllDepartments(),
    comment,
    additionalData: passed ? {
      verifierId: operator.id,
      verifierName: operator.name
    } : {
      rejectReason: comment
    }
  });

  if (!result.success) {
    throw new Error(result.error);
  }

  // 更新数据库
  const updates: any = {
    id: hazard.id,
    status: result.newStatus,
    logs: [result.log, ...(hazard.logs || [])],
    ccUsers: result.ccUsers.userIds,
    ccUserNames: result.ccUsers.userNames
  };

  if (passed) {
    updates.verifierId = operator.id;
    updates.verifierName = operator.name;
    updates.verifyTime = new Date().toISOString();
  } else {
    updates.rejectReason = comment;
  }

  await updateHazard(updates);

  // 发送通知
  await sendNotifications({
    handlers: result.handlers.userIds,
    ccUsers: result.ccUsers.userIds,
    message: passed 
      ? `隐患 ${hazard.code} 验收通过，已闭环`
      : `隐患 ${hazard.code} 验收不通过，已驳回`
  });

  return result;
}
```

## 与现有系统集成

### 在 API 路由中使用

```typescript
// src/app/api/hazards/dispatch/route.ts
import { NextResponse } from 'next/server';
import { HazardDispatchEngine, DispatchAction } from '@/services/hazardDispatchEngine';

export async function POST(request: Request) {
  const body = await request.json();
  const { hazardId, action, operator, additionalData, comment } = body;

  // 获取隐患记录
  const hazard = await getHazardById(hazardId);
  
  // 获取必要数据
  const [workflowConfig, allUsers, departments] = await Promise.all([
    getWorkflowConfig(),
    getAllUsers(),
    getAllDepartments()
  ]);

  // 执行派发
  const result = await HazardDispatchEngine.dispatch({
    hazard,
    action,
    operator,
    workflowSteps: workflowConfig.steps,
    allUsers,
    departments,
    comment,
    additionalData
  });

  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: 400 }
    );
  }

  // 更新隐患记录
  await updateHazard({
    id: hazardId,
    status: result.newStatus,
    logs: [result.log, ...(hazard.logs || [])],
    ccUsers: result.ccUsers.userIds,
    ccUserNames: result.ccUsers.userNames,
    ...additionalData
  });

  return NextResponse.json(result);
}
```

### 在组件中使用

```typescript
// 在隐患详情组件中
import { HazardDispatchEngine, DispatchAction } from '@/services/hazardDispatchEngine';

function HazardDetailModal({ hazard, currentUser, onUpdate }) {
  const [loading, setLoading] = useState(false);

  // 获取可用操作
  const availableActions = HazardDispatchEngine.getAvailableActions(
    hazard,
    currentUser
  );

  const handleDispatch = async (action: DispatchAction, data: any) => {
    setLoading(true);
    try {
      const result = await fetch('/api/hazards/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hazardId: hazard.id,
          action,
          operator: {
            id: currentUser.id,
            name: currentUser.name
          },
          additionalData: data.additionalData,
          comment: data.comment
        })
      });

      if (!result.ok) {
        throw new Error('派发失败');
      }

      const dispatchResult = await result.json();
      
      // 刷新数据
      onUpdate();
      
      // 显示成功消息
      toast.success('操作成功');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* 渲染可用操作按钮 */}
      {availableActions.includes(DispatchAction.ASSIGN) && (
        <Button onClick={() => handleAssign()}>
          指派整改
        </Button>
      )}
      {availableActions.includes(DispatchAction.RECTIFY) && (
        <Button onClick={() => handleRectify()}>
          提交整改
        </Button>
      )}
      {/* ... 其他操作 ... */}
    </div>
  );
}
```

## 注意事项

1. **权限控制**：`getAvailableActions` 提供了基本的权限检查，但在实际使用中可能需要根据业务需求扩展。

2. **错误处理**：始终检查 `result.success` 和 `result.error`，妥善处理错误情况。

3. **事务性**：派发操作涉及多个步骤（匹配、记录、通知等），建议在数据库层面使用事务确保一致性。

4. **通知发送**：派发成功后，记得向处理人和抄送人发送通知。

5. **日志记录**：所有派发操作都会自动生成日志，确保将日志保存到数据库中。

## 扩展建议

1. **添加更多派发动作**：根据业务需求添加新的 `DispatchAction`。

2. **自定义权限检查**：在 `validateDispatch` 中添加更复杂的权限逻辑。

3. **集成通知系统**：在派发成功后自动发送站内信、邮件、短信等通知。

4. **添加审批流**：对于某些操作（如驳回、延期），可以添加审批流程。

5. **数据分析**：基于派发日志进行数据分析，如平均处理时间、驳回率等。
