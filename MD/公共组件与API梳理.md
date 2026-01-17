# 公共组件、函数与 API 梳理文档

本文档梳理了 EHS 系统中所有的公共弹窗组件、公共工具函数和公共 API 接口。

## 📁 文件树状结构图

```
ehs-system1.0/
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
│   │   │   └── Sidebar.tsx          # 侧边栏组件
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
│   │   │   └── scroll-area.tsx        # 滚动区域组件
│   │   │
│   │   ├── work-permit/              # 作业许可模块组件
│   │   │   └── moduls/               # 弹窗组件目录
│   │   │       ├── AddPermitModal.tsx        # 新建作业许可弹窗
│   │   │       ├── EditTemplateModal.tsx     # 编辑模板弹窗
│   │   │       ├── RecordDetailModal.tsx     # 记录详情弹窗
│   │   │       ├── WorkflowEditorModal.tsx   # 工作流编辑器弹窗
│   │   │       ├── TemplateManageModal.tsx   # 模板管理弹窗
│   │   │       ├── ProjectDetailModal.tsx    # 项目详情弹窗
│   │   │       ├── NewProjectModal.tsx        # 新建项目弹窗
│   │   │       ├── TemplateBindingModal.tsx  # 模板绑定弹窗
│   │   │       ├── SectionFormModal.tsx      # 分段表单弹窗
│   │   │       ├── AttachmentViewModal.tsx   # 附件查看弹窗
│   │   │       ├── ApprovalModal.tsx         # 审批弹窗
│   │   │       └── AdjustDateModal.tsx        # 调整日期弹窗
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
│   │   │   ├── SettingsButton.tsx     # 设置按钮
│   │   │   └── Pagination.tsx         # 分页组件
│   │   │
│   │   ├── incident/                  # 事故事件模块组件
│   │   │   ├── IncidentReportModal.tsx # 事故上报弹窗
│   │   │   └── IncidentDetailModal.tsx # 事故详情弹窗
│   │   │
│   │   └── storage/                   # 存储模块组件
│   │       ├── FileUploader.tsx      # 文件上传组件
│   │       └── PresignedUploader.tsx  # 预签名上传组件
│   │
│   ├── lib/                           # 核心工具库
│   │   ├── apiClient.ts              # API 客户端封装
│   │   ├── utils.ts                  # 样式工具函数 (cn)
│   │   ├── permissions.ts            # 权限管理工具
│   │   ├── workflowUtils.ts          # 工作流工具函数
│   │   ├── peopleFinder.ts           # 人员查找器
│   │   ├── converter.ts              # 文件转换工具 (PDF)
│   │   ├── constants.ts             # 系统常量定义
│   │   ├── prisma.ts                # Prisma 客户端
│   │   ├── db.ts                    # 数据库工具
│   │   ├── logger.ts                # 日志工具
│   │   └── startup.ts               # 启动工具
│   │
│   ├── utils/                         # 工具函数目录
│   │   ├── fileImport.ts            # 文件导入工具 (CSV/XLSX)
│   │   ├── departmentUtils.ts       # 部门工具函数
│   │   ├── templateParser.ts        # 模板解析工具
│   │   ├── signatureCrop.ts         # 签名裁剪工具
│   │   └── mobileDataTransformer.ts # 移动端数据转换
│   │
│   └── app/
│       └── api/                       # API 路由目录
│           ├── auth/
│           │   ├── login/
│           │   │   └── route.ts              # POST /api/auth/login
│           │   └── logout/
│           │       └── route.ts              # POST /api/auth/logout
│           │
│           ├── users/
│           │   ├── route.ts                  # GET/POST /api/users
│           │   ├── [id]/
│           │   │   └── route.ts              # GET/PUT/DELETE /api/users/[id]
│           │   ├── by-dept/
│           │   │   └── route.ts              # GET /api/users/by-dept
│           │   ├── search/
│           │   │   └── route.ts              # GET /api/users/search
│           │   ├── batch-avatar/
│           │   │   └── route.ts              # POST /api/users/batch-avatar
│           │   └── batch-permissions/
│           │       └── route.ts              # POST /api/users/batch-permissions
│           │
│           ├── org/
│           │   ├── route.ts                  # GET/POST /api/org
│           │   └── [id]/
│           │       └── route.ts              # PUT/DELETE /api/org/[id]
│           │
│           ├── hazards/
│           │   ├── route.ts                  # GET/POST/PATCH /api/hazards
│           │   ├── config/
│           │   │   └── route.ts              # GET/POST /api/hazards/config
│           │   └── workflow/
│           │       └── route.ts              # GET/POST /api/hazards/workflow
│           │
│           ├── permits/
│           │   ├── route.ts                  # GET/POST /api/permits
│           │   ├── [id]/
│           │   │   └── route.ts              # GET/PUT/DELETE /api/permits/[id]
│           │   ├── approve/
│           │   │   └── route.ts              # POST /api/permits/approve
│           │   └── sections/
│           │       └── append/
│           │           └── route.ts          # POST /api/permits/sections/append
│           │
│           ├── sub-permits/
│           │   └── route.ts                  # GET/POST /api/sub-permits
│           │
│           ├── projects/
│           │   └── route.ts                  # GET/POST /api/projects
│           │
│           ├── templates/
│           │   ├── route.ts                  # GET/POST /api/templates
│           │   └── [id]/
│           │       ├── route.ts             # GET/PUT/DELETE /api/templates/[id]
│           │       └── parse/
│           │           └── route.ts          # POST /api/templates/[id]/parse
│           │
│           ├── docs/
│           │   ├── route.ts                 # GET/POST /api/docs
│           │   ├── [id]/
│           │   │   └── route.ts             # GET/PUT/DELETE /api/docs/[id]
│           │   └── watermark/
│           │       └── route.ts             # GET/POST /api/docs/watermark
│           │
│           ├── training/
│           │   ├── materials/
│           │   │   ├── route.ts             # GET/POST /api/training/materials
│           │   │   └── [id]/
│           │   │       ├── route.ts         # GET/PUT/DELETE /api/training/materials/[id]
│           │   │       └── thumbnail/
│           │   │           └── route.ts     # POST /api/training/materials/[id]/thumbnail
│           │   │
│           │   ├── tasks/
│           │   │   ├── route.ts             # GET/POST /api/training/tasks
│           │   │   └── [id]/
│           │   │       └── route.ts         # GET/PUT/DELETE /api/training/tasks/[id]
│           │   │
│           │   ├── assignment/
│           │   │   └── [id]/
│           │   │       └── route.ts         # GET/PATCH /api/training/assignment/[id]
│           │   │
│           │   ├── learned/
│           │   │   └── route.ts             # GET/POST /api/training/learned
│           │   │
│           │   ├── my-tasks/
│           │   │   └── route.ts             # GET /api/training/my-tasks
│           │   │
│           │   ├── progress/
│           │   │   └── route.ts             # GET /api/training/progress
│           │   │
│           │   ├── stats/
│           │   │   └── route.ts             # GET /api/training/stats
│           │   │
│           │   └── settings/
│           │       └── route.ts             # GET/POST /api/training/settings
│           │
│           ├── upload/
│           │   └── route.ts                 # POST /api/upload
│           │
│           ├── notifications/
│           │   └── route.ts                 # GET/PATCH /api/notifications
│           │
│           ├── logs/
│           │   └── route.ts                 # GET /api/logs
│           │
│           ├── backup/
│           │   ├── route.ts                 # GET/POST /api/backup
│           │   ├── stats/
│           │   │   └── route.ts             # GET /api/backup/stats
│           │   └── verify/
│           │       └── route.ts             # POST /api/backup/verify
│           │
│           ├── data-protection/
│           │   ├── route.ts                 # GET/POST /api/data-protection
│           │   ├── download/
│           │   │   └── route.ts             # GET /api/data-protection/download
│           │   └── verify/
│           │       └── route.ts             # POST /api/data-protection/verify
│           │
│           ├── notifications/
│           │   ├── route.ts                 # GET/PATCH /api/notifications
│           │   └── templates/
│           │       └── [id]/
│           │           └── route.ts         # GET/PUT/DELETE /api/notifications/templates/[id]
│           │
│           ├── admin/
│           │   ├── logs/
│           │   │   └── route.ts            # GET /api/admin/logs
│           │   ├── notifications/
│           │   │   └── route.ts            # GET/POST /api/admin/notifications
│           │   ├── notification-templates/
│           │   │   └── route.ts            # GET/POST /api/admin/notification-templates
│           │   ├── ai-api/
│           │   │   └── route.ts             # GET/POST /api/admin/ai-api
│           │   └── system/
│           │       └── archive-logs/
│           │           └── route.ts         # POST /api/admin/system/archive-logs
│           │
│           ├── ai/
│           │   └── invoke/
│           │       └── route.ts            # POST /api/ai/invoke
│           │
│           ├── auto-assign-rules/
│           │   └── route.ts                 # GET/POST /api/auto-assign-rules
│           │
│           ├── files/
│           │   ├── [...path]/
│           │   │   └── route.ts            # GET /api/files/[...path]
│           │   └── check/
│           │       └── route.ts            # GET /api/files/check
│           │
│           ├── storage/
│           │   ├── presigned-url/
│           │   │   └── route.ts            # POST /api/storage/presigned-url
│           │   └── status/
│           │       └── route.ts            # GET /api/storage/status
│           │
│           ├── archives/
│           │   ├── config/
│           │   │   └── route.ts            # GET/PUT /api/archives/config
│           │   ├── enterprise/
│           │   │   └── route.ts            # GET/POST /api/archives/enterprise
│           │   ├── equipment/
│           │   │   ├── route.ts            # GET/POST /api/archives/equipment
│           │   │   ├── [id]/
│           │   │   │   └── route.ts         # GET/PUT/DELETE /api/archives/equipment/[id]
│           │   │   └── inspection-reminder/
│           │   │       └── route.ts         # GET /api/archives/equipment/inspection-reminder
│           │   ├── personnel/
│           │   │   ├── route.ts            # GET /api/archives/personnel
│           │   │   └── [id]/
│           │   │       └── files/
│           │   │           └── route.ts     # GET/POST /api/archives/personnel/[id]/files
│           │   ├── msds/
│           │   │   └── route.ts            # GET/POST /api/archives/msds
│           │   ├── files/
│           │   │   └── [id]/
│           │   │       └── route.ts         # GET/PUT/DELETE /api/archives/files/[id]
│           │   └── stats/
│           │       └── route.ts            # GET /api/archives/stats
│           │
│           ├── init/
│           │   └── route.ts                 # GET/POST /api/init
│           │
│           └── structure/
│               └── route.ts                 # GET /api/structure
│
└── (其他配置文件...)
```

