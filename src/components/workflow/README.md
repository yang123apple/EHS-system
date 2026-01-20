# WorkflowStrategySelector - 统一工作流策略选择器

## 概述

`WorkflowStrategySelector` 是一个统一的工作流处理人/审批人选择组件，用于替代隐患管理和作业票管理中各自独立的策略选择逻辑。该组件提供了灵活的配置选项，支持从简单的固定人员选择到复杂的条件判断和表单字段匹配。

## 特性

- ✅ **统一的类型系统**：14种策略类型覆盖所有业务场景
- ✅ **灵活的UI模式**：支持简单模式和高级模式
- ✅ **条件判断支持**：支持复杂的审批条件配置
- ✅ **数据迁移工具**：提供完整的新旧格式转换函数
- ✅ **TypeScript支持**：完整的类型定义和类型安全
- ✅ **可扩展设计**：易于添加新的策略类型

## 策略类型

### 基础策略

| 策略类型 | 说明 | 适用场景 |
|---------|------|---------|
| `fixed` | 固定人员 | 指定固定的处理人列表 |
| `role` | 角色匹配 | 根据角色选择处理人 |
| `reporter` | 上报人 | 选择上报人本人 |
| `responsible` | 责任人 | 选择责任人 |

### 主管类策略

| 策略类型 | 说明 | 适用场景 |
|---------|------|---------|
| `reporter_manager` | 上报人主管 | 上报人的直接主管 |
| `responsible_manager` | 责任人主管 | 责任人的直接主管 |
| `handler_manager` | 上一处理人主管 | 上一节点处理人的主管 |
| `dept_manager` | 部门主管 | 指定部门的主管 |
| `form_field_dept_manager` | 表单字段部门主管 | 从表单字段获取部门后选择主管 |

### 条件匹配策略

| 策略类型 | 说明 | 适用场景 |
|---------|------|---------|
| `form_condition` | 表单条件匹配 | 根据表单字段值匹配（如金额>5000） |
| `location_match` | 区域匹配 | 根据隐患区域匹配处理人 |
| `type_match` | 类型匹配 | 根据隐患类型匹配处理人 |
| `risk_match` | 风险匹配 | 根据风险等级匹配处理人 |

## 快速开始

### 基础使用

```tsx
import { WorkflowStrategySelector } from '@/components/workflow';
import { WorkflowStrategy } from '@/components/workflow/types';
import { useState } from 'react';

function MyComponent() {
  const [strategies, setStrategies] = useState<WorkflowStrategy[]>([]);

  return (
    <WorkflowStrategySelector
      value={strategies}
      onChange={setStrategies}
      mode="simple"
    />
  );
}
```

### 高级模式（带条件判断）

```tsx
import { WorkflowStrategySelector } from '@/components/workflow';
import { WorkflowStrategy, ApprovalMode } from '@/components/workflow/types';
import { useState } from 'react';

function AdvancedComponent() {
  const [strategies, setStrategies] = useState<WorkflowStrategy[]>([]);
  const [approvalMode, setApprovalMode] = useState<ApprovalMode>('OR');

  return (
    <WorkflowStrategySelector
      value={strategies}
      onChange={setStrategies}
      mode="advanced"
      showApprovalMode={true}
      approvalMode={approvalMode}
      onApprovalModeChange={setApprovalMode}
      showConditions={true}
    />
  );
}
```

### 限制可用策略

```tsx
import { WorkflowStrategySelector } from '@/components/workflow';
import { WorkflowStrategyType } from '@/components/workflow/types';

// 只允许固定人员和角色策略
const supportedStrategies: WorkflowStrategyType[] = ['fixed', 'role'];

function LimitedComponent() {
  return (
    <WorkflowStrategySelector
      value={strategies}
      onChange={setStrategies}
      supportedStrategies={supportedStrategies}
    />
  );
}
```

## 数据迁移

### 从隐患管理迁移

```typescript
import { 
  convertHazardConfigToUnified,
  convertUnifiedToHazardConfig 
} from '@/components/workflow/converter';

// 旧格式 -> 新格式
const oldHazardConfig = {
  type: 'fixed' as const,
  userIds: ['user1', 'user2']
};

const newConfig = convertHazardConfigToUnified(oldHazardConfig);

// 新格式 -> 旧格式（如需回退）
const oldFormat = convertUnifiedToHazardConfig(newConfig);
```

### 从作业票管理迁移

```typescript
import { 
  convertWorkPermitConfigToUnified,
  convertUnifiedToWorkPermitConfig 
} from '@/components/workflow/converter';

// 旧格式 -> 新格式
const oldPermitConfig = {
  type: 'form_condition' as const,
  field: 'amount',
  condition: {
    operator: '>',
    value: '5000'
  },
  userIds: ['approver1']
};

const newConfig = convertWorkPermitConfigToUnified(oldPermitConfig);

// 新格式 -> 旧格式（如需回退）
const oldFormat = convertUnifiedToWorkPermitConfig(newConfig);
```

### 批量转换

