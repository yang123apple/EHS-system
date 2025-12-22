# 二级模板流程配置重构设计

## 📋 需求概述

二级模板的流程配置需要完全重制，使用Part系统替代现有的Step审批流程系统。

## 🎯 核心功能

### Part系统 (替代Step系统)

**Part配置项：**
- Part序号 (Part 1, Part 2...)
- Part名称 (如"需求单位审批")
- 绑定输出单元格 (二级模板中的位置)
- 拾取策略：**指定字段查找**

### 字段继承机制

**工作原理：**
1. 一级模板中有字段名为"需求单位意见"的单元格
2. 审批流程在该单元格写入：签名、日期、意见
3. 二级模板Part配置：
   - 拾取策略 = "指定字段查找"
   - 查找值 = "需求单位意见"
4. 提交时，自动从一级模板数据中提取该字段的内容
5. 导入到二级模板Part绑定的单元格中

## 🔧 技术实现

### 1. 数据结构 (已添加)

```typescript
// types/work-permit.ts
export type PartPickStrategy = 'field_match'; // 指定字段查找

export interface WorkflowPart {
  part: number;              // Part序号 (1, 2, 3...)
  name: string;              // Part名称
  outputCell?: string;       // 绑定的输出单元格 (如 "R5C3")
  pickStrategy: PartPickStrategy;
  pickConfig: {
    fieldName: string;       // 一级模板中的字段名
  };
}
```

### 2. UI重构需求

**WorkflowEditorModal.tsx 需要修改：**

1. **检测模板级别**
   - 如果 `template.level === 'secondary'`，显示Part配置界面
   - 如果 `template.level === 'primary'`，显示现有Step审批界面

2. **二级模板左侧配置面板**
   ```
   [Part 1]
   ├─ Part名称: [输入框]
   ├─ 输出单元格: [点击拾取] R5C3
   └─ 拾取策略
      └─ 指定字段查找
         └─ 查找字段名: [输入框/下拉选择]
   ```

3. **字段名选择**
   - 从一级模板的 `parsedFields` 中获取所有字段名
   - 提供下拉选择或输入框

### 3. 存储格式

二级模板的 `workflowConfig` 字段存储 `WorkflowPart[]` 的JSON字符串：

```json
[
  {
    "part": 1,
    "name": "需求单位审批",
    "outputCell": "R5C3",
    "pickStrategy": "field_match",
    "pickConfig": {
      "fieldName": "需求单位意见"
    }
  }
]
```

### 4. 运行时逻辑

**SectionFormModal提交时：**
1. 读取二级模板的 `workflowConfig` (Part配置)
2. 遍历每个Part
3. 从父表单 `permitFormData` 中查找 `fieldName` 对应的数据
4. 将数据写入二级模板的 `outputCell` 位置

## ⚠️ 影响范围

### 需要修改的文件

1. **WorkflowEditorModal.tsx**
   - 添加模板级别判断
   - 创建全新的Part配置界面
   - 保持一级模板的Step配置不变

2. **SectionFormModal.tsx**
   - 添加Part字段继承逻辑
   - 在提交前自动填充Part绑定的单元格

3. **AddPermitModal.tsx**
   - 传递父表单数据给SectionFormModal

## 🤔 待确认问题

1. **是否立即实施？**
   - 这是一个较大的重构
   - 需要完全重写WorkflowEditorModal的二级模板部分

2. **字段匹配策略**
   - 只支持精确匹配字段名？
   - 是否需要模糊匹配？

3. **数据格式**
   - 签名、日期、意见是分开的字段还是合并的？
   - 如何处理signature类型的Base64数据？

4. **UI交互**
   - Part配置是否需要支持拖拽排序？
   - 是否需要预览功能？

## 📝 实施步骤建议

**阶段1: UI框架**
1. 修改WorkflowEditorModal添加级别判断
2. 创建SecondaryWorkflowEditor组件
3. 实现Part列表的增删改

**阶段2: 字段选择**
1. 获取一级模板字段列表
2. 实现字段名选择UI
3. 单元格拾取功能

**阶段3: 数据处理**
1. 实现字段继承逻辑
2. SectionFormModal集成
3. 数据验证和错误处理

---

**是否继续实施此方案？请确认。**