### 📊 文件统计

- **公共组件**: 10 个通用组件 + 3 个认证组件 + 3 个审计组件 + 5 个基础UI组件 + 12 个作业许可弹窗组件 + 17 个档案库组件 + 2 个事故事件组件 + 2 个存储组件 = **54+ 个组件**
- **工具函数**: 10+ 个核心工具库 + 5 个工具函数文件 = **15+ 个工具模块**
- **API 路由**: 25+ 个主要模块，**90+ 个 API 端点**

### 🗂️ 目录说明

- **`src/components/common/`**: 全局通用组件，可在任何模块中使用
- **`src/components/work-permit/moduls/`**: 作业许可模块专用弹窗组件
- **`src/lib/`**: 核心工具库，提供系统级功能（API、权限、工作流等）
- **`src/utils/`**: 业务工具函数，提供特定业务场景的辅助功能
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

#### 1.2 PeopleSelector - 人员/部门选择器
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

#### 1.3 Toast - 消息提示组件
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

#### 1.4 ErrorBoundary - 错误边界
**路径**: `src/components/common/ErrorBoundary.tsx`

**功能**: React 错误边界组件，捕获子组件树中的错误

**使用**: 已在根布局中全局应用

---

#### 1.5 Loading - 加载组件
**路径**: `src/components/common/Loading.tsx`

