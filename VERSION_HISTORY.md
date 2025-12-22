# EHS 系统版本历史

## 当前版本：V3.2 ⭐

---

## 版本时间线

```
V3.2 (2025-12-22) ← 当前版本
  ↑
V3.1 (2025-12-22)
  ↑
V3.0 (2025-12-21)
  ↑
[初始版本]
```

---

## V3.2 - 作业单编号生成 & 打印优化 (2025-12-22)

### 🎯 核心功能
- ✨ 自动生成作业单编号（项目-类型-日期-顺序）
- 🖨️ 打印格式全面优化
- 📊 编号智能显示（屏幕/打印不同样式）
- 🔄 完全向后兼容

### 📋 编号规则
- **格式**: `项目编号-类型编号-日期-顺序号`
- **示例**: `251220-001-DH-251222-001`
- **类型映射**: 动火→DH, 高处→GC, 受限空间→SX, 吊装→DZ等
- **顺序号**: 按日期和类型分组递增（001, 002, 003...）

### 📦 更新文件
- `prisma/schema.prisma` - WorkPermitRecord 添加 code 字段
- `src/app/api/permits/route.ts` - generatePermitCode 函数
- `src/types/work-permit.ts` - PermitRecord 添加 code
- `src/components/work-permit/ExcelRenderer.tsx` - 编号显示
- `src/components/work-permit/PrintStyle.tsx` - 打印样式优化
- `src/components/work-permit/moduls/RecordDetailModal.tsx` - 编号传递

### 🖨️ 打印优化
- 页边距：5mm → 0.5cm
- body padding：0 → 5px 20px
- 表格边框：强制黑色 !important
- 编号字体：屏幕 8px → 打印 6px
- 水印：打印时自动隐藏

### 📊 技术指标
- 新增代码：~100 行
- 向后兼容：✅ 100%
- 构建状态：✅ 通过
- Build ID: KV3Vc8mYcGD8xwBOuK40A

### 📚 文档
- [V3.2_UPDATE_SUMMARY.md](./V3.2_UPDATE_SUMMARY.md) - 更新总结

---

## V3.1 - 必填字段标记功能 (2025-12-22)

### 🎯 核心功能
- ✨ 必填字段标记系统（设计端 + 填写端）
- 🎯 智能视觉反馈（红色边框 + 星号提示）
- 🔍 内联输入框状态检测
- 🎨 弹窗尺寸优化（max-w-[95vw]）

### 📦 更新文件
- `src/types/work-permit.ts` - 添加 `required?: boolean`
- `src/components/work-permit/ExcelRenderer.tsx` - 核心功能实现
- `src/components/work-permit/moduls/AddPermitModal.tsx` - UI 优化

### 📊 技术指标
- 新增代码：~150 行
- 向后兼容：✅ 100%
- 构建状态：✅ 通过
- Build ID: z7p0UgugUjKXZ-4fNhh6h

### 📚 文档
- [V3.1_UPDATE_SUMMARY.md](./V3.1_UPDATE_SUMMARY.md) - 更新总结
- [CHANGELOG_V3.1.md](./CHANGELOG_V3.1.md) - 详细变更日志

---

## V3.0 - 模板解析精度优化 (2025-12-21)

### 🎯 核心改进
- 🎯 智能日期占位符识别（中英文格式）
- 🎯 选项行自动聚合与去重
- 🎯 标签过滤与黑名单机制
- 🎯 合并单元格规范化处理
- 🎯 字段名唯一性保证（_rowX 后缀）
- 🎯 原生 Excel 列宽支持

### 🐛 Bug 修复
- ExcelRenderer 运行时错误（字符串对象设置属性）
- formData 初始化异常处理

### 📦 更新文件
- `src/utils/templateParser.ts` (832行) - 核心解析引擎
- `src/components/work-permit/ExcelRenderer.tsx` (1050行) - 渲染组件
- `src/components/work-permit/moduls/TemplateManageModal.tsx` - 模板管理
- `src/types/work-permit.ts` - 类型定义（添加 `options?: string[]`）

