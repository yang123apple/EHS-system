# 公共组件、函数与 API 梳理文档

本文档梳理了 EHS 系统中所有的公共弹窗组件、公共工具函数和公共 API 接口。

## 📁 文件树状结构图

```
ehs-system/
│
├── src/
│   │
│   ├── components/                    # 组件目录
│   │   ├── common/                    # 公共组件
│   │   │   ├── index.ts              # 组件导出入口
│   │   │   ├── SignatureManager.tsx  # 手写签名管理器
│   │   │   ├── PeopleSelector.tsx     # 人员/部门选择器
│   │   │   ├── Toast.tsx             # 消息提示组件
│   │   │   ├── ErrorBoundary.tsx     # 错误边界
│   │   │   ├── Loading.tsx           # 加载组件
│   │   │   ├── NotificationPanel.tsx # 通知面板
│   │   │   ├── PermissionDenied.tsx  # 权限不足提示
│   │   │   ├── Watermark.tsx         # 水印组件
│   │   │   ├── Breadcrumbs.tsx       # 面包屑导航
│   │   │   ├── Sidebar.tsx          # 侧边栏组件
│   │   │   └── signature/           # 签名子组件目录
│   │   │       ├── HandwrittenSignature.tsx # 手写签名画板
│   │   │       ├── MultiSignatureDisplay.tsx # 多人签名展示
│   │   │       ├── SignatureImage.tsx       # 签名图片展示
│   │   │       └── index.ts                # 签名组件导出
│   │   │
│   │   ├── auth/                      # 认证相关组件
│   │   │   ├── change-password-form.tsx # 密码修改表单
│   │   │   └── ChangePasswordModal.tsx  # 密码修改弹窗
│   │   │
│   │   ├── audit/                      # 审计日志组件
│   │   │   ├── LogTimeline.tsx        # 日志时间轴
│   │   │   ├── LogSnapshotViewer.tsx   # 快照查看器
│   │   │   └── LogDiffViewer.tsx       # 差异对比查看器
│   │   │
│   │   ├── ui/                         # 基础UI组件
│   │   │   ├── button.tsx            # 按钮组件
│   │   │   ├── card.tsx               # 卡片组件
│   │   │   ├── dialog.tsx             # 对话框组件
│   │   │   ├── badge.tsx              # 徽章组件
│   │   │   ├── calendar.tsx           # 日历组件（基于 react-day-picker）
│   │   │   ├── popover.tsx            # 弹出框组件（基于 Radix UI）
│   │   │   ├── scroll-area.tsx        # 滚动区域组件
│   │   │   └── tooltip.tsx            # 工具提示组件（基于 Radix UI）
│   │   │
│   │   ├── work-permit/              # 作业许可模块组件
│   │   │   ├── ExcelRenderer.tsx     # Excel 表格渲染器
│   │   │   ├── PrintStyle.tsx        # 打印样式组件
│   │   │   ├── moduls/               # 弹窗组件目录
│   │   │   │   ├── AddPermitModal.tsx        # 新建作业许可弹窗
│   │   │   │   ├── EditTemplateModal.tsx     # 编辑模板弹窗
│   │   │   │   ├── RecordDetailModal.tsx     # 记录详情弹窗
│   │   │   │   ├── WorkflowEditorModal.tsx   # 工作流编辑器弹窗
│   │   │   │   ├── TemplateManageModal.tsx   # 模板管理弹窗
│   │   │   │   ├── ProjectDetailModal.tsx    # 项目详情弹窗
│   │   │   │   ├── NewProjectModal.tsx        # 新建项目弹窗
│   │   │   │   ├── TemplateBindingModal.tsx  # 模板绑定弹窗
│   │   │   │   ├── SectionFormModal.tsx      # 分段表单弹窗
│   │   │   │   ├── AttachmentViewModal.tsx   # 附件查看弹窗
│   │   │   │   ├── ApprovalModal.tsx         # 审批弹窗
│   │   │   │   ├── AdjustDateModal.tsx        # 调整日期弹窗
│   │   │   │   ├── ApproverStrategyConfig.tsx # 审批人策略配置弹窗
│   │   │   │   └── MobileFormEditor.tsx      # 移动端表单编辑器
│   │   │   └── views/                # 视图组件目录
│   │   │       ├── MobileFormRenderer.tsx    # 移动端表单渲染器
│   │   │       ├── ProjectListView.tsx       # 项目列表视图
│   │   │       ├── RecordListView.tsx        # 记录列表视图
│   │   │       ├── Sidebar.tsx              # 模块侧边栏
│   │   │       └── SystemLogView.tsx         # 系统日志视图
│   │   │
│   │   ├── archives/                  # 档案库模块组件
│   │   │   ├── ArchiveExplorer.tsx    # 档案浏览器
│   │   │   ├── ArchiveFileCard.tsx   # 档案文件卡片
│   │   │   ├── ArchiveLogButton.tsx  # 档案日志按钮
│   │   │   ├── ArchiveLogView.tsx    # 档案日志查看
│   │   │   ├── ArchiveSettingsModal.tsx # 档案设置弹窗
│   │   │   ├── ArchiveStatsView.tsx  # 档案统计视图
│   │   │   ├── EnterpriseArchiveView.tsx # 企业档案视图
│   │   │   ├── EquipmentArchiveView.tsx # 设备档案视图
│   │   │   ├── EquipmentCard.tsx     # 设备卡片
│   │   │   ├── EquipmentCreateModal.tsx # 创建设备弹窗
│   │   │   ├── EquipmentDetailModal.tsx # 设备详情弹窗
│   │   │   ├── FileEditModal.tsx      # 文件编辑弹窗
│   │   │   ├── FileUploadModal.tsx    # 文件上传弹窗
│   │   │   ├── MSDSArchiveView.tsx   # MSDS档案视图
│   │   │   ├── PersonnelArchiveView.tsx # 人员档案视图
│   │   │   ├── PersonnelCard.tsx     # 人员卡片
│   │   │   ├── PersonnelDetailModal.tsx # 人员详情弹窗
│   │   │   ├── SecurePDFViewer.tsx   # 安全 PDF 查看器（防复制/打印）
│   │   │   ├── SettingsButton.tsx     # 设置按钮
│   │   │   └── Pagination.tsx         # 分页组件
│   │   │
│   │   ├── incident/                  # 事故事件模块组件
│   │   │   ├── IncidentReportModal.tsx # 事故上报弹窗
│   │   │   └── IncidentDetailModal.tsx # 事故详情弹窗
│   │   │
│   │   ├── storage/                   # 存储模块组件
│   │   │   ├── FileUploader.tsx      # 文件上传组件
│   │   │   └── PresignedUploader.tsx  # 预签名上传组件
│   │   │
│   │   ├── workflow/                  # 工作流组件
│   │   │   ├── StrategyConfigPanel.tsx     # 策略配置面板
│   │   │   ├── WorkflowSteps.tsx           # 工作流步骤组件
│   │   │   ├── WorkflowStrategySelector.tsx # 策略选择器
│   │   │   ├── converter.ts               # 工作流数据转换
│   │   │   ├── index.ts                   # 导出入口
│   │   │   ├── types.ts                   # 工作流类型定义
│   │   │   └── utils.ts                   # 工作流工具函数
│   │   │
│   │   ├── training/                  # 培训模块组件
│   │   │   ├── AutoAssignBuilder.tsx # 自动派发规则构建器
│   │   │   ├── ExamEditor.tsx        # 考试编辑器
│   │   │   └── FileViewer.tsx        # 文件查看器（PDF/视频）
│   │   │
│   │   ├── ActivityLogViewer.tsx     # 活动日志查看器（全局组件）
│   │   ├── ExcelPrintPreview.tsx     # Excel 打印预览（全局组件）
│   │   └── Layout.tsx                # 页面布局组件
│   │
│   ├── lib/                           # 核心工具库
│   │   ├── apiClient.ts              # API 客户端封装
│   │   ├── utils.ts                  # 样式工具函数 (cn)
│   │   ├── permissions.ts            # 权限管理工具
│   │   ├── workflowUtils.ts          # 工作流工具函数
│   │   ├── peopleFinder.ts           # 人员查找器
│   │   ├── converter.ts              # 文件转换工具 (PDF)
│   │   ├── constants.ts             # 系统常量定义
│   │   ├── business-constants.ts    # 业务常量定义（业务编码规范等）
│   │   ├── prisma.ts                # Prisma 客户端
│   │   ├── db.ts                    # 数据库工具
│   │   ├── logger.ts                # 日志工具
│   │   ├── startup.ts               # 启动工具
│   │   ├── minio.ts                 # MinIO 客户端
│   │   ├── minio-auto-start.ts      # MinIO 自动启动工具
│   │   ├── notificationService.ts   # 通知服务（服务端）
│   │   ├── archiveUploadHelper.ts   # 档案上传辅助工具
│   │   ├── audit-middleware.ts      # 审计中间件
│   │   ├── audit-utils.ts           # 审计工具函数
│   │   ├── htmlSanitizer.ts         # HTML 清理工具（XSS防护）
│   │   └── mockDb.ts                # 模拟数据库（测试用）
│   │
│   ├── hooks/                         # React Hooks 目录
│   │   ├── index.ts                  # Hooks 导出入口
│   │   ├── useApiError.ts            # API 错误处理 Hook
│   │   ├── useDateRange.ts           # 日期范围选择 Hook
│   │   ├── useMinioImageUrl.ts       # MinIO 图片 URL Hook
│   │   ├── useMinioUpload.ts         # MinIO 文件上传 Hook
│   │   ├── useOfflineStorage.ts      # 离线存储 Hook
│   │   └── useSignature.ts           # 签名管理 Hook
│   │
│   ├── context/                       # React Context 目录
│   │   └── AuthContext.tsx           # 认证上下文
│   │
│   ├── utils/                         # 工具函数目录
│   │   ├── fileImport.ts            # 文件导入工具 (CSV/XLSX)
│   │   ├── departmentUtils.ts       # 部门工具函数
│   │   ├── templateParser.ts        # 模板解析工具
│   │   ├── signatureCrop.ts         # 签名裁剪工具
│   │   ├── mobileDataTransformer.ts # 移动端数据转换
│   │   ├── a4-column-width.ts       # A4 列宽计算工具
│   │   ├── activityLogger.ts        # 活动日志记录工具
│   │   ├── checkTypeMapping.ts      # 检查类型映射工具
│   │   ├── dataMapper.ts            # 数据映射工具
│   │   ├── dataMasking.ts           # 数据脱敏工具
│   │   ├── dateUtils.ts             # 日期工具函数
│   │   ├── errorLogger.ts           # 错误日志工具
│   │   ├── hazardExcelExport.ts     # 隐患 Excel 导出工具
│   │   ├── jsonUtils.ts             # JSON 工具函数
│   │   ├── logMiddleware.ts         # 日志中间件
│   │   ├── requestAdapter.ts        # 请求适配器
│   │   └── storage.ts               # 本地存储工具
│   │
│   └── app/
│       └── api/                       # API 路由目录
│           ├── auth/
│           │   ├── login/route.ts              # POST /api/auth/login
│           │   └── logout/route.ts             # POST /api/auth/logout
│           │
│           ├── users/
│           │   ├── route.ts                    # GET/POST /api/users
│           │   ├── [id]/route.ts               # GET/PUT/DELETE /api/users/[id]
│           │   ├── [id]/reset-password/route.ts # POST /api/users/[id]/reset-password
│           │   ├── by-dept/route.ts            # GET /api/users/by-dept
│           │   ├── search/route.ts             # GET /api/users/search
│           │   ├── batch-avatar/route.ts       # POST /api/users/batch-avatar
│           │   └── batch-permissions/route.ts  # POST /api/users/batch-permissions
│           │
│           ├── org/
│           │   ├── route.ts                    # GET/POST /api/org
│           │   ├── [id]/route.ts               # PUT/DELETE /api/org/[id]
│           │   └── reorder/route.ts            # POST /api/org/reorder（部门拖拽排序）
│           │
│           ├── dashboard/
│           │   └── stats/route.ts              # GET /api/dashboard/stats（仪表板统计）
│           │
│           ├── hazards/
│           │   ├── route.ts                    # GET/POST/PATCH /api/hazards
│           │   ├── config/route.ts             # GET/POST /api/hazards/config
│           │   ├── workflow/route.ts           # GET/POST /api/hazards/workflow
│           │   ├── extension/route.ts          # POST /api/hazards/extension（延期申请）
│           │   ├── void/route.ts               # POST /api/hazards/void（作废隐患）
│           │   ├── destroy/route.ts            # POST /api/hazards/destroy（彻底删除）
│           │   ├── [id]/workflow-step/route.ts  # POST /api/hazards/[id]/workflow-step
│           │   └── [id]/workflow-steps/route.ts # GET /api/hazards/[id]/workflow-steps
│           │
│           ├── permits/
│           │   ├── route.ts                    # GET/POST /api/permits
│           │   ├── approve/route.ts            # POST /api/permits/approve
│           │   └── sections/append/route.ts    # POST /api/permits/sections/append
│           │
│           ├── sub-permits/
│           │   └── route.ts                    # GET/POST /api/sub-permits
│           │
│           ├── projects/
│           │   └── route.ts                    # GET/POST /api/projects
│           │
│           ├── templates/
│           │   ├── route.ts                    # GET/POST /api/templates
│           │   └── [id]/parse/route.ts         # POST /api/templates/[id]/parse
│           │
│           ├── docs/
│           │   ├── route.ts                    # GET/POST /api/docs
│           │   ├── [id]/route.ts               # GET/PUT/DELETE /api/docs/[id]
│           │   ├── convert/route.ts            # POST /api/docs/convert
│           │   ├── convert-excel/route.ts      # POST /api/docs/convert-excel
│           │   └── watermark/route.ts          # GET/POST /api/docs/watermark
│           │
│           ├── training/
│           │   ├── materials/route.ts          # GET/POST
│           │   ├── materials/[id]/route.ts     # GET/PUT/DELETE
│           │   ├── materials/[id]/thumbnail/route.ts
│           │   ├── materials/[id]/import-questions/route.ts
│           │   ├── materials/[id]/download-template/route.ts
│           │   ├── tasks/route.ts              # GET/POST
│           │   ├── tasks/[id]/route.ts         # GET/PUT/DELETE
│           │   ├── assignment/[id]/route.ts    # GET/PATCH
│           │   ├── exam/[assignmentId]/start/route.ts
│           │   ├── learned/route.ts            # GET/POST
│           │   ├── my-tasks/route.ts           # GET
│           │   ├── progress/route.ts           # GET
│           │   ├── stats/route.ts              # GET
│           │   └── settings/route.ts           # GET/POST
│           │
│           ├── notifications/
│           │   └── route.ts                    # GET/PATCH /api/notifications
│           │
│           ├── logs/
│           │   └── route.ts                    # GET /api/logs
│           │
│           ├── backup/
│           │   ├── route.ts                    # GET/POST /api/backup
│           │   ├── stats/route.ts              # GET /api/backup/stats
│           │   └── verify/route.ts             # POST /api/backup/verify
│           │
│           ├── data-protection/
│           │   ├── route.ts                    # GET/POST /api/data-protection
│           │   ├── download/route.ts           # GET /api/data-protection/download
│           │   └── verify/route.ts             # POST /api/data-protection/verify
│           │
│           ├── admin/
│           │   ├── logs/route.ts               # GET /api/admin/logs
│           │   ├── notifications/route.ts      # GET/POST /api/admin/notifications
│           │   ├── notification-templates/route.ts # GET/POST
│           │   ├── ai-api/route.ts             # GET/POST /api/admin/ai-api
│           │   ├── stats/route.ts              # GET /api/admin/stats（管理统计）
│           │   └── system/archive-logs/route.ts # POST /api/admin/system/archive-logs
│           │
│           ├── ai/
│           │   └── invoke/route.ts             # POST /api/ai/invoke
│           │
│           ├── auto-assign-rules/
│           │   └── route.ts                    # GET/POST /api/auto-assign-rules
│           │
│           ├── files/
│           │   ├── [...path]/route.ts          # GET /api/files/[...path]
│           │   └── check/route.ts              # GET /api/files/check
│           │
│           ├── storage/
│           │   ├── presigned-url/route.ts      # POST /api/storage/presigned-url
│           │   ├── file-url/route.ts           # GET /api/storage/file-url（获取文件URL）
│           │   └── status/route.ts             # GET /api/storage/status
│           │
│           ├── archives/
│           │   ├── config/route.ts             # GET/PUT /api/archives/config
│           │   ├── enterprise/route.ts         # GET/POST
│           │   ├── equipment/route.ts          # GET/POST
│           │   ├── equipment/[id]/files/route.ts
│           │   ├── equipment/inspection-reminder/route.ts # GET
│           │   ├── personnel/route.ts          # GET
│           │   ├── personnel/[id]/files/route.ts # GET/POST
│           │   ├── msds/route.ts               # GET/POST
│           │   ├── files/[id]/route.ts         # GET/PUT/DELETE
│           │   └── stats/route.ts              # GET /api/archives/stats
│           │
│           ├── health/route.ts                 # GET /api/health（健康检查）
│           ├── init/route.ts                   # GET/POST /api/init
│           └── structure/route.ts              # GET /api/structure
│
└── (其他配置文件...)
```