**功能**: 统一的加载状态显示组件

---

#### 1.6 NotificationPanel - 通知面板
**路径**: `src/components/common/NotificationPanel.tsx`

**功能**: 系统通知列表展示组件

---

#### 1.7 PermissionDenied - 权限不足提示
**路径**: `src/components/common/PermissionDenied.tsx`

**功能**: 权限不足时的提示页面

---

#### 1.8 Watermark - 水印组件
**路径**: `src/components/common/Watermark.tsx`

**功能**: 文档预览水印功能

---

#### 1.9 Breadcrumbs - 面包屑导航
**路径**: `src/components/common/Breadcrumbs.tsx`

**功能**: 页面面包屑导航组件

---

#### 1.10 Sidebar - 侧边栏组件
**路径**: `src/components/common/Sidebar.tsx`

**功能**: 系统侧边栏导航组件

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

**功能**: 密码修改弹窗组件

---

### 3. 审计日志组件 (`src/components/audit/`)

#### 3.1 LogTimeline - 日志时间轴
**路径**: `src/components/audit/LogTimeline.tsx`

**功能**: 展示操作日志的时间轴视图

---

#### 3.2 LogSnapshotViewer - 快照查看器
**路径**: `src/components/audit/LogSnapshotViewer.tsx`

**功能**: 查看操作后的对象快照

---

#### 3.3 LogDiffViewer - 差异对比查看器
**路径**: `src/components/audit/LogDiffViewer.tsx`

**功能**: 对比操作前后的数据差异

---

### 4. 基础UI组件 (`src/components/ui/`)

#### 4.1 Button - 按钮组件
**路径**: `src/components/ui/button.tsx`

**功能**: 统一的按钮组件，支持多种变体

---

#### 4.2 Card - 卡片组件
**路径**: `src/components/ui/card.tsx`

**功能**: 卡片容器组件

---

#### 4.3 Dialog - 对话框组件
**路径**: `src/components/ui/dialog.tsx`

**功能**: 基于 Radix UI 的对话框组件

---

#### 4.4 Badge - 徽章组件
**路径**: `src/components/ui/badge.tsx`

**功能**: 徽章标签组件

---

#### 4.5 ScrollArea - 滚动区域组件
**路径**: `src/components/ui/scroll-area.tsx`

**功能**: 自定义滚动区域组件

---

### 5. 作业许可模块弹窗 (`src/components/work-permit/moduls/`)

### 2. 作业许可模块弹窗 (`src/components/work-permit/moduls/`)

#### 2.1 AddPermitModal - 新建作业许可弹窗
**路径**: `src/components/work-permit/moduls/AddPermitModal.tsx`

**功能**: 创建新的作业许可记录

---

#### 2.2 EditTemplateModal - 编辑模板弹窗
**路径**: `src/components/work-permit/moduls/EditTemplateModal.tsx`

**功能**: 编辑作业许可模板

---

#### 2.3 RecordDetailModal - 记录详情弹窗
**路径**: `src/components/work-permit/moduls/RecordDetailModal.tsx`

**功能**: 查看作业许可记录详情，支持审批流程展示

---

#### 2.4 WorkflowEditorModal - 工作流编辑器弹窗
**路径**: `src/components/work-permit/moduls/WorkflowEditorModal.tsx`

**功能**: 编辑审批工作流配置

---

#### 2.5 TemplateManageModal - 模板管理弹窗
**路径**: `src/components/work-permit/moduls/TemplateManageModal.tsx`

**功能**: 管理作业许可模板

---

#### 2.6 ProjectDetailModal - 项目详情弹窗
**路径**: `src/components/work-permit/moduls/ProjectDetailModal.tsx`

**功能**: 查看项目详细信息

---

#### 2.7 NewProjectModal - 新建项目弹窗
**路径**: `src/components/work-permit/moduls/NewProjectModal.tsx`

**功能**: 创建新项目

---

#### 2.8 TemplateBindingModal - 模板绑定弹窗
**路径**: `src/components/work-permit/moduls/TemplateBindingModal.tsx`

**功能**: 绑定二级模板到主模板

---

#### 2.9 SectionFormModal - 分段表单弹窗
**路径**: `src/components/work-permit/moduls/SectionFormModal.tsx`

**功能**: 处理分段表单的填写和编辑

---

#### 2.10 AttachmentViewModal - 附件查看弹窗
**路径**: `src/components/work-permit/moduls/AttachmentViewModal.tsx`

**功能**: 查看和预览附件

---

#### 2.11 ApprovalModal - 审批弹窗
**路径**: `src/components/work-permit/moduls/ApprovalModal.tsx`

**功能**: 作业许可审批操作

---

#### 2.12 AdjustDateModal - 调整日期弹窗
**路径**: `src/components/work-permit/moduls/AdjustDateModal.tsx`

**功能**: 调整项目日期

---

### 6. 档案库模块组件 (`src/components/archives/`)

#### 6.1 ArchiveExplorer - 档案浏览器
**路径**: `src/components/archives/ArchiveExplorer.tsx`

