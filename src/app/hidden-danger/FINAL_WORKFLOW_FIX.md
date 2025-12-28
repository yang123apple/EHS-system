# 隐患工作流完整修复总结

## 用户需求理解

### 正确的业务逻辑

1. **上报隐患**：
   - 用户填写表单，包含**业务数据**：责任部门、责任人、截止日期等
   - 点击"确认并指派整改"提交
   - 系统保存隐患记录（状态：`reported`）

2. **步骤1：上报并指派**（自动执行）：
   - 执行人：**强制为上报人**（系统自动）
   - 抄送：根据配置抄送给固定人员
   - 完成后自动进入步骤2

3. **步骤2：开始整改**：
   - 执行人：根据配置自动匹配（如上报人的主管）
   - 执行人可以点击"开始整改"按钮
   - 抄送：根据配置抄送

4. **步骤3：提交整改**：
   - 执行人：**隐患的责任人**（表单中填写的）
   - 责任人提交整改结果
   - 系统自动匹配验收人
   - 抄送：根据配置抄送

5. **步骤4：验收闭环**：
   - 执行人：根据配置自动匹配（如固定的验收人员）
   - 验收人验收通过或驳回
   - 抄送：根据配置抄送
   - 完成后流程结束

### 关键理解

- **责任部门/责任人**：是隐患的**业务属性**，记录这个隐患归属哪个部门、由谁负责整改
- **流程执行人**：是工作流的**执行角色**，由工作流配置自动匹配，与业务数据分离

## 修复内容

### 1. 上报表单修复（`HazardReportModal.tsx`）

**修改前问题**：
- 使用工作流第一步预测的处理人作为 `responsibleId`
- 导致业务数据被流程数据覆盖

**修改后**：
```typescript
const finalData = {
  type, location, desc, deadline, riskLevel, photos,
  status: 'reported',  // 初始状态为 reported
  // 保留用户填写的责任部门和责任人（业务数据）
  responsibleId,
  responsibleName,
  responsibleDeptId,
  responsibleDeptName,
  // 第一步的抄送人
  ccUsers: firstStepCCUserIds,
  ccUserNames: firstStepCCUserNames,
  logs: [{
    operatorId: user?.id,
    operatorName: user?.name || '系统',
    action: '上报隐患',
    time: new Date().toISOString(),
    changes: `责任部门：${responsibleDeptName}，责任人：${responsibleName}，期限：${deadline}`,
    ccUsers: firstStepCCUserIds,
    ccUserNames: firstStepCCUserNames
  }]
};
```

### 2. 上报后自动执行工作流（`page.tsx`）

**新增逻辑**：
```typescript
const handleReport = async (formData: any) => {
  // 1. 保存隐患基础数据（状态为 reported）
  const newHazard = await hazardService.createHazard({
    ...formData,
    code: hazardCode,
    reporterId: user?.id,
    reporterName: user?.name,
    reportTime: new Date().toISOString(),
  });

  // 2. 自动执行工作流步骤1（上报并指派）
  await processAction('submit', newHazard, {}, user);

  toast.success('隐患上报成功，已自动进入处理流程');
};
```

### 3. 工作流引擎支持 SUBMIT 动作（`useHazardWorkflow.ts`）

**新增动作映射**：
```typescript
const dispatchActionMap: Record<string, DispatchAction> = {
  'submit': DispatchAction.SUBMIT,  // 步骤1：上报并指派
  'assign': DispatchAction.ASSIGN,  // 步骤2：开始整改
  'start_rectify': DispatchAction.RECTIFY,
  'finish_rectify': DispatchAction.RECTIFY,  // 步骤3：提交整改
  'verify_pass': DispatchAction.VERIFY,  // 步骤4：验收通过
  'verify_reject': DispatchAction.REJECT,
  // ...
};
```

### 4. 派发引擎结果优先（`useHazardWorkflow.ts`）

**关键修复**：
```typescript
// 先处理派发引擎匹配的处理人
const dispatchedHandlers: any = {};

if (result.handlers.userIds.length > 0) {
  const handlerId = result.handlers.userIds[0];
  const handlerName = result.handlers.userNames[0];
  
  switch (action) {
    case 'assign':
      dispatchedHandlers.responsibleId = handlerId;
      dispatchedHandlers.responsibleName = handlerName;
      // 填充部门信息...
      break;
      
    case 'finish_rectify':
      dispatchedHandlers.verifierId = handlerId;
      dispatchedHandlers.verifierName = handlerName;
      break;
  }
}

// 构建更新数据：派发引擎结果 > payload
const updates: any = {
  // 基础字段...
  ...payload,  // 其他数据（deadline等）
  ...dispatchedHandlers  // 派发引擎结果（优先级最高）
};
```

