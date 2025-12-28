# 隐患系统消息通知集成说明

## 概述

已将消息通知系统集成到隐患管理系统的派发引擎中，实现自动化的消息推送功能。

## 集成架构

```
隐患派发引擎 (HazardDispatchEngine)
    ↓
通知服务 (HazardNotificationService)
    ↓
数据库 (Prisma - Notification 表)
    ↓
前端通知面板 (NotificationPanel)
```

## 新增文件

### 1. `src/services/hazardNotification.service.ts`
隐患通知服务，负责创建和发送各类隐患相关通知。

**主要功能：**
- `notifyHandlers()` - 发送处理人通知
- `notifyCC()` - 发送抄送人通知
- `notifyClosed()` - 发送闭环通知（通知上报人）
- `sendCustomNotification()` - 发送自定义通知

**通知类型：**
```typescript
enum HazardNotificationType {
  ASSIGNED = 'hazard_assigned',              // 隐患被指派
  CC = 'hazard_cc',                          // 隐患抄送
  SUBMITTED = 'hazard_submitted',            // 隐患已提交
  RECTIFIED = 'hazard_rectified',            // 隐患已整改
  VERIFIED = 'hazard_verified',              // 隐患已验收
  REJECTED = 'hazard_rejected',              // 隐患被驳回
  EXTENSION_REQUESTED = 'hazard_extension',  // 延期申请
  CLOSED = 'hazard_closed',                  // 隐患已闭环
}
```

## 修改文件

### 1. `src/services/hazardDispatchEngine.ts`

**新增方法：**
- `sendNotifications()` - 私有方法，在派发完成后自动发送通知

**集成点：**
在 `dispatch()` 方法的第7步，匹配处理人和抄送人后，自动发送通知：

```typescript
// 7. 发送通知
await this.sendNotifications({
  hazard: updatedHazard,
  action: log.action,
  operator,
  handlers: { userIds, userNames },
  ccUsers: { userIds, userNames },
  newStatus: transition.newStatus
});
```

## 通知触发场景

### 1. 提交上报（SUBMIT）
- **处理人通知：** 通知步骤2的处理人（通常是上报人的主管）
- **抄送人通知：** 根据抄送规则通知相关人员
- **通知内容：** "XXX 上报了隐患'XXX'，请及时处理"

### 2. 指派整改（ASSIGN）
- **处理人通知：** 通知整改责任人
- **抄送人通知：** 根据抄送规则通知相关人员
- **通知内容：** "XXX 指派您整改隐患'XXX'，请在 XXX 完成"

### 3. 提交整改（RECTIFY）
- **处理人通知：** 通知验收人
- **抄送人通知：** 根据抄送规则通知相关人员
- **通知内容：** "XXX 已完成隐患'XXX'的整改，请验收"

### 4. 验收通过（VERIFY）
- **处理人通知：** 无（流程结束）
- **抄送人通知：** 根据抄送规则通知相关人员
- **闭环通知：** 通知上报人隐患已闭环
- **通知内容：** "您上报的隐患'XXX'已由 XXX 验收闭环"

### 5. 驳回（REJECT）
- **处理人通知：** 通知被驳回步骤的责任人
- **抄送人通知：** 根据抄送规则通知相关人员
- **通知内容：** "XXX 驳回了隐患'XXX'，请重新处理"

### 6. 延期申请（EXTEND_DEADLINE）
- **处理人通知：** 通知审批人
- **抄送人通知：** 根据抄送规则通知相关人员
- **通知内容：** "XXX 申请延期处理隐患'XXX'"

## 通知数据结构

通知存储在 `Notification` 表中：

```typescript
{
  id: string;          // 通知ID
  userId: string;      // 接收用户ID
  type: string;        // 通知类型
  title: string;       // 通知标题
  content: string;     // 通知内容
  relatedType: 'hazard'; // 关联类型
  relatedId: string;   // 隐患ID
  isRead: boolean;     // 是否已读
  createdAt: Date;     // 创建时间
  updatedAt: Date;     // 更新时间
}
```

## 通知失败处理

- 通知发送失败**不会阻断**主业务流程
- 失败信息会记录到控制台日志
- 使用 try-catch 捕获异常，确保派发引擎正常运行

```typescript
try {
  await HazardNotificationService.notifyHandlers(...);
} catch (error) {
  console.error('❌ 发送处理人通知失败:', error);
  // 不抛出异常，继续执行
}
```

## 使用示例

### 在现有代码中（useHazardWorkflow）

通知发送是**自动化**的，无需手动调用。当调用派发引擎时，会自动发送通知：

```typescript
const result = await HazardDispatchEngine.dispatch({
  hazard,
  action: DispatchAction.SUBMIT,
  operator: { id: user.id, name: user.name },
  workflowSteps,
  allUsers,
  departments,
  comment: '提交隐患'
});

// 通知已自动发送，无需额外操作
```

### 手动发送通知（特殊场景）

如需在派发引擎之外发送通知：

```typescript
import { HazardNotificationService } from '@/services/hazardNotification.service';

// 发送自定义通知
await HazardNotificationService.sendCustomNotification({
  userIds: ['user1', 'user2'],
  type: 'hazard_reminder',
  title: '隐患即将超期',
  content: '您有一个隐患即将超期，请及时处理',
  relatedId: hazard.id
});
```

## 前端展示

用户可以在以下位置查看通知：

1. **顶部导航栏** - 通知图标显示未读数量
2. **通知面板** - 点击图标打开通知列表
3. **通知页面** - `/notifications` 查看所有通知

## 日志输出

通知系统会输出以下日志：

```
✅ 已发送处理人通知: 隐患待处理 → 张三、李四
✅ 已发送抄送通知: 隐患抄送通知 → 王五、赵六
✅ 已发送闭环通知 → 上报人
📧 [通知系统] 已发送通知: 处理人2人, 抄送3人
```

## 性能优化

- 使用 `createMany` 批量创建通知，减少数据库交互
- 通知发送采用异步方式，不阻塞主流程
- 失败重试机制可在后续版本中添加

## 测试建议

1. **功能测试**
   - 测试各个流程步骤的通知发送
   - 验证通知接收人是否正确
   - 检查通知内容是否准确

2. **性能测试**
   - 测试批量派发时的通知发送性能
   - 监控数据库查询性能

3. **异常测试**
   - 模拟数据库连接失败
   - 验证通知失败不影响主流程

## 后续优化方向

1. **通知聚合** - 相同类型的通知可以合并显示
2. **推送通知** - 集成 WebSocket 实现实时推送
3. **邮件通知** - 重要通知可发送邮件提醒
4. **微信通知** - 集成企业微信通知
5. **通知偏好设置** - 允许用户设置通知接收偏好
6. **通知模板** - 使用模板引擎定制通知内容

## 总结

通过将通知系统集成到隐患派发引擎，实现了：

✅ **自动化** - 无需手动发送，派发时自动触发
✅ **全覆盖** - 涵盖所有流程步骤和抄送场景
✅ **可靠性** - 失败不影响主流程
✅ **可扩展** - 易于添加新的通知类型
✅ **可追踪** - 详细的日志记录

现在，隐患系统的每个操作都会自动通知相关人员，提高了工作效率和协作体验。