**功能**: 档案文件浏览和管理

---

#### 6.2 EnterpriseArchiveView - 企业档案视图
**路径**: `src/components/archives/EnterpriseArchiveView.tsx`

**功能**: 企业档案列表和分类管理

---

#### 6.3 EquipmentArchiveView - 设备档案视图
**路径**: `src/components/archives/EquipmentArchiveView.tsx`

**功能**: 设备档案管理，支持定检提醒

---

#### 6.4 PersonnelArchiveView - 人员档案视图
**路径**: `src/components/archives/PersonnelArchiveView.tsx`

**功能**: 一人一档人员档案管理

---

#### 6.5 MSDSArchiveView - MSDS档案视图
**路径**: `src/components/archives/MSDSArchiveView.tsx`

**功能**: MSDS（化学品安全技术说明书）档案管理

---

#### 6.6 EquipmentDetailModal - 设备详情弹窗
**路径**: `src/components/archives/EquipmentDetailModal.tsx`

**功能**: 查看和编辑设备详细信息

---

#### 6.7 PersonnelDetailModal - 人员详情弹窗
**路径**: `src/components/archives/PersonnelDetailModal.tsx`

**功能**: 查看人员档案详情

---

#### 6.8 FileUploadModal - 文件上传弹窗
**路径**: `src/components/archives/FileUploadModal.tsx`

**功能**: 档案文件上传（支持MinIO）

---

#### 6.9 FileEditModal - 文件编辑弹窗
**路径**: `src/components/archives/FileEditModal.tsx`

**功能**: 编辑档案文件信息

---

#### 6.10 ArchiveSettingsModal - 档案设置弹窗
**路径**: `src/components/archives/ArchiveSettingsModal.tsx`

**功能**: 配置档案库设置（文件类型、水印等）

---

#### 6.11 ArchiveStatsView - 档案统计视图
**路径**: `src/components/archives/ArchiveStatsView.tsx`

**功能**: 显示档案统计数据

---

#### 6.12 ArchiveLogView - 档案日志查看
**路径**: `src/components/archives/ArchiveLogView.tsx`

**功能**: 查看档案操作日志

---

### 7. 事故事件模块组件 (`src/components/incident/`)

#### 7.1 IncidentReportModal - 事故上报弹窗
**路径**: `src/components/incident/IncidentReportModal.tsx`

**功能**: 上报事故事件

---

#### 7.2 IncidentDetailModal - 事故详情弹窗
**路径**: `src/components/incident/IncidentDetailModal.tsx`

**功能**: 查看事故详情、提交调查报告、审批结案

---

### 8. 存储模块组件 (`src/components/storage/`)

#### 8.1 FileUploader - 文件上传组件
**路径**: `src/components/storage/FileUploader.tsx`

**功能**: 通用文件上传组件，支持MinIO

---

#### 8.2 PresignedUploader - 预签名上传组件
**路径**: `src/components/storage/PresignedUploader.tsx`

**功能**: 使用预签名URL上传文件

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

**使用**:
```tsx
import { resolveApprovers } from '@/lib/workflowUtils';

const approvers = await resolveApprovers(
  applicantDept,
  workflowStep,
  formData,
  parsedFields
);
```

---

#### 4.2 findSupervisor - 查找直属上级
**功能**: 查找用户的直属上级（Point-to-Point + 部门树兜底）

**使用**:
```tsx
import { findSupervisor } from '@/lib/workflowUtils';

const supervisor = await findSupervisor(userId);
```

---

#### 4.3 findApproverByRole - 按角色查找审批人
**功能**: 按角色向上查找审批人

**使用**:
```tsx
import { findApproverByRole } from '@/lib/workflowUtils';

const approver = await findApproverByRole(applicantId, 'EHS经理');
```

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

**使用**:
```tsx
import { PeopleFinder } from '@/lib/peopleFinder';

const manager = await PeopleFinder.findDeptManager(deptId);
const supervisor = await PeopleFinder.findSupervisor(userId);
```

---

### 6. 文件导入工具 (`src/utils/fileImport.ts`)

#### 6.1 parseTableFile - 解析表格文件
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

**使用**:
```tsx
import { parseTableFile } from '@/utils/fileImport';

const table = await parseTableFile(file);
console.log(table.headers, table.rows);
```

---

#### 6.2 pick - 从对象中按候选键读取值
**功能**: 从对象行中按多个候选键读取值

**使用**:
```tsx
import { pick } from '@/utils/fileImport';

const name = pick(row, ['姓名', '名字', 'name'], '');
```

---

### 7. 部门工具 (`src/utils/departmentUtils.ts`)

#### 7.1 getDepartmentManager - 获取部门负责人
**功能**: 根据部门ID查找部门负责人

**使用**:
```tsx
import { getDepartmentManager } from '@/utils/departmentUtils';

const manager = getDepartmentManager(deptId, departments, allUsers);
```

---

#### 7.2 getUserSupervisor - 获取用户主管
**功能**: 查找用户的主管（处理用户本身是主管的情况）

**使用**:
```tsx
import { getUserSupervisor } from '@/utils/departmentUtils';

const supervisor = getUserSupervisor(userId, departments, allUsers);
```

---

#### 7.3 getDepartmentById - 根据ID查找部门
**功能**: 根据部门ID查找部门对象

---

#### 7.4 getDepartmentByName - 根据名称查找部门
**功能**: 根据部门名称查找部门对象

---

#### 7.5 findDeptRecursive - 递归查找部门
**功能**: 在树形部门结构中递归查找部门

---

#### 7.6 getSubDepartments - 获取下属部门
**功能**: 获取部门的所有下属部门（递归）

---

