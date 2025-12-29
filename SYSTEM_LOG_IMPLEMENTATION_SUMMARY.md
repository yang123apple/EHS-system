# 系统操作日志功能实现总结

## 已完成工作

### 1. 数据库层 ✅
- **文件**: `prisma/schema.prisma`
- **修改**: 扩展 `SystemLog` 模型
  - 添加 `targetType` 字段：区分日志来源（hazard/document/permit/config/user/org）
  - 添加 `snapshot` 字段：存储JSON格式的流程快照数据
- **迁移**: `prisma/migrations/20251229160633_add_snapshot_to_system_log/migration.sql`

### 2. 服务层 ✅
- **文件**: `src/services/systemLog.service.ts`
- **功能**:
  - `createLog()`: 创建单条日志，自动JSON序列化snapshot
  - `createBatchLogs()`: 批量创建日志
  - `getLogs()`: 支持筛选和分页的日志查询
  - `cleanOldLogs()`: 清理旧日志（保留90天）

### 3. API层 ✅
- **文件**: `src/app/api/logs/route.ts`
- **功能**:
  - GET方法：使用SystemLogService查询日志
  - 支持筛选参数：targetType、action、userId、startDate、endDate
  - 返回分页数据结构

### 4. Work-Permit系统日志视图 ✅
- **文件**: `src/components/work-permit/views/SystemLogView.tsx`
- **功能**:
  - 日志列表展示（时间、操作、操作人、详情）
  - 筛选功能（操作类型、日期范围）
  - 快照查看弹窗
  - JSON格式化展示
  - 分页功能

### 5. 隐患排查系统日志功能 ✅

#### 5.1 常量定义
- **文件**: `src/constants/hazard.ts`
- **修改**: 添加 `logs` 视图模式到 `ViewMode` 类型

#### 5.2 日志视图组件
- **文件**: `src/app/hidden-danger/_components/views/SystemLogView.tsx`
- **功能**:
  - 隐患系统专用日志视图
  - 自动筛选 `targetType='hazard'` 的日志
  - 支持操作类型筛选和日期范围筛选
  - 快照查看功能
  - 解析引擎派发结果展示

#### 5.3 导航集成
- **文件**: `src/app/hidden-danger/layout.tsx`
- **修改**: 
  - 导入 `FileText` 图标
  - 添加"操作日志"导航项（仅admin可见）

#### 5.4 页面渲染
- **文件**: `src/app/hidden-danger/page.tsx`
- **修改**:
  - 导入 `SystemLogView` 组件
  - 添加 `viewMode === 'logs'` 的渲染逻辑

#### 5.5 流程日志记录集成 ✅
- **文件**: `src/app/hidden-danger/_hooks/useHazardWorkflow.ts`
- **修改**:
  - 导入 `SystemLogService`
  - 在流程流转成功后记录系统日志
  - **快照内容包括**:
    - 操作信息（action、operatorName、operatedAt）
    - 隐患信息（hazardCode、hazardDesc）
    - 流程步骤（currentStep、nextStep）
    - **引擎派发结果**（重点）:
      - assignedTo: 引擎匹配的处理人姓名数组
      - assignedToIds: 处理人ID数组
      - ccTo: 抄送人姓名数组
      - ccToIds: 抄送人ID数组
      - matchedBy: 匹配规则描述
      - status: 新状态
    - 备注信息（comment）
    - 附加数据（additionalData）

### 6. 日志操作类型映射 ✅
隐患系统的日志操作类型：
- `hazard_reported`: 上报隐患
- `hazard_assigned`: 指派处理
- `hazard_rectified`: 完成整改
- `hazard_verified`: 验收通过
- `hazard_rejected`: 验收驳回

## 待完成工作

### 1. 文档管理系统日志功能 ⏳
文档系统结构复杂，没有标签式导航。需要：