```typescript
import { 
  convertHazardWorkflowToUnified,
  convertWorkPermitWorkflowToUnified 
} from '@/components/workflow/converter';

// 转换整个工作流配置
const hazardWorkflow = {
  steps: [
    { id: '1', name: '审核', strategies: [...] },
    { id: '2', name: '处理', strategies: [...] }
  ]
};

const unifiedWorkflow = convertHazardWorkflowToUnified(hazardWorkflow);
```

## API 参考

### WorkflowStrategySelector Props

| 属性 | 类型 | 默认值 | 说明 |
|-----|------|--------|------|
| `value` | `WorkflowStrategy[]` | - | 当前策略列表 |
| `onChange` | `(strategies: WorkflowStrategy[]) => void` | - | 策略变更回调 |
| `mode` | `'simple' \| 'advanced'` | `'simple'` | 组件模式 |
| `supportedStrategies` | `WorkflowStrategyType[]` | 所有类型 | 限制可用的策略类型 |
| `showApprovalMode` | `boolean` | `false` | 是否显示审批模式选择 |
| `approvalMode` | `ApprovalMode` | - | 审批模式（OR/AND/CONDITIONAL） |
| `onApprovalModeChange` | `(mode: ApprovalMode) => void` | - | 审批模式变更回调 |
| `showConditions` | `boolean` | `false` | 是否显示条件判断配置 |
| `disabled` | `boolean` | `false` | 是否禁用 |
| `maxStrategies` | `number` | - | 最大策略数量限制 |

### WorkflowStrategy 类型

```typescript
interface WorkflowStrategy {
  id: string;                           // 唯一标识
  type: WorkflowStrategyType;           // 策略类型
  config: WorkflowStrategyConfig;       // 策略配置
  condition?: ConditionConfig;          // 条件配置（可选）
}
```

### ApprovalMode 类型

```typescript
type ApprovalMode = 
  | 'OR'          // 任一审批通过即可
  | 'AND'         // 所有审批都需通过
  | 'CONDITIONAL'; // 根据条件判断
```

## 使用示例

### 示例1：隐患管理 - 简单模式

```tsx
import { WorkflowStrategySelector } from '@/components/workflow';

function HazardHandler() {
  const [strategies, setStrategies] = useState([
    {
      id: '1',
      type: 'reporter_manager' as const,
      config: { level: 1 }
    },
    {
      id: '2',
      type: 'location_match' as const,
      config: {
        rules: [
          { location: '车间A', userIds: ['user1', 'user2'] }
        ]
      }
    }
  ]);

  return (
    <WorkflowStrategySelector
      value={strategies}
      onChange={setStrategies}
      mode="simple"
      supportedStrategies={[
        'fixed',
        'reporter_manager',
        'responsible_manager',
        'location_match',
        'type_match',
        'risk_match'
      ]}
    />
  );
}
```

### 示例2：作业票管理 - 高级模式

```tsx
import { WorkflowStrategySelector } from '@/components/workflow';

function WorkPermitApprover() {
  const [strategies, setStrategies] = useState([
    {
      id: '1',
      type: 'form_condition' as const,
      config: {
        field: 'amount',
        condition: {
          operator: '>',
          value: '5000'
        },
        userIds: ['senior-approver']
      },
      condition: {
        field: 'riskLevel',
        operator: '==',
        value: 'high'
      }
    },
    {
      id: '2',
      type: 'dept_manager' as const,
      config: {
        deptId: 'safety-dept',
        level: 1
      }
    }
  ]);

  return (
    <WorkflowStrategySelector
      value={strategies}
      onChange={setStrategies}
      mode="advanced"
      showApprovalMode={true}
      approvalMode="AND"
      onApprovalModeChange={setApprovalMode}
      showConditions={true}
      supportedStrategies={[
        'fixed',
        'role',
        'dept_manager',
        'form_field_dept_manager',
        'form_condition'
      ]}
    />
  );
}
```

### 示例3：带验证的使用

```tsx
import { WorkflowStrategySelector } from '@/components/workflow';
import { validateConfig } from '@/components/workflow/utils';

function ValidatedComponent() {
  const [strategies, setStrategies] = useState([]);
  const [errors, setErrors] = useState<string[]>([]);

  const handleChange = (newStrategies: WorkflowStrategy[]) => {
    const validationErrors: string[] = [];
    
    newStrategies.forEach((strategy, index) => {
      const error = validateConfig(strategy.type, strategy.config);
      if (error) {
        validationErrors.push(`策略 ${index + 1}: ${error}`);
      }
    });

    setErrors(validationErrors);
    setStrategies(newStrategies);
  };

  return (
    <div>
      <WorkflowStrategySelector
        value={strategies}
        onChange={handleChange}
        mode="advanced"
      />
      {errors.length > 0 && (
        <div className="text-red-500 mt-2">
          {errors.map((error, i) => (
            <div key={i}>{error}</div>
          ))}
        </div>
      )}
    </div>
  );
}
```

## 工具函数

### getStrategyLabel

获取策略类型的显示标签。

```typescript
import { getStrategyLabel } from '@/components/workflow/utils';

const label = getStrategyLabel('fixed'); // "固定人员"
```