#### 7.7 getParentDepartments - 获取上级部门
**功能**: 获取部门的所有上级部门路径

---

#### 7.8 getDepartmentFullPath - 获取部门完整路径
**功能**: 获取部门的完整路径名称（从根到当前部门）

**使用**:
```tsx
const path = getDepartmentFullPath(deptId, departments);
// "公司 > EHS部 > EHS工程组"
```

---

#### 7.9 getDepartmentUsers - 获取部门用户
**功能**: 获取某个部门下的所有用户（包括子部门）

---

#### 7.10 buildDepartmentTree - 构建部门树
**功能**: 将扁平化的部门数组转换为树形结构

---

#### 7.11 flattenDepartmentTree - 扁平化部门树
**功能**: 将树形结构转换为扁平数组

---

#### 7.12 flattenDepartments - 扁平化部门（含路径）
**功能**: Excel导入专用，扁平化部门并包含完整路径信息

---

#### 7.13 matchDepartment - 智能匹配部门名称
**功能**: 支持完整路径、部分路径、精确匹配、模糊搜索

---

### 8. 模板解析工具 (`src/utils/templateParser.ts`)

#### 8.1 parseTemplateFields - 解析模板字段
**功能**: 从Excel模板结构数据中提取所有字段定义

**返回**: `ParsedField[]`

**使用**:
```tsx
import { parseTemplateFields } from '@/utils/templateParser';

const fields = parseTemplateFields(structureJson);
```

---

#### 8.2 autoCalculateColumnWidths - 自动计算列宽
**功能**: 自动计算Excel模板各列的最优宽度

**使用**:
```tsx
import { autoCalculateColumnWidths } from '@/utils/templateParser';

const widths = autoCalculateColumnWidths(structureJson);
```

---

#### 8.3 checkCellLineBreaks - 检测换行符
**功能**: 检测模板中包含换行符的单元格

---

### 9. 文件转换工具 (`src/lib/converter.ts`)

#### 9.1 convertToPdf - 转换为PDF
**功能**: 将PPTX/DOCX转换为PDF（优先使用LibreOffice，失败则创建占位PDF）

**使用**:
```tsx
import { convertToPdf } from '@/lib/converter';

const pdfPath = await convertToPdf(inputPath, originalFilename);
```

---

### 10. 其他工具函数

#### 10.1 signatureCrop (`src/utils/signatureCrop.ts`)
**功能**: 签名图片裁剪和缩放工具

---

#### 10.2 mobileDataTransformer (`src/utils/mobileDataTransformer.ts`)
**功能**: 移动端数据转换工具

---

## 三、公共 API 接口

### 1. 认证相关 (`/api/auth/`)

#### 1.1 POST `/api/auth/login`
**功能**: 用户登录

**请求体**:
```json
{
  "username": "string",
  "password": "string"
}
```

**响应**:
```json
{
  "user": { ... },
  "token": "string"
}
```

---

### 2. 用户管理 (`/api/users/`)

#### 2.1 GET `/api/users`
**功能**: 获取用户列表（支持分页和搜索）

**查询参数**:
- `page`: 页码
- `limit`: 每页数量
- `q`: 搜索关键词
- `dept`: 部门筛选

**响应**: 用户数组

---

#### 2.2 POST `/api/users`
**功能**: 创建新用户

**请求体**: 用户信息对象

---

#### 2.3 GET `/api/users/[id]`
**功能**: 获取指定用户信息

---

#### 2.4 PUT `/api/users/[id]`
**功能**: 更新用户信息

---

#### 2.5 DELETE `/api/users/[id]`
**功能**: 删除用户

---

#### 2.6 GET `/api/users/by-dept`
**功能**: 根据部门获取用户列表

---

#### 2.7 GET `/api/users/search`
**功能**: 搜索用户

---

#### 2.8 POST `/api/users/batch-avatar`
**功能**: 批量更新用户头像

---

#### 2.9 POST `/api/users/batch-permissions`
**功能**: 批量更新用户权限

---

#### 2.10 POST `/api/users/[id]/reset-password`
**功能**: 重置用户密码（管理员功能）

---

### 3. 组织架构 (`/api/org/`)

#### 3.1 GET `/api/org`
**功能**: 获取组织架构树

---

#### 3.2 POST `/api/org`
**功能**: 创建部门

---

#### 3.3 PUT `/api/org/[id]`
**功能**: 更新部门信息

---

#### 3.4 DELETE `/api/org/[id]`
**功能**: 删除部门

---

### 4. 隐患管理 (`/api/hazards/`)

#### 4.1 GET `/api/hazards`
**功能**: 获取隐患记录列表（支持分页、筛选、搜索）

**查询参数**:
- `page`: 页码
- `limit`: 每页数量
- `status`: 状态筛选
- `riskLevel`: 风险等级筛选
- `q`: 搜索关键词

---

#### 4.2 POST `/api/hazards`
**功能**: 创建隐患记录

---

#### 4.3 PATCH `/api/hazards`
**功能**: 更新隐患记录（支持工作流操作）

**请求体**:
```json
{
  "id": "string",
  "action": "assign|rectify|verify|extend",
  "data": { ... }
}
```

---

#### 4.4 GET `/api/hazards/config`
**功能**: 获取隐患配置

---

#### 4.5 POST `/api/hazards/config`
**功能**: 更新隐患配置

---

#### 4.6 GET `/api/hazards/workflow`
**功能**: 获取工作流配置

---

#### 4.7 POST `/api/hazards/workflow`
**功能**: 更新工作流配置

---

### 5. 作业许可 (`/api/permits/`)

#### 5.1 GET `/api/permits`
**功能**: 获取作业许可记录列表

---

#### 5.2 POST `/api/permits`
**功能**: 创建作业许可记录

---