### 5. UI调整（`HazardDetailModal/index.tsx`）

**移除手动指派表单**：
```typescript
{/* 待指派状态 - 系统自动处理，用户不需要手动操作 */}
{hazard.status === 'reported' && (
  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
    <p className="text-blue-800 font-medium text-center">
      ⏳ 系统正在自动处理，请稍候...
    </p>
  </div>
)}
```

### 6. 简化 AssignForm（未使用，可删除）

由于 `reported` 状态不再显示 `AssignForm`，该组件已被简化，主要用于文档参考。

## 工作流配置示例

```json
{
  "steps": [
    {
      "id": "report",
      "name": "上报并指派",
      "handlerStrategy": {
        "type": "fixed",
        "description": "执行人：上报人（系统自动）"
      },
      "ccRules": [
        {
          "type": "fixed_users",
          "config": { "userIds": ["77010550", "33641446"] }
        }
      ]
    },
    {
      "id": "assign",
      "name": "开始整改",
      "handlerStrategy": {
        "type": "reporter_manager",
        "description": "执行人：上报人的主管"
      },
      "ccRules": [
        {
          "type": "responsible_manager",
          "description": "抄送：责任人的主管"
        }
      ]
    },
    {
      "id": "rectify",
      "name": "提交整改",
      "handlerStrategy": {
        "type": "fixed",
        "description": "执行人：整改责任人（业务数据）"
      },
      "ccRules": [
        { "type": "reporter" },
        { "type": "responsible" }
      ]
    },
    {
      "id": "verify",
      "name": "验收闭环",
      "handlerStrategy": {
        "type": "fixed",
        "fixedUsers": [
          { "userId": "77010550", "userName": "孙斌" },
          { "userId": "33641446", "userName": "杨光" }
        ]
      },
      "ccRules": [
        { "type": "reporter_manager" },
        { "type": "responsible_manager" }
      ]
    }
  ]
}
```

## 完整流程示例

### 场景：韩晔上报隐患，责任人为李宇航

1. **上报**：
   - 韩晔填写表单：
     - 责任部门：工艺组
     - 责任人：李宇航
     - 截止日期：2025-12-30
   - 点击"确认并指派整改"

2. **步骤1：上报并指派**（自动）：
   - 执行人：韩晔（上报人）
   - 抄送：孙斌、杨光
   - 日志：`韩晔 上报并指派 责任部门：工艺组，责任人：李宇航`

3. **步骤2：开始整改**：
   - 执行人：阚云东（韩晔的主管）
   - 阚云东看到隐患，点击"开始整改"
   - 抄送：李宇航的主管
   - 日志：`阚云东 开始整改任务`

4. **步骤3：提交整改**：
   - 执行人：李宇航（责任人）
   - 李宇航上传照片，填写整改描述，点击"提交整改"
   - 系统自动匹配验收人：孙斌、杨光
   - 抄送：韩晔、李宇航
   - 日志：`李宇航 提交整改 已采取XX措施`

5. **步骤4：验收闭环**：
   - 执行人：孙斌、杨光（固定验收人）
   - 孙斌点击"验收通过"
   - 抄送：韩晔的主管、李宇航的主管
   - 日志：`孙斌 验收通过`
   - 隐患状态：closed

## 验证方法

1. 上报隐患，填写责任人
2. 检查隐患记录：
   - ✅ `responsibleId`、`responsibleName` 应该是表单填写的责任人
   - ✅ 状态应该自动从 `reported` → `assigned`
3. 查看日志：
   - ✅ 应该有"上报并指派"日志（执行人为上报人）
   - ✅ 应该有抄送记录
4. 步骤2执行人应该是上报人的主管
5. 步骤3执行人应该是表单填写的责任人
6. 步骤4执行人应该是配置的固定验收人

## 总结

✅ **已完成**：
1. 分离业务数据（责任人）与流程执行人
2. 上报后自动执行工作流步骤1
3. 所有步骤的执行人完全由工作流配置决定
4. 派发引擎结果优先于用户输入
5. UI简化，移除手动指派界面

✅ **核心原则**：
- 业务数据归业务数据
- 流程执行人由工作流配置自动匹配
- 用户只需填写必要的业务信息
- 系统自动化处理流程流转