### 📊 文件统计

- **公共组件**: 15 个签名/公共/认证/审计组件 + 8 个基础UI组件 + 20 个作业许可组件 + 20 个档案库组件 + 3 个培训组件 + 2 个事故事件组件 + 2 个存储组件 + 8 个工作流组件 + 3 个全局组件 = **80+ 个组件**
- **工具函数**: 20 个核心工具库（lib/）+ 18 个工具函数（utils/）= **38+ 个工具模块**
- **自定义 Hooks**: 7 个 React Hooks
- **API 路由**: 25+ 个主要模块，**90+ 个 API 端点**

### 🗂️ 目录说明

- **`src/components/common/`**: 全局通用组件，可在任何模块中使用
- **`src/components/work-permit/moduls/`**: 作业许可模块专用弹窗组件
- **`src/components/work-permit/views/`**: 作业许可模块视图组件
- **`src/lib/`**: 核心工具库，提供系统级功能（API、权限、工作流、MinIO等）
- **`src/hooks/`**: React 自定义 Hooks，封装通用状态逻辑
- **`src/utils/`**: 业务工具函数，提供特定业务场景的辅助功能
- **`src/context/`**: React Context，提供全局状态管理
- **`src/app/api/`**: Next.js App Router API 路由，按功能模块组织