#### 5.3 GET `/api/permits/[id]`
**功能**: 获取作业许可记录详情

---

#### 5.4 PUT `/api/permits/[id]`
**功能**: 更新作业许可记录

---

#### 5.5 DELETE `/api/permits/[id]`
**功能**: 删除作业许可记录

---

#### 5.6 POST `/api/permits/approve`
**功能**: 审批作业许可

---

### 6. 项目管理 (`/api/projects/`)

#### 6.1 GET `/api/projects`
**功能**: 获取项目列表

---

#### 6.2 POST `/api/projects`
**功能**: 创建项目

---

### 7. 模板管理 (`/api/templates/`)

#### 7.1 GET `/api/templates`
**功能**: 获取模板列表

---

#### 7.2 POST `/api/templates`
**功能**: 创建模板

---

#### 7.3 GET `/api/templates/[id]`
**功能**: 获取模板详情

---

#### 7.4 PUT `/api/templates/[id]`
**功能**: 更新模板

---

#### 7.5 DELETE `/api/templates/[id]`
**功能**: 删除模板

---

#### 7.6 POST `/api/templates/[id]/parse`
**功能**: 解析模板字段

---

### 8. 文档管理 (`/api/docs/`)

#### 8.1 GET `/api/docs`
**功能**: 获取文档列表（支持分页、筛选、搜索）

**查询参数**:
- `page`: 页码
- `limit`: 每页数量
- `dept`: 部门筛选
- `level`: 级别筛选
- `startDate`: 开始时间
- `endDate`: 结束时间
- `q`: 搜索关键词

---

#### 8.2 POST `/api/docs`
**功能**: 上传文档

---

#### 8.3 GET `/api/docs/[id]`
**功能**: 获取文档详情

---

#### 8.4 PUT `/api/docs/[id]`
**功能**: 更新文档信息

---

#### 8.5 DELETE `/api/docs/[id]`
**功能**: 删除文档

---

#### 8.6 GET `/api/docs/watermark`
**功能**: 获取文档水印配置

---

#### 8.7 POST `/api/docs/watermark`
**功能**: 更新文档水印配置

---

### 9. 培训管理 (`/api/training/`)

#### 9.1 培训材料 (`/api/training/materials/`)

##### GET `/api/training/materials`
**功能**: 获取培训材料列表

**查询参数**:
- `publicOnly`: 是否仅公共知识库

---

##### POST `/api/training/materials`
**功能**: 创建培训材料

---

##### GET `/api/training/materials/[id]`
**功能**: 获取培训材料详情

---

##### PUT `/api/training/materials/[id]`
**功能**: 更新培训材料

---

##### DELETE `/api/training/materials/[id]`
**功能**: 删除培训材料

---

##### POST `/api/training/materials/[id]/thumbnail`
**功能**: 生成培训材料缩略图

---

#### 9.2 培训任务 (`/api/training/tasks/`)

##### GET `/api/training/tasks`
**功能**: 获取培训任务列表

---

##### POST `/api/training/tasks`
**功能**: 创建培训任务

---

##### GET `/api/training/tasks/[id]`
**功能**: 获取培训任务详情

---

##### PUT `/api/training/tasks/[id]`
**功能**: 更新培训任务

---

##### DELETE `/api/training/tasks/[id]`
**功能**: 删除培训任务

---

#### 9.3 培训分配 (`/api/training/assignment/`)

##### GET `/api/training/assignment/[id]`
**功能**: 获取培训分配详情

---

##### PATCH `/api/training/assignment/[id]`
**功能**: 更新培训分配（学习进度、考试结果等）

---

#### 9.4 学习记录 (`/api/training/learned/`)

##### GET `/api/training/learned`
**功能**: 获取用户学习记录

---

##### POST `/api/training/learned`
**功能**: 记录学习进度

---

#### 9.5 我的任务 (`/api/training/my-tasks/`)

##### GET `/api/training/my-tasks`
**功能**: 获取当前用户的培训任务列表

---

#### 9.6 培训进度 (`/api/training/progress/`)

##### GET `/api/training/progress`
**功能**: 获取培训进度统计

---

#### 9.7 培训统计 (`/api/training/stats/`)

##### GET `/api/training/stats`
**功能**: 获取培训统计数据

---

#### 9.8 培训设置 (`/api/training/settings/`)

##### GET `/api/training/settings`
**功能**: 获取培训系统设置

---

##### POST `/api/training/settings`
**功能**: 更新培训系统设置

---

#### 9.9 考试相关 (`/api/training/exam/`)

##### POST `/api/training/exam/[assignmentId]/start`
**功能**: 开始考试

---

#### 9.10 培训材料导入 (`/api/training/materials/[id]/`)

##### POST `/api/training/materials/[id]/import-questions`
**功能**: 导入考试题目

---

##### GET `/api/training/materials/[id]/download-template`
**功能**: 下载题目导入模板

---

### 10. 文件上传 (`/api/upload/`)

#### 10.1 POST `/api/upload`
**功能**: 上传文件（支持图片、文档等）

**请求**: `FormData`

**响应**:
```json
{
  "url": "string",
  "filename": "string"
}
```

---

### 11. 通知 (`/api/notifications/`)

#### 11.1 GET `/api/notifications`
**功能**: 获取用户通知列表

---

#### 11.2 PATCH `/api/notifications`
**功能**: 标记通知为已读

---

### 12. 系统日志 (`/api/logs/`)

#### 12.1 GET `/api/logs`
**功能**: 获取系统操作日志

**查询参数**:
- `page`: 页码
- `limit`: 每页数量
- `userId`: 用户筛选
- `targetType`: 目标类型筛选

---

### 13. 数据保护 (`/api/data-protection/`)

