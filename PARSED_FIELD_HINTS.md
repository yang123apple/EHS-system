# 📝 模板编辑模式 - 解析字段提示功能

## ✨ 功能说明

在模板编辑时，系统会自动显示每个空白单元格推断出来的解析结果。

### 显示方式

**默认状态：** 空白单元格显示简洁的提示信息
```
// fieldName
(fieldType)
```

**悬停时：** 显示完整的字段信息弹窗
```
字段名：fieldName
类型：fieldType
提示：这是该字段的用户友好提示
编辑提示：（可选）额外的编辑说明
```

## 🎨 视觉设计

### 颜色和样式
- **背景色**：蓝色到青色渐变 (`from-blue-50 to-cyan-50`)
- **左边框**：蓝色 4px 竖线 (`border-l-4 border-blue-500`)
- **文本**：深蓝色加粗字体
- **悬停效果**：显示白色半透明背景的详细信息卡片

### 示例

#### 示例1：部门字段
```
┌─────────────────────┐
│ // constructDept    │  ← 默认显示
│ (department)        │
└─────────────────────┘

悬停后 ↓
┌────────────────────────────┐
│ 字段名：constructDept       │
│ 类型：department           │
│ 提示：请选择施工位置所属部门 │
└────────────────────────────┘
```

#### 示例2：日期字段
```
┌─────────────────────┐
│ // startDate        │  ← 默认显示
│ (date)              │
└─────────────────────┘

悬停后 ↓
┌────────────────────────────┐
│ 字段名：startDate           │
│ 类型：date                 │
│ 提示：请输入作业开始日期     │
└────────────────────────────┘
```

## 🚀 使用步骤

### 1. 上传模板
- 在工作许可证管理页面上传包含标签的 Excel 模板
- 系统自动解析每个空单元格左侧的标签

### 2. 编辑模板
- 点击"编辑"按钮打开模板编辑弹窗
- 系统在模板设计模式中显示解析结果

### 3. 查看解析提示
- 单元格上显示 `// fieldName` 和 `(fieldType)` 的简洁提示
- 鼠标悬停在单元格上，显示完整的字段信息卡片

### 4. 保存模板
- 修改完成后点击"保存"
- 解析结果和模板结构一起保存到数据库

## 📊 字段类型说明

系统自动推断以下字段类型：

| 字段类型 | 检测关键词 | 示例 | 使用场景 |
|---------|----------|------|---------|
| **department** | 部门、科室、车间、班组 | `施工部门` | 组织选择 |
| **date** | 日期、时间、年月日、截止 | `作业日期` | 时间输入 |
| **number** | 数量、人数、金额、周期、天数 | `施工人数` | 数值输入 |
| **text** | 名称、号码、说明、备注、描述 | `工作说明` | 文本输入 |
| **other** | 其他未匹配类型 | 自定义标签 | 通用输入 |

## 💡 解析示例

### 输入的Excel模板结构
```
Row 1: [标题]    [施工部门]              []        [作业人数]
Row 2: [描述]    [工作说明]              []        [备注]
```

### 系统推断结果
```
单元格R1C3: 
  - cellKey: R1C3
  - label: 施工部门
  - fieldName: constructionDepartment
  - fieldType: department
  - hint: 请选择施工部门

单元格R1C4:
  - cellKey: R1C4
  - label: 作业人数
  - fieldName: personCount
  - fieldType: number
  - hint: 请输入作业人数
```

### 编辑模式下的显示
```
空白单元格R1C3显示：
┌─────────────────────────┐
│ // constructionDepartment│
│ (department)            │
└─────────────────────────┘
```

## 🎯 编辑提示（editableHint）

某些字段可能有特殊的编辑说明，在悬停卡片中会显示为：

```
编辑提示：请确保选择正确的部门
```

这些提示可以帮助用户在编辑表单时作出正确的选择。

## 🔧 技术实现

### 核心文件修改

#### 1. `EditTemplateModal.tsx` - 模板编辑弹窗
```typescript
// 加载解析的字段
const [parsedFields, setParsedFields] = useState<ParsedField[]>([]);

// 传递给ExcelRenderer
<ExcelRenderer
  templateData={templateData}
  parsedFields={parsedFields}  // ✨ 新增
  mode="design"
  onTemplateChange={setTemplateData}
/>
```