### 📚 文档
- [V3.0_UPDATE_SUMMARY.md](./V3.0_UPDATE_SUMMARY.md) - 更新总结
- [CHANGELOG.md](./CHANGELOG.md) - 详细变更日志
- [VERSION.md](./VERSION.md) - 版本信息

### 🔧 新增函数
- `isIgnorableLabel()` - 标签有效性判断
- `findSmartLeftLabel()` - 智能向左查找标签

---

## 版本对比

| 特性 | V3.0 | V3.1 | V3.2 |
|------|------|------|------|
| 模板解析优化 | ✅ | ✅ | ✅ |
| 选项行聚合 | ✅ | ✅ | ✅ |
| 日期占位识别 | ✅ | ✅ | ✅ |
| 合并单元格处理 | ✅ | ✅ | ✅ |
| 字段唯一性 | ✅ | ✅ | ✅ |
| 必填字段标记 | ❌ | ✅ | ✅ |
| 智能视觉反馈 | ❌ | ✅ | ✅ |
| 弹窗尺寸优化 | ❌ | ✅ | ✅ |
| 作业单编号生成 | ❌ | ❌ | ✅ |
| 打印格式优化 | ❌ | ❌ | ✅ |

---

## 升级路径

### 从初始版本升级到 V3.1

#### 步骤1：安装依赖
```bash
npm install
```

#### 步骤2：应用 V3.0 改动
- 模板解析精度优化
- Bug 修复

#### 步骤3：应用 V3.1 改动
- 必填字段标记功能
- UI/UX 优化

#### 步骤4：验证
```bash
npm run build
npm run dev
```

### 数据迁移
- ✅ **无需数据库迁移**
- ✅ 所有新字段为可选属性
- ✅ 完全向后兼容

---

## 技术栈

### 核心框架
- Next.js 16.0.10 (Turbopack)
- React 19.2.1
- TypeScript 5.x

### 数据库
- Prisma 6.0.1
- SQLite (开发环境)
- PostgreSQL (生产环境支持)

### UI 框架
- Tailwind CSS 4.1.17
- Lucide React (图标)

---

## 构建信息

### V3.2 构建
- Build ID: `KV3Vc8mYcGD8xwBOuK40A`
- 构建时间: ~8.2 秒
- 静态页面: 21 个
- API 路由: 12 个

### V3.1 构建
- Build ID: `z7p0UgugUjKXZ-4fNhh6h`
- 构建时间: ~8 秒
- 静态页面: 21 个
- API 路由: 12 个

### V3.0 构建
- Build ID: `SX4Fr_g-2vratfqU5MPBl`
- 构建时间: ~10.9 秒
- 静态页面: 21 个
- API 路由: 12 个

---

## 下一步规划

### 短期功能
- [ ] 提交前验证（检查所有必填字段）
- [ ] 错误提示优化（定位未填写字段）
- [ ] 必填字段统计显示

### 中期功能
- [ ] 条件必填（基于其他字段值）
- [ ] 字段依赖关系
- [ ] 批量标记工具

### 长期规划
- [ ] 必填规则引擎
- [ ] 权限相关必填
- [ ] 审计日志系统

---

## 技术支持

### 文档索引
- [VERSION.md](./VERSION.md) - 当前版本信息
- [V3.1_UPDATE_SUMMARY.md](./V3.1_UPDATE_SUMMARY.md) - V3.1 更新总结
- [V3.0_UPDATE_SUMMARY.md](./V3.0_UPDATE_SUMMARY.md) - V3.0 更新总结
- [CHANGELOG_V3.1.md](./CHANGELOG_V3.1.md) - V3.1 变更日志
- [CHANGELOG.md](./CHANGELOG.md) - V3.0 变更日志

### 快速启动
```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 生产构建
npm run build

# 启动生产服务
npm start
```

---

**文档更新时间**: 2025年12月22日  
**当前版本**: V3.1  
**状态**: 生产就绪 ✅