#### 13.1 GET `/api/data-protection`
**功能**: 获取数据保护配置

---

#### 13.2 POST `/api/data-protection`
**功能**: 更新数据保护配置

---

### 14. 系统初始化 (`/api/init/`)

#### 14.1 POST `/api/init`
**功能**: 系统初始化（创建默认管理员等）

---

### 15. 组织架构 (`/api/structure/`)

#### 15.1 GET `/api/structure`
**功能**: 获取组织架构数据

---

### 16. 备份系统 (`/api/backup/`)

#### 16.1 GET `/api/backup`
**功能**: 获取备份状态

**查询参数**:
- `type`: 备份类型（database|files|logs|all）

---

#### 16.2 POST `/api/backup`
**功能**: 手动触发备份

**请求体**:
```json
{
  "action": "database-full" | "database-incremental" | "file-full" | "file-incremental" | "log-archive"
}
```

---

#### 16.3 GET `/api/backup/stats`
**功能**: 获取备份统计信息

---

#### 16.4 POST `/api/backup/verify`
**功能**: 验证备份文件完整性

---

### 17. 数据保护 (`/api/data-protection/`)

#### 17.1 GET `/api/data-protection`
**功能**: 获取备份文件列表

**查询参数**:
- `action=status`: 获取备份状态

---

#### 17.2 POST `/api/data-protection`
**功能**: 触发全量备份

---

#### 17.3 GET `/api/data-protection/download`
**功能**: 下载备份文件

---

#### 17.4 POST `/api/data-protection/verify`
**功能**: 验证备份文件

---

### 18. 通知管理 (`/api/notifications/`)

#### 18.1 GET `/api/notifications`
**功能**: 获取用户通知列表

**查询参数**:
- `unreadOnly`: 仅未读通知

---

#### 18.2 PATCH `/api/notifications`
**功能**: 标记通知为已读

**请求体**:
```json
{
  "ids": ["id1", "id2"],
  "all": false
}
```

---

#### 18.3 GET `/api/notifications/templates/[id]`
**功能**: 获取通知模板详情

---

#### 18.4 PUT `/api/notifications/templates/[id]`
**功能**: 更新通知模板

---

#### 18.5 DELETE `/api/notifications/templates/[id]`
**功能**: 删除通知模板

---

### 19. 管理后台 (`/api/admin/`)

#### 19.1 GET `/api/admin/logs`
**功能**: 获取系统日志（管理后台）

---

#### 19.2 GET `/api/admin/notifications`
**功能**: 获取所有通知（管理后台）

---

#### 19.3 POST `/api/admin/notifications`
**功能**: 发送系统通知

---

#### 19.4 GET `/api/admin/notification-templates`
**功能**: 获取通知模板列表

---

#### 19.5 POST `/api/admin/notification-templates`
**功能**: 创建通知模板

---

#### 19.6 GET `/api/admin/ai-api`
**功能**: 获取 AI API 配置列表

---

#### 19.7 POST `/api/admin/ai-api`
**功能**: 创建/更新 AI API 配置

---

#### 19.8 POST `/api/admin/system/archive-logs`
**功能**: 手动触发日志归档

---

### 20. AI API (`/api/ai/`)

#### 20.1 POST `/api/ai/invoke`
**功能**: 调用 AI API

**请求体**:
```json
{
  "configName": "string",
  "prompt": "string",
  "maxTokens": 2000
}
```

---

### 21. 自动派发规则 (`/api/auto-assign-rules/`)

#### 21.1 GET `/api/auto-assign-rules`
**功能**: 获取自动派发规则列表

---

#### 21.2 POST `/api/auto-assign-rules`
**功能**: 创建自动派发规则

---

### 22. 文件管理 (`/api/files/`)

#### 22.1 GET `/api/files/[...path]`
**功能**: 获取文件内容

---

#### 22.2 GET `/api/files/check`
**功能**: 检查文件是否存在

---

### 23. 存储服务 (`/api/storage/`)

#### 23.1 POST `/api/storage/presigned-url`
**功能**: 获取预签名URL（用于对象存储）

---

### 24. 文档转换 (`/api/docs/`)

#### 24.1 POST `/api/docs/convert`
**功能**: 转换文档格式

---

#### 24.2 POST `/api/docs/convert-excel`
**功能**: 转换Excel文档

---

### 25. 子表单管理 (`/api/sub-permits/`)

#### 25.1 GET `/api/sub-permits`
**功能**: 获取子表单列表

**查询参数**:
- `parentPermitId`: 父表单ID

---

#### 25.2 POST `/api/sub-permits`
**功能**: 创建子表单

---

### 26. 分段表单 (`/api/permits/sections/`)

#### 26.1 POST `/api/permits/sections/append`
**功能**: 追加分段表单记录（动态记录型模板）

---

### 27. 档案库系统 (`/api/archives/`)

#### 27.1 配置管理 (`/api/archives/config/`)

##### GET `/api/archives/config`
**功能**: 获取档案库配置（文件类型、水印等）

---

##### PUT `/api/archives/config`
**功能**: 更新档案库配置

---

#### 27.2 企业档案 (`/api/archives/enterprise/`)

##### GET `/api/archives/enterprise`
**功能**: 获取企业档案文件列表（支持分页、搜索、类型筛选）

---

##### POST `/api/archives/enterprise`
**功能**: 上传企业档案文件

---

#### 27.3 设备档案 (`/api/archives/equipment/`)

##### GET `/api/archives/equipment`
**功能**: 获取设备列表（支持分页、搜索）

---

##### POST `/api/archives/equipment`
**功能**: 创建设备档案

---

##### GET `/api/archives/equipment/[id]`
**功能**: 获取设备详情

---

##### PUT `/api/archives/equipment/[id]`
**功能**: 更新设备信息