#### 2. `ExcelRenderer.tsx` - 表格渲染器
```typescript
// 新增属性
interface ExcelRendererProps {
  parsedFields?: ParsedField[];  // 解析的字段列表
  // ... 其他属性
}

// 在renderCellContent中使用
const cellKey = `R${rIndex + 1}C${cIndex + 1}`;
const parsedField = parsedFields?.find(f => f.cellKey === cellKey);

// 设计模式下显示解析提示
if (isDesignMode && parsedField) {
  return (
    <div className="bg-gradient-to-br from-blue-50 to-cyan-50">
      // {parsedField.fieldName}
      ({parsedField.fieldType})
      
      {/* 悬停显示完整信息 */}
    </div>
  );
}
```

#### 3. `templateParser.ts` - 字段解析工具
```typescript
// 推断字段名
inferFieldName(label: string): string

// 推断字段类型
inferFieldType(label: string): ParsedField['fieldType']

// 生成用户友好的提示
generateHint(label: string, fieldType: string): string
```

## ✅ 验证清单

- [x] ✅ 解析字段功能已实现
- [x] ✅ 编辑模式下显示解析提示
- [x] ✅ 悬停显示完整字段信息
- [x] ✅ 代码编译无错误
- [x] ✅ 生产构建成功
- [x] ✅ 开发服务器正常运行
- [ ] ⏳ 端到端功能测试

## 🧪 测试步骤

### 1. 上传含有标签的模板
```
操作：在工作许可证页面 → "管理模板" → "上传新模板"
预期：系统自动识别标签并创建解析字段
```

### 2. 打开模板编辑
```
操作：在模板列表中点击编辑
预期：进入编辑弹窗，空白单元格显示 // 注释形式的字段提示
```

### 3. 悬停查看完整信息
```
操作：鼠标悬停在标注字段的单元格上
预期：弹出白色卡片显示：
  - 字段名
  - 字段类型
  - 提示信息
  - 编辑提示（如有）
```

### 4. 修改和保存
```
操作：修改模板结构，点击保存
预期：新的解析结果被重新计算并保存
```

## 📋 常见问题

### Q: 为什么我的字段没有显示解析提示？
**A:** 可能的原因：
1. 该单元格不是空白的（已有内容）
2. 左侧标签没有被系统识别（可能标签位置不对）
3. 模板未保存或重新加载

### Q: 能否自定义字段类型的推断规则？
**A:** 可以，修改 `templateParser.ts` 中的关键词字典：
```typescript
const FIELD_TYPE_KEYWORDS = {
  department: ['部门', '科室', '车间', ...], // 添加新关键词
  date: ['日期', '时间', ...],
  // ...
};
```

### Q: 编辑提示（editableHint）如何设置？
**A:** 目前通过 `generateHint()` 函数自动生成，可以根据字段类型返回不同的提示。

## 🔄 工作流完整示例

```
1️⃣  用户上传模板
    ↓
2️⃣  后端解析字段
    ├─ parseTemplateFields() 识别标签
    ├─ inferFieldType() 推断类型
    ├─ generateHint() 生成提示
    ↓
3️⃣  保存 parsedFields 到数据库
    ├─ Template.parsedFields = JSON.stringify(fields)
    ↓
4️⃣  用户打开编辑模板
    ↓
5️⃣  系统加载并显示解析提示
    ├─ // constructionDepartment
    ├─ (department)
    └─ 悬停显示完整信息
    ↓
6️⃣  用户修改并保存
    ├─ 重新解析字段
    ├─ 更新数据库
    ↓
7️⃣  下次编辑时显示最新的解析结果 ✨
```

## 🎓 扩展方向

未来可以实现：

1. **手动编辑字段类型** - 允许用户修改推断的字段类型
2. **自定义提示信息** - 编辑器中直接修改提示文本
3. **字段配置保存** - 保存用户自定义的字段配置供复用
4. **字段模板库** - 预定义常用的字段配置组合
5. **批量操作** - 对多个字段进行批量修改
6. **字段验证规则** - 为不同字段类型定义验证规则
7. **国际化支持** - 支持多语言的字段标签识别

---

**功能完成时间：** 2025-12-20  
**状态：** ✅ 开发完成，测试中  
**下一步：** 端到端功能验证和用户反馈