---

## 一、公共弹窗组件 (Modal/Dialog)

### 1. 通用组件 (`src/components/common/`)

#### 1.1 SignatureManager - 手写签名管理器
**路径**: `src/components/common/SignatureManager.tsx`

**功能**: 统一的手写签名管理组件，支持单个签名和多人签名两种模式

**主要特性**:
- 自动裁剪和缩放（保存时自动裁剪空白区域并缩放50%）
- 多人签名支持
- 数据兼容（自动兼容旧数据格式）
- 响应式设计

**使用示例**:
```tsx
import { SignatureManager } from '@/components/common';

<SignatureManager
  value={signature}
  onChange={(value) => setSignature(value)}
  allowMultiple={true}
/>
```

**导出**: 通过 `src/components/common/index.ts` 导出

---

#### 1.2 签名子组件 (`src/components/common/signature/`)

| 组件 | 说明 |
|------|------|
| `HandwrittenSignature.tsx` | 手写签名画板（Canvas 绘制） |
| `MultiSignatureDisplay.tsx` | 多人签名展示（支持姓名+图片） |
| `SignatureImage.tsx` | 签名图片展示（带验证状态） |

---

#### 1.3 PeopleSelector - 人员/部门选择器
**路径**: `src/components/common/PeopleSelector.tsx`

**功能**: 组织架构树形选择器，支持选择用户或部门

**模式**:
- `user`: 仅选择用户
- `dept`: 仅选择部门
- `dept_then_user`: 先选部门再选用户

**Props**:
```tsx
interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (result: UserLite[] | OrgNode[]) => void;
  mode: SelectorMode;
  multiSelect?: boolean;
  title?: string;
}
```

**使用示例**:
```tsx
<PeopleSelector
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  onConfirm={(result) => console.log(result)}
  mode="dept_then_user"
  multiSelect={true}
/>
```