### getStrategyDescription

获取策略类型的描述。

```typescript
import { getStrategyDescription } from '@/components/workflow/utils';

const desc = getStrategyDescription('form_condition'); 
// "根据表单字段值进行条件判断"
```

### getDefaultConfig

获取策略类型的默认配置。

```typescript
import { getDefaultConfig } from '@/components/workflow/utils';

const config = getDefaultConfig('fixed'); 
// { userIds: [] }
```

### validateConfig

验证策略配置的有效性。

```typescript
import { validateConfig } from '@/components/workflow/utils';

const error = validateConfig('fixed', { userIds: [] });
// "至少选择一个处理人"
```

## 最佳实践

### 1. 策略组合建议

- **简单场景**：使用 `fixed` 或 `role` 策略
- **按层级审批**：使用 `reporter_manager` + `dept_manager`
- **区域化管理**：使用 `location_match` + `type_match`
- **复杂条件**：使用 `form_condition` + 条件判断

### 2. 性能优化

```tsx
// 使用 useMemo 缓存策略列表
const memoizedStrategies = useMemo(() => strategies, [strategies]);

// 使用 useCallback 缓存回调函数
const handleChange = useCallback((newStrategies: WorkflowStrategy[]) => {
  setStrategies(newStrategies);
}, []);
```

### 3. 错误处理

```tsx
const handleChange = (newStrategies: WorkflowStrategy[]) => {
  try {
    // 验证配置
    newStrategies.forEach(strategy => {
      const error = validateConfig(strategy.type, strategy.config);
      if (error) throw new Error(error);
    });
    
    setStrategies(newStrategies);
  } catch (error) {
    console.error('策略配置错误:', error);
    // 显示错误提示
  }
};
```

## 迁移指南

### 从隐患管理迁移

1. **导入转换函数**
```typescript
import { convertHazardConfigToUnified } from '@/components/workflow/converter';
```

2. **转换现有配置**
```typescript
const oldConfig = await fetchOldHazardConfig();
const newConfig = convertHazardConfigToUnified(oldConfig);
```

3. **更新组件**
```tsx
// 旧代码
<HandlerStrategySelector ... />

// 新代码
<WorkflowStrategySelector 
  mode="simple"
  supportedStrategies={['fixed', 'reporter_manager', ...]}
  ...
/>
```

### 从作业票管理迁移

1. **导入转换函数**
```typescript
import { convertWorkPermitConfigToUnified } from '@/components/workflow/converter';
```

2. **转换现有配置**
```typescript
const oldConfig = await fetchOldPermitConfig();
const newConfig = convertWorkPermitConfigToUnified(oldConfig);
```

3. **更新组件**
```tsx
// 旧代码
<ApproverStrategyConfig ... />

// 新代码
<WorkflowStrategySelector 
  mode="advanced"
  showApprovalMode={true}
  showConditions={true}
  supportedStrategies={['fixed', 'role', 'form_condition', ...]}
  ...
/>
```

## 常见问题

### Q: 如何限制只显示某些策略类型？

A: 使用 `supportedStrategies` 属性：

```tsx
<WorkflowStrategySelector
  supportedStrategies={['fixed', 'role']}
  ...
/>
```

### Q: 如何实现条件审批？

A: 开启 `showConditions` 并使用 `CONDITIONAL` 审批模式：

```tsx
<WorkflowStrategySelector
  showConditions={true}
  approvalMode="CONDITIONAL"
  ...
/>
```

### Q: 如何验证用户配置的策略？

A: 使用 `validateConfig` 工具函数：

```typescript
import { validateConfig } from '@/components/workflow/utils';

strategies.forEach(strategy => {
  const error = validateConfig(strategy.type, strategy.config);
  if (error) {
    console.error(`策略 ${strategy.id} 配置错误: ${error}`);
  }
});
```

### Q: 旧数据如何迁移？

A: 使用提供的转换函数进行批量转换：

```typescript
import { 
  convertHazardWorkflowToUnified,
  convertWorkPermitWorkflowToUnified 
} from '@/components/workflow/converter';

// 批量转换
const newWorkflow = convertHazardWorkflowToUnified(oldWorkflow);
```

## 贡献指南

如需添加新的策略类型：

1. 在 `types.ts` 中添加新的策略类型定义
2. 在 `StrategyConfigPanel.tsx` 中实现配置UI
3. 在 `utils.ts` 中添加标签、描述和默认配置
4. 在 `converter.ts` 中添加转换逻辑（如果需要）
5. 更新本文档

## 技术支持

如遇到问题或需要帮助，请：

1. 查阅本文档的常见问题部分
2. 检查 TypeScript 类型定义
3. 查看组件源码中的注释
4. 联系开发团队

## 更新日志

### v1.0.0 (2026-01-20)

- ✅ 初始版本发布
- ✅ 统一隐患和作业票的策略选择逻辑
- ✅ 支持14种策略类型
- ✅ 提供完整的数据转换工具
- ✅ 完整的TypeScript类型支持