#### 方案A：添加独立的日志页面（推荐）
- 创建 `/docs/logs` 页面
- 在文档系统主页面添加"操作日志"按钮链接到该页面
- 仅admin可见

#### 方案B：集成到现有界面
- 在侧边栏筛选面板底部添加"查看日志"按钮
- 打开全屏日志模态框
- 仅admin可见

#### 需要记录的关键操作：
1. **上传文档** (`document_uploaded`)
   - 快照：文件信息、级别、上传者、部门
2. **删除文档** (`document_deleted`)
   - 快照：被删除文件的完整信息
3. **更新版本** (`document_version_updated`)
   - 快照：旧版本信息、新版本信息
4. **修改信息** (`document_info_updated`)
   - 快照：修改前后的对比数据
5. **删除历史版本** (`document_history_deleted`)
   - 快照：被删除的历史版本信息

#### 集成点：
- `src/app/docs/page.tsx` 的关键函数：
  - `handleUpload()`
  - `handleDelete()`
  - `handleUpdateVersion()`
  - `handleSaveEdit()`
  - `handleDeleteHistory()`

### 2. 优化建议 💡

#### 2.1 日志自动清理
- 在 `src/instrumentation.ts` 中添加定时任务
- 定期调用 `SystemLogService.cleanOldLogs()`

#### 2.2 性能优化
- 为 `SystemLog` 表添加索引（targetType、createdAt）
- 考虑日志归档策略

#### 2.3 功能增强
- 导出日志功能（Excel/CSV）
- 日志统计分析（操作频率、用户活跃度）
- 异常日志告警

## 技术架构

### 数据流向
```
用户操作 
  → 业务逻辑（useHazardWorkflow/handleUpload等）
  → 数据库更新
  → SystemLogService.createLog()（记录快照）
  → Prisma写入SystemLog表
```

### 快照设计原则
1. **完整性**: 记录足够信息以便事后审计
2. **可读性**: JSON结构清晰，便于前端展示
3. **追溯性**: 包含引擎派发结果，记录"当时为什么是这个人处理"

### 权限控制
- 操作日志功能：仅 `admin` 角色可见
- 快照查看：仅 `admin` 角色可查看详细信息

## 测试建议

### 1. 隐患系统日志测试
- [ ] 上报隐患，检查是否记录 `hazard_reported` 日志
- [ ] 指派处理，检查快照中的引擎派发结果
- [ ] 整改、验收流程，检查各节点日志
- [ ] 筛选功能测试（按操作类型、日期范围）
- [ ] 快照查看功能测试

### 2. 文档系统日志测试（待实现后）
- [ ] 上传文档，检查日志记录
- [ ] 删除文档，检查日志记录
- [ ] 更新版本，检查旧版本快照
- [ ] 修改信息，检查修改前后对比

### 3. 性能测试
- [ ] 大量日志（10000+）的查询性能
- [ ] 快照数据量较大时的序列化性能
- [ ] 分页加载测试

## 文件清单

### 新增文件
1. `src/services/systemLog.service.ts` - 日志服务
2. `src/components/work-permit/views/SystemLogView.tsx` - Work-Permit日志视图
3. `src/app/hidden-danger/_components/views/SystemLogView.tsx` - 隐患系统日志视图
4. `prisma/migrations/20251229160633_add_snapshot_to_system_log/migration.sql` - 数据库迁移

### 修改文件
1. `prisma/schema.prisma` - 数据模型扩展
2. `src/app/api/logs/route.ts` - API更新
3. `src/constants/hazard.ts` - 视图模式定义
4. `src/app/hidden-danger/layout.tsx` - 导航添加
5. `src/app/hidden-danger/page.tsx` - 视图渲染
6. `src/app/hidden-danger/_hooks/useHazardWorkflow.ts` - 日志集成

## 下一步行动
1. 为文档管理系统实现日志功能
2. 添加日志自动清理定时任务
3. 完善测试用例
4. 编写用户使用文档