---

#### 1.4 Toast - 消息提示组件
**路径**: `src/components/common/Toast.tsx`

**功能**: 全局消息提示系统，支持成功、错误、警告、信息四种类型

**Hook**: `useToast()`

**方法**:
- `showToast(toast)`: 显示自定义提示
- `success(message, description?)`: 成功提示
- `error(message, description?)`: 错误提示
- `warning(message, description?)`: 警告提示
- `info(message, description?)`: 信息提示
- `permissionDenied(action?)`: 权限不足提示

**使用示例**:
```tsx
import { useToast } from '@/components/common/Toast';

const { success, error } = useToast();
success('操作成功');
error('操作失败', '详细错误信息');
```

---

#### 1.5 ErrorBoundary - 错误边界
**路径**: `src/components/common/ErrorBoundary.tsx`

**功能**: React 错误边界组件，捕获子组件树中的错误，已在根布局中全局应用

---

#### 1.6 Loading - 加载组件
**路径**: `src/components/common/Loading.tsx`

**功能**: 统一的加载状态显示组件

---

#### 1.7 NotificationPanel - 通知面板
**路径**: `src/components/common/NotificationPanel.tsx`

**功能**: 系统通知列表展示组件，支持已读/未读状态管理

---

#### 1.8 PermissionDenied - 权限不足提示
**路径**: `src/components/common/PermissionDenied.tsx`

**功能**: 权限不足时的提示页面组件

---

#### 1.9 Watermark - 水印组件
**路径**: `src/components/common/Watermark.tsx`

**功能**: 文档预览水印功能，支持自定义文字

---

#### 1.10 Breadcrumbs - 面包屑导航
**路径**: `src/components/common/Breadcrumbs.tsx`

**功能**: 页面面包屑导航组件

---

#### 1.11 Sidebar - 侧边栏组件
**路径**: `src/components/common/Sidebar.tsx`

**功能**: 系统主侧边栏导航组件，支持权限控制显示菜单项

---

### 2. 认证相关组件 (`src/components/auth/`)

#### 2.1 ChangePasswordForm - 密码修改表单
**路径**: `src/components/auth/change-password-form.tsx`

**功能**: 用户密码修改表单组件

**主要特性**:
- React Hook Form 表单管理
- Zod 客户端验证
- Server Action 服务端处理
- 实时密码验证
- 密码可见性切换

**使用示例**:
```tsx
import { ChangePasswordForm } from '@/components/auth/change-password-form';

<ChangePasswordForm />
```

---

#### 2.2 ChangePasswordModal - 密码修改弹窗
**路径**: `src/components/auth/ChangePasswordModal.tsx`

**功能**: 密码修改弹窗组件，弹窗形式集成密码修改表单

---

### 3. 审计日志组件 (`src/components/audit/`)

#### 3.1 LogTimeline - 日志时间轴
**路径**: `src/components/audit/LogTimeline.tsx`

**功能**: 展示操作日志的时间轴视图，支持业务编码和操作人信息展示

---

#### 3.2 LogSnapshotViewer - 快照查看器
**路径**: `src/components/audit/LogSnapshotViewer.tsx`

**功能**: 查看操作后的对象完整快照（JSON 格式展示）

---

#### 3.3 LogDiffViewer - 差异对比查看器
**路径**: `src/components/audit/LogDiffViewer.tsx`

**功能**: 对比操作前后的数据差异，支持字段级别高亮显示

---

### 4. 基础UI组件 (`src/components/ui/`)

#### 4.1 Button - 按钮组件
**路径**: `src/components/ui/button.tsx`

**功能**: 统一的按钮组件，支持多种变体（default, destructive, outline, ghost, link）

---

#### 4.2 Card - 卡片组件
**路径**: `src/components/ui/card.tsx`

**功能**: 卡片容器组件，包含 CardHeader、CardContent、CardFooter

---

#### 4.3 Dialog - 对话框组件
**路径**: `src/components/ui/dialog.tsx`

**功能**: 基于 Radix UI 的对话框组件，支持动画和无障碍访问

---

#### 4.4 Badge - 徽章组件
**路径**: `src/components/ui/badge.tsx`

**功能**: 徽章标签组件，用于状态展示

---

#### 4.5 Calendar - 日历组件
**路径**: `src/components/ui/calendar.tsx`

**功能**: 基于 react-day-picker 的日历组件，支持日期选择

---

#### 4.6 Popover - 弹出框组件
**路径**: `src/components/ui/popover.tsx`

**功能**: 基于 Radix UI 的弹出框组件，常与日历配合作为日期选择器

---

#### 4.7 ScrollArea - 滚动区域组件
**路径**: `src/components/ui/scroll-area.tsx`

**功能**: 自定义滚动区域组件，美化系统滚动条样式

---

#### 4.8 Tooltip - 工具提示组件
**路径**: `src/components/ui/tooltip.tsx`

**功能**: 基于 Radix UI 的工具提示组件，鼠标悬浮显示说明文字

---

### 5. 作业许可模块弹窗 (`src/components/work-permit/moduls/`)

#### 5.1 AddPermitModal - 新建作业许可弹窗
**路径**: `src/components/work-permit/moduls/AddPermitModal.tsx`

**功能**: 创建新的作业许可记录，选择模板并填写基础信息

---

#### 5.2 EditTemplateModal - 编辑模板弹窗
**路径**: `src/components/work-permit/moduls/EditTemplateModal.tsx`

**功能**: 编辑作业许可模板（名称、类型、工作流配置等）

---

#### 5.3 RecordDetailModal - 记录详情弹窗
**路径**: `src/components/work-permit/moduls/RecordDetailModal.tsx`

**功能**: 查看作业许可记录详情，支持审批流程展示和签名

---

#### 5.4 WorkflowEditorModal - 工作流编辑器弹窗
**路径**: `src/components/work-permit/moduls/WorkflowEditorModal.tsx`

**功能**: 编辑审批工作流配置，支持多步骤、或签/会签模式

---

#### 5.5 TemplateManageModal - 模板管理弹窗
**路径**: `src/components/work-permit/moduls/TemplateManageModal.tsx`

**功能**: 管理作业许可模板，查看模板列表、创建、删除

---

#### 5.6 ProjectDetailModal - 项目详情弹窗
**路径**: `src/components/work-permit/moduls/ProjectDetailModal.tsx`

**功能**: 查看项目详细信息（申请方、监管方、承包商）

---

#### 5.7 NewProjectModal - 新建项目弹窗
**路径**: `src/components/work-permit/moduls/NewProjectModal.tsx`

**功能**: 创建新项目，填写项目基础信息

---

#### 5.8 TemplateBindingModal - 模板绑定弹窗
**路径**: `src/components/work-permit/moduls/TemplateBindingModal.tsx`

**功能**: 绑定二级模板（子表单）到主模板的指定单元格