---

##### DELETE `/api/archives/equipment/[id]`
**功能**: 删除设备

---

##### GET `/api/archives/equipment/inspection-reminder`
**功能**: 获取定检提醒列表

---

#### 27.4 人员档案 (`/api/archives/personnel/`)

##### GET `/api/archives/personnel`
**功能**: 获取人员档案列表（一人一档）

---

##### GET `/api/archives/personnel/[id]/files`
**功能**: 获取指定人员的档案文件列表

---

##### POST `/api/archives/personnel/[id]/files`
**功能**: 上传人员档案文件

---

#### 27.5 MSDS档案 (`/api/archives/msds/`)

##### GET `/api/archives/msds`
**功能**: 获取MSDS文件列表（支持分页、搜索、类型筛选）

---

##### POST `/api/archives/msds`
**功能**: 上传MSDS文件

---

#### 27.6 档案文件 (`/api/archives/files/`)

##### GET `/api/archives/files/[id]`
**功能**: 获取档案文件详情

---

##### PUT `/api/archives/files/[id]`
**功能**: 更新档案文件信息

---

##### DELETE `/api/archives/files/[id]`
**功能**: 删除档案文件

---

#### 27.7 档案统计 (`/api/archives/stats/`)

##### GET `/api/archives/stats`
**功能**: 获取档案统计数据（三级培训、资质证书、设备、定检预警等）

---

### 28. 对象存储 (`/api/storage/`)

#### 28.1 POST `/api/storage/presigned-url`
**功能**: 获取预签名URL（用于文件上传）

---

#### 28.2 GET `/api/storage/status`
**功能**: 获取存储服务状态

---

## 四、API 通用特性

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

### 5. 分页支持
列表类 API 支持分页参数：
- `page`: 页码（从1开始）
- `limit`: 每页数量

### 6. 搜索支持
列表类 API 支持搜索参数：
- `q`: 搜索关键词

### 7. 筛选支持
列表类 API 支持多种筛选参数，具体见各 API 文档

---

## 五、使用建议

### 1. 组件使用
- 优先使用公共组件，避免重复开发
- 弹窗组件统一使用 `isOpen` 和 `onClose` 控制显示
- 使用 TypeScript 类型定义确保类型安全

### 2. API 调用
- 统一使用 `ApiClient` 或 `apiFetch` 进行 API 调用
- 使用 TypeScript 泛型指定返回类型
- 正确处理错误和加载状态

### 3. 权限检查
- 前端使用 `PermissionManager` 进行权限检查
- 后端 API 使用 `withPermission` 中间件验证权限
- 权限不足时显示友好的提示信息

### 4. 工具函数
- 优先使用现有工具函数，避免重复实现
- 工具函数都有完整的 TypeScript 类型定义
- 注意函数的副作用和性能影响

---

---

## 六、新增功能模块

### 1. 备份系统
- **服务**: `src/services/backup/` - 数据库备份、文件备份、日志归档、备份调度
- **API**: `/api/backup/*` - 备份管理接口
- **特性**: 存算分离架构、增量备份（WAL + MD5）、自动调度

### 2. 审计日志系统
- **服务**: `src/services/audit.service.ts` - 审计日志服务
- **组件**: `src/components/audit/` - 日志查看组件
- **特性**: 模块隔离、快照对比、业务编号规范

### 3. 通知系统
- **API**: `/api/notifications/*` - 通知管理接口
- **模板**: `/api/admin/notification-templates/*` - 通知模板管理
- **特性**: 实时推送、模板变量、事件触发

### 4. AI API 管理
- **API**: `/api/ai/invoke` - AI API 调用
- **管理**: `/api/admin/ai-api` - AI API 配置管理
- **特性**: 多提供商支持、限流策略、调用日志

### 5. 密码修改功能
- **组件**: `src/components/auth/change-password-form.tsx`
- **Action**: `src/actions/settings.ts`
- **特性**: bcrypt 加密、实时验证、OAuth 兼容

### 6. 自动派发规则
- **API**: `/api/auto-assign-rules` - 自动派发规则管理
- **服务**: `src/services/autoAssign.service.ts`
- **特性**: 事件触发、条件规则、培训任务自动分配

### 7. 事故事件管理
- **API**: `/api/incident/*` - 事故上报、调查、审批、结案
- **服务**: `src/services/incident.service.ts`
- **组件**: `src/components/incident/` - 事故上报、详情查看
- **特性**: 5Why分析法、CAPA整改措施、工作流集成、电子签名

### 8. EHS档案库系统
- **API**: `/api/archives/*` - 企业/设备/人员/MSDS档案管理
- **服务**: `src/services/archive-service.ts`
- **组件**: `src/components/archives/` - 档案管理组件
- **特性**: 分类管理、定检提醒、一人一档、档案日志

### 9. 子表单系统
- **API**: `/api/sub-permits/*` - 子表单管理
- **服务**: `src/services/subPermitService.ts`
- **特性**: 动态记录型模板、追加记录、独立审批流程

### 10. MinIO对象存储
- **API**: `/api/storage/*` - 预签名URL、存储状态
- **服务**: `src/services/storage/MinioStorageService.ts`
- **组件**: `src/components/storage/` - 文件上传组件
- **特性**: 私有/公有存储桶、预签名上传、文件管理

### 11. 电子签名系统
- **服务**: `src/services/signatureService.ts`
- **模型**: `SignatureRecord` - 电子签名记录表
- **特性**: 防篡改、数据快照、审计追踪

### 12. 核心数据恢复
- **服务**: `src/services/coreDataRestore.service.ts`
- **特性**: 从JSON文件恢复核心数据（部门、用户、文件元数据等）

---

*最后更新: 2025年1月*

