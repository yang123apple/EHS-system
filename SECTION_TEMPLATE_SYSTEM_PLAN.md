# Section 嵌套模板系统实现计划

## 功能概述

实现一级/二级模板系统，支持section类型单元格绑定二级模板，实现复杂表单的嵌套填写。

## 数据库改动 ✅ 已完成

### WorkPermitTemplate 表
```prisma
level String @default("primary") // primary=一级, secondary=二级  
sectionBindings String? // JSON: {"R5C3": "templateId", ...}
```

### ParsedField 类型
```typescript
fieldType: 'section' // 新增类型
boundTemplateId?: string // section绑定的模板ID
```

## 实现步骤

### 第一阶段：模板编辑基础功能

#### 1. EditTemplateModal 改造
- [ ] 添加模板级别选择（一级/二级）UI
- [ ] 在解析编辑模式中，字段类型下拉增加"section"选项
- [ ] section类型字段只能手动添加（不自动识别）
- [ ] 在非解析模式下，section单元格显示"绑定模板"按钮
- [ ] 点击绑定按钮，弹出二级模板选择器（只显示level='secondary'的模板）
- [ ] 保存时将绑定关系存入sectionBindings字段

#### 2. 模板管理页面
- [ ] 模板列表显示级别标签（一级/二级）
- [ ] 创建模板时可选择级别

### 第二阶段：ExcelRenderer section 支持

#### 3. ExcelRenderer 组件更新
- [ ] **设计模式**: section单元格显示紫色"SECTION"标记
- [ ] **编辑模式** (填写表单):
  - section单元格显示蓝色按钮"填写子表单"
  - 点击打开SectionFormModal
  - 如已填写，显示"已填写✓"状态
- [ ] **查看模式**: 显示section单元格的填写状态

### 第三阶段：表单填写集成

#### 4. SectionFormModal 组件 (新建)
```typescript
// src/components/work-permit/moduls/SectionFormModal.tsx
interface Props {
  isOpen: boolean;
  onClose: () => void;
  sectionField: ParsedField; // section字段信息
  boundTemplate: Template; // 绑定的二级模板
  parentCode: string; // 父表单编号
  onSave: (data: Record<string, any>) => void;
}
```
功能：
- 渲染二级模板表单
- 生成二级编号（父编号 + 字段名）
- 保存数据到父表单的dataJson

#### 5. AddPermitModal 集成
- [ ] 处理section字段的数据存储
- [ ] section数据存储格式: `dataJson["SECTION_R5C3"] = { templateId, data, code }`

### 第四阶段：二级模板流程系统

#### 6. 二级模板工作流编辑器
新建组件: `SecondaryWorkflowEditor.tsx`

特点：
- 使用"Part"概念而非"Step"
- 每个Part配置：
  - partIndex: number
  - partName: string (如"需求单位意见")
  - pickStrategy: 'fixed' | 'field_match' // 拾取策略
  - sourceFieldName?: string // 指定字段名（用于field_match策略）
  - outputCell: {r, c} // 输出单元格位置

#### 7. 字段匹配逻辑
实现二级模板从一级模板中提取签名：
```typescript
// 工作流程：
// 1. 用户提交一级表单，审批人在"需求单位意见"单元格签字
// 2. 用户打开section填写二级表单
// 3. 二级模板工作流配置了 pickStrategy='field_match', sourceFieldName='需求单位意见'
// 4. 系统从一级表单dataJson中找到fieldName='需求单位意见'的单元格值
// 5. 解析出签名、日期、意见
// 6. 自动填充到二级模板对应的Part输出单元格中
```

### 第五阶段：编号系统

#### 8. 二级模板编号生成
```typescript
// 生成规则：父编号-字段名
// 例如：
// 一级: 251222-001-DH-251222-001
// 二级: 251222-001-DH-251222-001-JSA (JSA为字段名简写)
```

- [ ] 在SectionFormModal打开时生成预览编号
- [ ] 提交时保存到section数据中

### 第六阶段：打印支持

#### 9. 打印功能扩展
- [ ] RecordDetailModal打印时包含所有section子表单
- [ ] 每个section单独一页
- [ ] 标题显示: "附表：[模板名称]（[编号]）"

## 数据结构设计

### 一级模板的 dataJson 结构
```json
{
  "R1C1": "value1",
  "R2C2": "value2",
  "SECTION_R5C3": {
    "templateId": "template_id",
    "templateName": "JSA工作分析",
    "code": "251222-001-DH-251222-001-JSA",
    "data": {
      "R1C1": "section_value1",
      // ... section表单的数据
    }
  }
}
```

### 二级模板的 workflowConfig 结构
```json
[
  {
    "part": 1,
    "partName": "需求单位意见",
    "pickStrategy": "field_match",
    "sourceFieldName": "需求单位意见",
    "outputCell": {"r": 10, "c": 1}
  },
  {
    "part": 2,
    "partName": "固定签字",
    "pickStrategy": "fixed",
    "approvers": ["user_id_1"],
    "outputCell": {"r": 15, "c": 1}
  }
]
```

## API 端点

### 新增/修改的API
- `PATCH /api/templates` - 更新时支持level和sectionBindings字段
- `GET /api/templates?level=secondary` - 获取指定级别的模板
- `POST /api/permits` - 创建时支持section数据的嵌套结构

## 文件清单

### 需要新建的文件
1. `/src/components/work-permit/moduls/SectionFormModal.tsx` - section表单弹窗
2. `/src/components/work-permit/moduls/SecondaryWorkflowEditor.tsx` - 二级模板流程编辑器
3. `/src/components/work-permit/moduls/TemplateBindingModal.tsx` - 模板绑定选择器

### 需要修改的文件
1. `/src/components/work-permit/moduls/EditTemplateModal.tsx` - 添加级别选择和section支持
2. `/src/components/work-permit/ExcelRenderer.tsx` - section单元格渲染和交互
3. `/src/components/work-permit/moduls/AddPermitModal.tsx` - section数据处理
4. `/src/components/work-permit/moduls/RecordDetailModal.tsx` - section展示和打印
5. `/src/app/api/templates/route.ts` - 支持level查询
6. `/src/services/workPermitService.ts` - 类型更新

## 开发优先级

### P0 - 核心功能（必须完成）
1. 模板级别选择UI ✅
2. Section类型字段支持 ✅  
3. Section单元格绑定模板
4. SectionFormModal基础功能
5. 数据保存和读取

### P1 - 高级功能
1. 二级模板编号生成
2. 字段匹配拾取逻辑
3. 打印支持

### P2 - 优化功能
1. 二级模板流程编辑器完整UI
2. 更多拾取策略
3. Section状态可视化

## 测试场景

### 场景1：创建包含JSA的动火作业
1. 创建一级模板"动火作业票"，在"工作分析"单元格设置为section类型
2. 创建二级模板"JSA工作分析表"
3. 在一级模板编辑时，绑定section到JSA模板
4. 用户新建动火作业票，填写基础信息
5. 点击"工作分析"单元格，弹出JSA表单
6. 填写JSA内容，保存
7. 提交审批，审批人在一级表单签字
8. JSA表单自动获取一级表单的签名
9. 打印时包含主表单和JSA附表

## 当前进度

- [x] 数据库schema更新
- [x] 类型定义更新
- [ ] 模板编辑UI（进行中）
- [ ] Section表单功能
- [ ] 工作流拾取逻辑

---

更新时间：2025-12-22
版本：V3.4 计划