---

#### 5.9 SectionFormModal - 分段表单弹窗
**路径**: `src/components/work-permit/moduls/SectionFormModal.tsx`

**功能**: 处理动态记录型模板的分段表单填写和追加记录

---

#### 5.10 AttachmentViewModal - 附件查看弹窗
**路径**: `src/components/work-permit/moduls/AttachmentViewModal.tsx`

**功能**: 查看和预览作业许可附件文件

---

#### 5.11 ApprovalModal - 审批弹窗
**路径**: `src/components/work-permit/moduls/ApprovalModal.tsx`

**功能**: 作业许可审批操作（通过/驳回），支持填写审批意见和电子签名

---

#### 5.12 AdjustDateModal - 调整日期弹窗
**路径**: `src/components/work-permit/moduls/AdjustDateModal.tsx`

**功能**: 调整项目开始/结束日期

---

#### 5.13 ApproverStrategyConfig - 审批人策略配置
**路径**: `src/components/work-permit/moduls/ApproverStrategyConfig.tsx`

**功能**: 配置工作流步骤的审批人匹配策略（固定人员、部门负责人、角色等）

---

#### 5.14 MobileFormEditor - 移动端表单编辑器
**路径**: `src/components/work-permit/moduls/MobileFormEditor.tsx`

**功能**: 移动端表单字段配置编辑器，定义在移动端显示哪些字段

---

### 6. 作业许可视图组件 (`src/components/work-permit/views/`)

#### 6.1 MobileFormRenderer - 移动端表单渲染器
**路径**: `src/components/work-permit/views/MobileFormRenderer.tsx`

**功能**: 移动端友好的表单渲染组件

---

#### 6.2 ProjectListView - 项目列表视图
**路径**: `src/components/work-permit/views/ProjectListView.tsx`

**功能**: 项目列表展示组件

---

#### 6.3 RecordListView - 记录列表视图
**路径**: `src/components/work-permit/views/RecordListView.tsx`

**功能**: 作业许可记录列表展示组件，支持状态筛选

---

#### 6.4 SystemLogView - 系统日志视图
**路径**: `src/components/work-permit/views/SystemLogView.tsx`

**功能**: 作业许可模块的系统日志展示组件

---

### 7. 档案库模块组件 (`src/components/archives/`)

#### 7.1 ArchiveExplorer - 档案浏览器
**路径**: `src/components/archives/ArchiveExplorer.tsx`

**功能**: 档案文件浏览和管理，支持分类切换

---

#### 7.2 SecurePDFViewer - 安全 PDF 查看器
**路径**: `src/components/archives/SecurePDFViewer.tsx`

**功能**: 安全的 PDF 文档查看器，防止复制和打印（基于 pdfjs-dist）

---

#### 7.3 EnterpriseArchiveView - 企业档案视图
**路径**: `src/components/archives/EnterpriseArchiveView.tsx`

**功能**: 企业档案列表和分类管理（基础资质、三同时、双重预防等）

---

#### 7.4 EquipmentArchiveView - 设备档案视图
**路径**: `src/components/archives/EquipmentArchiveView.tsx`

**功能**: 设备档案管理，支持定检提醒和特种设备标记

---

#### 7.5 PersonnelArchiveView - 人员档案视图
**路径**: `src/components/archives/PersonnelArchiveView.tsx`

**功能**: 一人一档人员档案管理，支持培训记录和资质证书管理

---

#### 7.6 MSDSArchiveView - MSDS档案视图
**路径**: `src/components/archives/MSDSArchiveView.tsx`

**功能**: MSDS（化学品安全技术说明书）档案管理

---

#### 7.7 EquipmentDetailModal / PersonnelDetailModal / FileUploadModal
**功能**: 设备详情查看、人员档案详情、档案文件上传弹窗

---

#### 7.8 ArchiveStatsView - 档案统计视图
**路径**: `src/components/archives/ArchiveStatsView.tsx`

**功能**: 显示档案统计数据（培训覆盖率、资质证书到期、定检预警等）

---

### 8. 事故事件模块组件 (`src/components/incident/`)

#### 8.1 IncidentReportModal - 事故上报弹窗
**路径**: `src/components/incident/IncidentReportModal.tsx`

**功能**: 上报事故事件，填写事故类型、严重程度、地点、描述

---

#### 8.2 IncidentDetailModal - 事故详情弹窗
**路径**: `src/components/incident/IncidentDetailModal.tsx`

**功能**: 查看事故详情、提交5Why调查报告、CAPA整改措施、审批结案

---

### 9. 存储模块组件 (`src/components/storage/`)

#### 9.1 FileUploader - 文件上传组件
**路径**: `src/components/storage/FileUploader.tsx`

**功能**: 通用文件上传组件，支持拖拽上传，文件存储至 MinIO

---

#### 9.2 PresignedUploader - 预签名上传组件
**路径**: `src/components/storage/PresignedUploader.tsx`

**功能**: 使用预签名URL直接上传文件到 MinIO，绕过应用服务器

---

### 10. 全局组件

#### 10.1 ActivityLogViewer - 活动日志查看器
**路径**: `src/components/ActivityLogViewer.tsx`

**功能**: 查看实体的活动日志历史（通用组件，可嵌入各模块页面）

---

#### 10.2 ExcelPrintPreview - Excel 打印预览
**路径**: `src/components/ExcelPrintPreview.tsx`

**功能**: Excel 表格的打印预览组件，支持 A4 纸张布局优化

---

---

## 二、公共工具函数

### 1. API 客户端 (`src/lib/apiClient.ts`)

#### 1.1 apiFetch - 增强的 Fetch 函数
**功能**: 自动添加认证头、处理 JSON 转换、错误处理

**使用**:
```tsx
import { apiFetch } from '@/lib/apiClient';

const response = await apiFetch('/api/users', {
  method: 'POST',
  body: { name: 'John' }
});
```

---

#### 1.2 ApiClient 类
**方法**:
- `ApiClient.get<T>(url, params?)`: GET 请求
- `ApiClient.post<T>(url, data?)`: POST 请求
- `ApiClient.put<T>(url, data?)`: PUT 请求
- `ApiClient.patch<T>(url, data?)`: PATCH 请求
- `ApiClient.delete<T>(url, params?)`: DELETE 请求
- `ApiClient.upload<T>(url, formData)`: 文件上传

**使用**:
```tsx
import { ApiClient } from '@/lib/apiClient';

const users = await ApiClient.get('/api/users', { page: 1 });
await ApiClient.post('/api/users', { name: 'John' });
```

---

#### 1.3 ApiError 类
**功能**: API 错误处理类

**方法**:
- `isPermissionError()`: 判断是否是权限错误 (403)
- `isAuthError()`: 判断是否是认证错误 (401)

---

### 2. 样式工具 (`src/lib/utils.ts`)

#### 2.1 cn - 类名合并函数
**功能**: 合并 Tailwind CSS 类名，处理冲突

