# EHS 系统 - V3.2 版本更新日志

## 发布日期
2025年12月22日

## 版本概述
本版本聚焦于 **作业单编号生成系统** 和 **打印功能全面优化**，实现了自动化编号生成、打印格式优化，以及表单数据在打印模式下的正确显示。

---

## 🎯 核心功能

### 1. ✨ 作业单编号生成系统

#### ✅ 编号规则
- **格式**: `项目编号-类型编号-日期-顺序号`
- **示例**: `251220-001-DH-251222-001`
- **构成**:
  - 项目编号: 来自项目信息（如 251220-001）
  - 类型编号: 根据表单类型首字母大写（动火→DH, 高处→GC, 受限→SX, 吊装→DZ 等）
  - 日期: YYMMDD 格式（年份后两位+月份+日期）
  - 顺序号: 同日期同类型的自然顺序编号，3位数字（001, 002, 003...）

#### ✅ 编号生成实现
- **生成位置**: POST `/api/permits` 端点，创建新工作许可记录时自动生成
- **函数**: `generatePermitCode(projectId, templateType)` 
- **数据库**: 编号存储在 `WorkPermitRecord.code` 字段（可选、唯一）
- **迁移**: `20251221161723_add_permit_code_optional` - 新增可选的 `code` 字段
- **顺序控制**: 按日期和类型分组计算，确保不重复

#### ✅ 类型映射表
```typescript
const typeMap: Record<string, string> = {
  '动火': 'DH',        // 动火作业
  '高处': 'GC',        // 高处作业
  '受限空间': 'SX',    // 受限空间作业
  '吊装': 'DZ',        // 吊装作业
  '冷作': 'LZ',        // 冷作业
  '热作': 'RZ',        // 热作业
  '其他': 'QT'         // 其他特殊作业
};
```

#### ✅ 编号展示
- **位置**: 表单右上角，使用绝对定位
- **屏幕显示**: 8px 字号，灰色字体，等宽字体(font-mono)
- **打印显示**: 6px 字号，黑色字体，保证可读性
- **类名**: `permit-code`，便于样式控制

---

### 2. 🖨️ 打印功能全面优化

#### ✅ 页面格式优化
- **页边距**: 从 1cm 调整为 0.5cm，最大化内容展示空间
- **内容边距**: body padding 从 20px 改为 5px（上下）+ 20px（左右），顶部更紧凑
- **表格对齐**: 添加 `margin: 0 auto`，确保打印时表格居中显示
- **CSS强制**: 所有边框样式添加 `!important`，防止浏览器样式覆盖

#### ✅ 打印样式应用
```css
@page { 
  margin: 0.5cm; 
  size: A4; 
}
* { 
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
table { 
  border-collapse: collapse !important;
  border: 1px solid #000 !important;
  margin: 0 auto !important;
}
td, th { 
  border: 1px solid #000 !important;
  page-break-inside: avoid !important;
}
.permit-code {
  font-size: 6px !important;
}
```

#### ✅ 表单字段打印显示修复
- **日期字段**: 
  - 编辑模式: 显示"年月日"占位符 + 日期选择器
  - 查看模式: 隐藏占位符，只显示选中的日期值
  - 打印模式: 同查看模式，避免文字重复

- **选项字段（互斥）**:
  - 编辑模式: 显示所有选项的单选框
  - 查看模式: 仅显示选中的选项文本，不显示未选项
  - 打印模式: 同查看模式，数据清晰简洁

- **选项字段（复选）**:
  - 编辑模式: 显示所有选项的复选框
  - 查看模式: 显示勾选/未勾选的图标 + 选项文本
  - 打印模式: 同查看模式

---

### 3. 🔧 技术实现细节

#### ✅ 文件修改清单

**prisma/schema.prisma**
- 新增字段: `code String? @unique` - 可选的唯一编号字段
- 迁移: `20251221161723_add_permit_code_optional`

**src/app/api/permits/route.ts**
- 新增函数: `generatePermitCode(projectId: string, templateType: string)`
- 实现: 类型映射 + 日期格式化 + 顺序号生成
- 集成: POST 请求处理中自动调用

**src/components/work-permit/ExcelRenderer.tsx**
- Props 扩展: 新增 `permitCode?: string` 属性
- 编号显示: 第 897-902 行，使用 permit-code 类名
- 日期字段: 第 762-782 行，模式条件渲染
- 选项字段: 第 706-758 行，查看模式只显示选中值
- 复选框: 第 745-751 行，视觉反馈保留

**src/components/work-permit/moduls/RecordDetailModal.tsx**
- 打印函数: `handlePrint()` 使用 window.open 方式
- 打印样式: 第 51-76 行，完整的 CSS 规则集
- 编号传递: 第 556 行 `permitCode={record.code}`
- 水印隐藏: 第 72 行 `.watermark-layer { display: none !important; }`

---

### 4. 📊 数据库变更

#### ✅ Schema 修改
```prisma
model WorkPermitRecord {
  id        Int       @id @default(autoincrement())
  code      String?   @unique  // 新增: 作业单编号
  // ... 其他字段
}
```

#### ✅ 迁移步骤
```bash
npx prisma migrate dev --name add_permit_code_optional
```

---

## 🐛 已修复的问题

1. **打印表格右侧边框不完整** 
   - ✅ 原因: CSS 边框样式未强制应用
   - ✅ 解决: 添加 `!important` 和 `border-collapse: collapse`

2. **日期字段显示重复**
   - ✅ 原因: 查看模式同时显示占位符和选中值
   - ✅ 解决: 条件渲染，查看模式只显示选中值

3. **选项字段显示所有选项**
   - ✅ 原因: 互斥选项在查看模式下仍显示全部选项
   - ✅ 解决: 修改渲染逻辑，查看模式只显示选中项

4. **打印页边距过大**
   - ✅ 原因: body padding 为 20px，顶部空白太多
   - ✅ 解决: 调整为 5px 上下 + 20px 左右

5. **编号字体在打印时过大**
   - ✅ 原因: 初始样式过大，print: 修饰符可能失效
   - ✅ 解决: 添加 permit-code 类名，在打印样式中强制 6px

---

## ✨ 用户体验改进

- **编号可见性**: 在表单的显著位置（右上角）清晰显示编号
- **打印质量**: 优化页边距和字体大小，确保打印清晰可读
- **数据准确**: 修复打印时的数据重复显示，信息清晰明确
- **操作便利**: 自动生成编号，无需手动输入，减少错误

---

## 🎯 后续优化方向

1. **编号自定义**: 支持项目级别的编号前缀自定义
2. **编号查询**: 提供编号搜索和过滤功能
3. **打印模板**: 支持多种打印模板选择
4. **导出功能**: 支持 PDF 导出和批量导出

---

## 📋 测试清单

- [x] 编号生成正确（格式、唯一性、顺序）
- [x] 编号在 UI 中正确显示
- [x] 编号在打印中正确显示（字体大小）
- [x] 日期字段打印不重复显示
- [x] 选项字段只显示选中项
- [x] 打印表格边框完整
- [x] 打印页边距合理
- [x] 打印页面居中对齐
- [x] 水印在打印中隐藏

---

## 版本状态
✅ **稳定版本** - 已完整测试并应用到生产环境
