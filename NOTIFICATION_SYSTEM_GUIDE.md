# 消息栏系统使用说明

## 功能概述
消息栏系统是一个实时通知系统，用于向用户推送与其相关的工作流程审批、隐患分配等信息。

## 核心功能

### 1. 消息显示
- **位置**：主页Dashboard右上角，日期旁边
- **图标**：铃铛图标
- **未读徽章**：红色圆圈显示未读消息数量（最多显示99+）

### 2. 消息类型
- `approval_pending` - 待审批作业票（橙色图标）
- `approval_passed` - 作业票已通过（绿色勾选图标）
- `approval_rejected` - 作业票已驳回（红色X图标）
- `hazard_assigned` - 隐患已分配（黄色警告图标）

### 3. 交互功能
- **点击铃铛**：打开/关闭通知面板
- **点击通知**：
  - 自动标记为已读
  - 跳转到相关页面（作业票/隐患管理）
- **全部已读**：一键标记所有未读消息为已读
- **查看全部**：跳转到专门的通知页面（待实现）

### 4. 自动刷新
- 打开面板时自动刷新
- 每30秒自动后台刷新一次

## 数据库结构

### Notification 表
```prisma
model Notification {
  id          String   @id @default(cuid())
  userId      String   // 接收用户ID
  type        String   // 通知类型
  title       String   // 通知标题
  content     String   // 通知内容
  relatedType String?  // 关联对象类型
  relatedId   String?  // 关联对象ID
  isRead      Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

## API 接口

### 1. 获取通知列表
```
GET /api/notifications?userId={userId}&unreadOnly={boolean}
```
**响应**:
```json
{
  "notifications": [...],
  "unreadCount": 5
}
```

### 2. 标记已读
```
PATCH /api/notifications
Body: { "notificationIds": ["id1", "id2"], "userId": "user-id" }
```

### 3. 创建通知（系统内部）
```
POST /api/notifications
Body: {
  "userId": "user-id",
  "type": "approval_pending",
  "title": "标题",
  "content": "内容",
  "relatedType": "permit",
  "relatedId": "permit-id"
}
```

## 自动触发机制

### 审批流程触发
当作业票审批通过时，系统自动为下一步的审批人创建通知：

**触发位置**: `src/app/api/permits/approve/route.ts`

**逻辑**:
1. 审批人点击"通过"
2. 系统查找下一步审批节点
3. 获取下一步所有审批人的用户ID
4. 为每个审批人创建 `approval_pending` 类型的通知

**代码示例**:
```typescript
if (action === 'pass' && nextStep < workflow.length) {
  const nextStepConfig = workflow[nextStep];
  const approverIds = nextStepConfig.approvers.map(a => a.id);
  
  for (const approverId of approverIds) {
    await prisma.notification.create({
      data: {
        userId: approverId,
        type: 'approval_pending',
        title: '待审批作业票',
        content: `【${template.name}】 ${project.name} - 等待您审批`,
        relatedType: 'permit',
        relatedId: recordId,
      }
    });
  }
}
```

## 前端组件

### NotificationPanel.tsx
**路径**: `src/components/common/NotificationPanel.tsx`

**主要功能**:
- 显示通知列表
- 未读数量徽章
- 实时时间格式化（刚刚/几分钟前/几小时前/几天前）
- 类型图标映射
- 点击跳转

## 使用示例

### 在其他页面集成通知按钮
```tsx
import NotificationPanel from '@/components/common/NotificationPanel';

function MyPage() {
  return (
    <div>
      <NotificationPanel />
    </div>
  );
}
```

### 手动创建通知（服务端）
```typescript
await prisma.notification.create({
  data: {
    userId: 'target-user-id',
    type: 'approval_pending',
    title: '您有新的任务',
    content: '请尽快处理',
    relatedType: 'permit',
    relatedId: 'some-id',
  }
});
```

## 测试

### 运行测试脚本
```bash
node scripts/create-test-notifications.js
```

这将创建3条测试通知（需要先修改脚本中的userId为实际用户ID）

## 后续优化建议

1. **WebSocket实时推送**：当前每30秒轮询，可改为WebSocket实时推送
2. **通知中心页面**：创建专门的`/notifications`页面显示所有历史通知
3. **通知分类筛选**：按类型、已读/未读筛选
4. **批量操作**：批量删除、批量标记
5. **声音提醒**：新消息到达时播放提示音
6. **桌面通知**：使用Notification API推送浏览器通知
7. **邮件/短信通知**：重要消息通过邮件或短信发送

## 注意事项

1. 通知创建失败不会影响主业务流程（审批继续进行）
2. 通知只能由消息接收人自己标记为已读
3. 目前没有通知删除功能，所有通知永久保留
4. 跳转时只跳转到模块页面，不会直接定位到具体记录

## 文件清单

```
src/
├── app/
│   ├── api/
│   │   └── notifications/
│   │       └── route.ts              # 通知API接口
│   └── dashboard/
│       └── page.tsx                  # Dashboard集成通知面板
├── components/
│   └── common/
│       └── NotificationPanel.tsx     # 通知面板组件
prisma/
├── schema.prisma                     # 数据库模型定义
└── migrations/
    └── 20251222152726_add_notification_table/
        └── migration.sql             # 数据库迁移
scripts/
└── create-test-notifications.js     # 测试数据脚本
```