**使用**:
```tsx
import { cn } from '@/lib/utils';

<div className={cn('bg-red-500', isActive && 'bg-blue-500')} />
```

---

### 3. 权限管理 (`src/lib/permissions.ts`)

#### 3.1 PermissionManager 类
**静态方法**:
- `hasPermission(user, module, permission)`: 检查用户是否拥有指定权限
- `canAccessModule(user, module)`: 检查用户是否可以访问模块
- `getModulePermissions(user, module)`: 获取用户在模块的所有权限
- `hasAnyPermission(user, module, permissions)`: 检查是否拥有任一权限
- `hasAllPermissions(user, module, permissions)`: 检查是否拥有所有权限
- `requirePermission(user, module, permission)`: 要求权限，否则抛出错误
- `validatePermissions(permissions)`: 验证权限配置有效性
- `getAllModules()`: 获取所有可用模块
- `getModuleAvailablePermissions(module)`: 获取模块的所有可用权限

**使用**:
```tsx
import { PermissionManager } from '@/lib/permissions';

if (PermissionManager.hasPermission(user, 'hidden_danger', 'report')) {
  // 允许上报隐患
}
```

---

#### 3.2 createPermissionChecker - 权限检查器工厂
**功能**: 创建用户专属的权限检查器

**使用**:
```tsx
import { createPermissionChecker } from '@/lib/permissions';

const checker = createPermissionChecker(user);
if (checker.has('hidden_danger', 'report')) {
  // ...
}
```

---

### 4. 工作流工具 (`src/lib/workflowUtils.ts`)

#### 4.1 resolveApprovers - 审批人解析器
**功能**: 根据工作流配置解析审批人列表

**支持的策略**:
- `fixed`: 指定固定人员
- `current_dept_manager`: 当前部门负责人
- `specific_dept_manager`: 指定部门负责人
- `role`: 指定角色
- `template_field_manager`: 从模板字段匹配部门负责人
- `template_text_match`: 根据文本字段内容路由
- `template_option_match`: 根据选项字段勾选状态路由

---

#### 4.2 findSupervisor - 查找直属上级
**功能**: 查找用户的直属上级（Point-to-Point + 部门树兜底）

---

#### 4.3 findApproverByRole - 按角色查找审批人
**功能**: 按角色向上查找审批人（如 EHS 经理、安全员等）

---

### 5. 人员查找器 (`src/lib/peopleFinder.ts`)

#### 5.1 PeopleFinder 类
**静态方法**:
- `findUserById(userId)`: 根据ID查找用户
- `findDeptManager(deptId)`: 查找部门负责人
- `findUserDeptManager(userId)`: 查找用户所在部门的负责人
- `findSupervisor(userId)`: 查找用户的主管
- `findByJobTitle(deptId, jobTitle)`: 根据职位查找用户
- `findDeptManagerByName(deptName)`: 根据部门名称查找负责人
- `findUsersByStrategy(strategy, config, context)`: 根据策略查找用户

---

### 6. MinIO 客户端 (`src/lib/minio.ts`)

**功能**: MinIO 对象存储客户端封装，提供文件上传、下载、删除等操作

**主要函数**:
- `uploadFile(bucket, key, buffer, mimeType)`: 上传文件
- `getFileUrl(bucket, key)`: 获取文件 URL
- `getPresignedUploadUrl(bucket, key, expiry)`: 获取预签名上传 URL
- `deleteFile(bucket, key)`: 删除文件
- `checkMinioHealth()`: 检查 MinIO 健康状态

---

### 7. 通知服务 (`src/lib/notificationService.ts`)

**功能**: 服务端通知发送服务

**主要函数**:
- `sendNotification(userId, type, title, content)`: 发送通知
- `sendBatchNotifications(userIds, type, title, content)`: 批量发送通知

---

### 8. 审计工具 (`src/lib/audit-utils.ts`, `src/lib/audit-middleware.ts`)

**功能**: 审计日志记录辅助工具

**主要功能**:
- `buildAuditLog(user, module, action, target, snapshot, diff)`: 构建审计日志
- `withAudit(handler)`: 审计中间件，自动记录操作日志

---

### 9. HTML 清理工具 (`src/lib/htmlSanitizer.ts`)

**功能**: 清理 HTML 内容，防止 XSS 注入攻击

---

### 10. 档案上传辅助 (`src/lib/archiveUploadHelper.ts`)

**功能**: 档案文件上传辅助工具，支持文件类型验证和路径生成

---

### 11. 文件导入工具 (`src/utils/fileImport.ts`)

#### 11.1 parseTableFile - 解析表格文件
**功能**: 统一解析 CSV 或 XLSX 文件为表格结构

**返回**:
```tsx
interface ParsedTable {
  type: 'csv' | 'xlsx';
  headers: string[];
  rows: string[][];
  objects: Record<string, string>[];
  encoding?: string;
}
```

---

#### 11.2 pick - 从对象中按候选键读取值
**功能**: 从对象行中按多个候选键读取值（用于表格导入字段兼容）

---

### 12. 部门工具 (`src/utils/departmentUtils.ts`)

| 函数 | 说明 |
|------|------|
| `getDepartmentManager` | 获取部门负责人 |
| `getUserSupervisor` | 获取用户主管 |
| `getDepartmentById` | 根据ID查找部门 |
| `getDepartmentByName` | 根据名称查找部门 |
| `findDeptRecursive` | 递归查找部门 |
| `getSubDepartments` | 获取所有下属部门（递归） |
| `getParentDepartments` | 获取所有上级部门路径 |
| `getDepartmentFullPath` | 获取部门完整路径名称 |
| `getDepartmentUsers` | 获取部门所有用户（含子部门） |
| `buildDepartmentTree` | 构建树形部门结构 |
| `flattenDepartmentTree` | 扁平化部门树 |
| `matchDepartment` | 智能模糊匹配部门名称 |

---

### 13. 模板解析工具 (`src/utils/templateParser.ts`)

| 函数 | 说明 |
|------|------|
| `parseTemplateFields` | 从Excel模板结构中提取字段定义 |
| `autoCalculateColumnWidths` | 自动计算Excel模板各列最优宽度 |
| `checkCellLineBreaks` | 检测模板中包含换行符的单元格 |

---

### 14. 隐患 Excel 导出 (`src/utils/hazardExcelExport.ts`)

**功能**: 将隐患记录列表导出为格式化的 Excel 文件

**使用**:
```tsx
import { exportHazardsToExcel } from '@/utils/hazardExcelExport';

exportHazardsToExcel(hazards, filename);
```

---

### 15. 数据脱敏工具 (`src/utils/dataMasking.ts`)

**功能**: 对敏感数据进行脱敏处理（手机号、身份证等）

---

### 16. 日期工具 (`src/utils/dateUtils.ts`)

**功能**: 常用日期格式化、计算工具函数（基于 date-fns）

---

### 17. 检查类型映射 (`src/utils/checkTypeMapping.ts`)

**功能**: 隐患检查类型的值和显示名称映射工具

---

### 18. A4 列宽计算工具 (`src/utils/a4-column-width.ts`)

**功能**: 计算 A4 纸张内 Excel 表格各列的最优宽度（含测试）

---

### 19. 其他工具函数

| 文件 | 说明 |
|------|------|
| `signatureCrop.ts` | 签名图片裁剪和缩放工具 |
| `mobileDataTransformer.ts` | 移动端数据格式转换工具 |
| `activityLogger.ts` | 活动日志记录工具 |
| `dataMapper.ts` | 数据字段映射工具 |
| `errorLogger.ts` | 错误日志记录工具 |
| `jsonUtils.ts` | JSON 安全解析和序列化工具 |
| `logMiddleware.ts` | API 请求日志中间件 |
| `requestAdapter.ts` | 请求参数适配器（兼容不同格式） |
| `storage.ts` | 本地存储（localStorage）工具 |
| `converter.ts` (`src/lib/`) | PPTX/DOCX 转 PDF 工具 |

---

## 三、React 自定义 Hooks (`src/hooks/`)

### 1. useApiError - API 错误处理
**路径**: `src/hooks/useApiError.ts`

**功能**: 统一处理 API 调用错误，自动显示错误提示

**使用**:
```tsx
import { useApiError } from '@/hooks/useApiError';

const { handleError } = useApiError();
try {
  await ApiClient.post('/api/hazards', data);
} catch (err) {
  handleError(err); // 自动显示错误 Toast
}
```

---

### 2. useDateRange - 日期范围选择
**路径**: `src/hooks/useDateRange.ts`

**功能**: 管理日期范围选择状态，集成日历组件

---

### 3. useMinioImageUrl - MinIO 图片 URL
**路径**: `src/hooks/useMinioImageUrl.ts`

**功能**: 解析 MinIO 存储路径，返回可访问的图片 URL（处理私有桶签名）

**使用**:
```tsx
const imageUrl = useMinioImageUrl('private:avatars/user123.jpg');
// 返回: https://minio.example.com/private/avatars/user123.jpg?X-Amz-Signature=...
```

---

### 4. useMinioUpload - MinIO 文件上传
**路径**: `src/hooks/useMinioUpload.ts`

**功能**: 封装 MinIO 预签名上传流程，支持进度回调

**使用**:
```tsx
const { upload, uploading, progress } = useMinioUpload();
await upload(file, 'public', 'docs/');
```

---

### 5. useOfflineStorage - 离线存储
**路径**: `src/hooks/useOfflineStorage.ts`

**功能**: 管理本地离线数据缓存，支持表单草稿自动保存

---

### 6. useSignature - 签名管理
**路径**: `src/hooks/useSignature.ts`

**功能**: 管理电子签名状态（签名数据、验证、清除）

---

---

## 四、公共 API 接口

### 1. 认证相关 (`/api/auth/`)

#### POST `/api/auth/login`
**请求体**: `{ username, password }`
**响应**: `{ user, token }`

#### POST `/api/auth/logout`
**功能**: 清除用户会话

---

### 2. 用户管理 (`/api/users/`)

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/users` | GET | 获取用户列表（支持分页和搜索） |
| `/api/users` | POST | 创建新用户 |
| `/api/users/[id]` | GET | 获取指定用户信息 |
| `/api/users/[id]` | PUT | 更新用户信息 |
| `/api/users/[id]` | DELETE | 删除用户 |
| `/api/users/[id]/reset-password` | POST | 重置用户密码（管理员） |
| `/api/users/by-dept` | GET | 根据部门获取用户列表 |
| `/api/users/search` | GET | 搜索用户 |
| `/api/users/batch-avatar` | POST | 批量更新用户头像 |
| `/api/users/batch-permissions` | POST | 批量更新用户权限 |

---

### 3. 组织架构 (`/api/org/`)

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/org` | GET | 获取组织架构树 |
| `/api/org` | POST | 创建部门 |
| `/api/org/[id]` | PUT | 更新部门信息 |
| `/api/org/[id]` | DELETE | 删除部门 |
| `/api/org/reorder` | POST | 拖拽排序（更新部门 sortOrder） |

---

### 4. 仪表板 (`/api/dashboard/`)

#### GET `/api/dashboard/stats`
**功能**: 获取系统实时统计数据

**响应**:
```json
{
  "hazards": { "total": 0, "open": 0, "overdue": 0 },
  "permits": { "total": 0, "active": 0 },
  "incidents": { "total": 0, "open": 0 },
  "training": { "total": 0, "completion_rate": 0 }
}
```

---

### 5. 隐患管理 (`/api/hazards/`)

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/hazards` | GET | 获取隐患列表（分页、筛选、搜索） |
| `/api/hazards` | POST | 创建隐患记录 |
| `/api/hazards` | PATCH | 更新隐患记录 |
| `/api/hazards/config` | GET | 获取隐患配置 |
| `/api/hazards/config` | POST | 更新隐患配置 |
| `/api/hazards/workflow` | GET | 获取工作流配置 |
| `/api/hazards/workflow` | POST | 更新工作流配置 |
| `/api/hazards/extension` | POST | 申请延期 |
| `/api/hazards/void` | POST | 作废隐患（软删除） |
| `/api/hazards/destroy` | POST | 彻底删除隐患（管理员） |
| `/api/hazards/[id]/workflow-step` | POST | 执行工作流步骤操作 |
| `/api/hazards/[id]/workflow-steps` | GET | 获取隐患工作流步骤列表 |

**PATCH 工作流操作**:
```json
{
  "id": "string",
  "action": "assign|rectify|verify|extend|void",
  "data": { ... }
}
```

---

### 6. 作业许可 (`/api/permits/`)

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/permits` | GET | 获取作业许可列表 |
| `/api/permits` | POST | 创建作业许可 |
| `/api/permits/approve` | POST | 审批作业许可 |
| `/api/permits/sections/append` | POST | 追加动态记录型分段表单 |

---

### 7. 子表单管理 (`/api/sub-permits/`)

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/sub-permits` | GET | 获取子表单列表（按 parentPermitId 筛选） |
| `/api/sub-permits` | POST | 创建子表单 |

---

### 8. 培训管理 (`/api/training/`)

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/training/materials` | GET/POST | 培训材料列表/创建 |
| `/api/training/materials/[id]` | GET/PUT/DELETE | 材料详情/更新/删除 |
| `/api/training/materials/[id]/thumbnail` | POST | 生成缩略图 |
| `/api/training/materials/[id]/import-questions` | POST | 导入考试题目 |
| `/api/training/materials/[id]/download-template` | GET | 下载题目导入模板 |
| `/api/training/tasks` | GET/POST | 培训任务列表/创建 |
| `/api/training/tasks/[id]` | GET/PUT/DELETE | 任务详情/更新/删除 |
| `/api/training/assignment/[id]` | GET/PATCH | 获取/更新分配（学习进度、考试结果） |
| `/api/training/exam/[assignmentId]/start` | POST | 开始考试 |
| `/api/training/learned` | GET/POST | 学习记录查询/记录 |
| `/api/training/my-tasks` | GET | 当前用户的培训任务 |
| `/api/training/progress` | GET | 培训进度统计 |
| `/api/training/stats` | GET | 培训统计数据 |
| `/api/training/settings` | GET/POST | 培训系统设置 |

---

### 9. 文档管理 (`/api/docs/`)

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/docs` | GET | 文档列表（分页、筛选、搜索） |
| `/api/docs` | POST | 上传文档 |
| `/api/docs/[id]` | GET/PUT/DELETE | 文档详情/更新/删除 |
| `/api/docs/convert` | POST | 文档格式转换（DOCX→PDF） |
| `/api/docs/convert-excel` | POST | Excel 文档转换 |
| `/api/docs/watermark` | GET/POST | 水印配置读写 |

---

### 10. 档案库系统 (`/api/archives/`)

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/archives/config` | GET/PUT | 档案库配置（文件类型、水印等） |
| `/api/archives/enterprise` | GET/POST | 企业档案文件列表/上传 |
| `/api/archives/equipment` | GET/POST | 设备列表/创建设备 |
| `/api/archives/equipment/[id]/files` | GET | 设备文件列表 |
| `/api/archives/equipment/inspection-reminder` | GET | 定检提醒列表 |
| `/api/archives/personnel` | GET | 人员档案列表 |
| `/api/archives/personnel/[id]/files` | GET/POST | 人员档案文件列表/上传 |
| `/api/archives/msds` | GET/POST | MSDS 文件列表/上传 |
| `/api/archives/files/[id]` | GET/PUT/DELETE | 档案文件详情/更新/删除 |
| `/api/archives/stats` | GET | 档案统计数据 |

---

### 11. 对象存储 (`/api/storage/`)

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/storage/presigned-url` | POST | 获取预签名上传 URL |
| `/api/storage/file-url` | GET | 获取文件访问 URL |
| `/api/storage/status` | GET | 存储服务健康状态 |

**预签名 URL 请求体**:
```json
{
  "bucket": "public|private",
  "key": "path/to/file.pdf",
  "expiry": 3600
}
```

---

### 12. 通知系统 (`/api/notifications/`)

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/notifications` | GET | 获取用户通知列表（支持 unreadOnly 参数） |
| `/api/notifications` | PATCH | 标记通知为已读 `{ ids: [...], all: false }` |

---

### 13. 系统日志 (`/api/logs/`)

#### GET `/api/logs`
**查询参数**: `page`, `limit`, `userId`, `module`, `targetType`, `startDate`, `endDate`

---

### 14. 备份管理 (`/api/backup/`)

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/backup` | GET | 获取备份状态 |
| `/api/backup` | POST | 手动触发备份 |
| `/api/backup/stats` | GET | 备份统计信息 |
| `/api/backup/verify` | POST | 验证备份文件完整性 |

---

### 15. 数据保护 (`/api/data-protection/`)

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/data-protection` | GET/POST | 数据保护状态/触发备份 |
| `/api/data-protection/download` | GET | 下载备份文件 |
| `/api/data-protection/verify` | POST | 验证备份文件 |

---

### 16. 管理后台 (`/api/admin/`)

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/admin/logs` | GET | 系统日志（管理后台视图） |
| `/api/admin/notifications` | GET/POST | 获取/发送通知 |
| `/api/admin/notification-templates` | GET/POST | 通知模板列表/创建 |
| `/api/admin/ai-api` | GET/POST | AI API 配置管理 |
| `/api/admin/stats` | GET | 管理统计数据 |
| `/api/admin/system/archive-logs` | POST | 手动触发日志归档 |

---

### 17. AI API (`/api/ai/`)

#### POST `/api/ai/invoke`
**请求体**:
```json
{
  "configName": "string",
  "prompt": "string",
  "maxTokens": 2000
}
```

---

### 18. 自动派发规则 (`/api/auto-assign-rules/`)

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/auto-assign-rules` | GET | 获取自动派发规则列表 |
| `/api/auto-assign-rules` | POST | 创建自动派发规则 |

---

### 19. 文件服务 (`/api/files/`)

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/files/[...path]` | GET | 获取文件内容（本地文件服务） |
| `/api/files/check` | GET | 检查文件是否存在 |

---

### 20. 系统工具

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 系统健康检查 |
| `/api/init` | GET/POST | 系统初始化 |
| `/api/structure` | GET | 获取组织架构数据 |

---

## 五、API 通用特性

### 1. 认证中间件
所有 API 路由使用 `withAuth` 中间件进行认证验证

### 2. 权限中间件
部分 API 使用 `withPermission` 或 `withAdmin` 中间件进行权限验证

### 3. 错误处理
所有 API 使用 `withErrorHandling` 中间件进行统一错误处理

### 4. 操作日志
关键操作使用 `logApiOperation` 或 `SystemLogService` 记录系统日志

### 5. 审计日志
重要操作自动记录审计日志，包含：
- 操作人信息（用户、角色、部门）
- 操作对象信息（业务编号、类型、描述）
- 操作快照和差异对比
- 客户端环境信息

### 6. 分页支持
列表类 API 支持分页参数：
- `page`: 页码（从1开始）
- `limit`: 每页数量

### 7. 搜索支持
列表类 API 支持搜索参数：
- `q`: 搜索关键词

---

## 六、使用建议

### 1. 组件使用
- 优先使用公共组件，避免重复开发
- 弹窗组件统一使用 `isOpen` 和 `onClose` 控制显示
- 使用 TypeScript 类型定义确保类型安全
- 文件上传优先使用 `PresignedUploader`（直传 MinIO，性能更好）

### 2. API 调用
- 统一使用 `ApiClient` 或 `apiFetch` 进行 API 调用
- 使用 TypeScript 泛型指定返回类型
- 正确处理错误和加载状态
- 配合 `useApiError` Hook 统一处理错误提示

### 3. 权限检查
- 前端使用 `PermissionManager` 进行权限检查
- 后端 API 使用 `withPermission` 中间件验证权限
- 权限不足时显示友好的提示信息（`PermissionDenied` 组件）

### 4. 工具函数
- 优先使用现有工具函数，避免重复实现
- 工具函数都有完整的 TypeScript 类型定义
- 注意函数的副作用和性能影响

### 5. 文件存储
- 使用 `src/lib/minio.ts` 进行对象存储操作
- 文件路径格式：`bucket:path/to/file`（如 `public:docs/file.pdf`）
- 使用 `useMinioImageUrl` Hook 在前端显示私有桶图片

---

*最后更新: 2026年2月*
