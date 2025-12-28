# Prisma Client 浏览器环境错误修复

## 问题描述

**错误信息：**
```
PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `unknown`).
```

**错误位置：**
- `src/services/hazardNotification.service.ts:99` - `prisma.notification.createMany()`
- 调用链：客户端组件 → `useHazardWorkflow` → `HazardDispatchEngine` → `HazardNotificationService`

**根本原因：**
Prisma Client 只能在 Node.js 服务器端环境运行，但 `HazardNotificationService` 被客户端代码（`useHazardWorkflow` Hook）调用，导致 Prisma 在浏览器环境中执行，从而报错。

---

## 解决方案

### 1. 重构通知服务（hazardNotification.service.ts）

**修改前：**
- 直接使用 Prisma Client 创建通知
- 方法名：`notifyHandlers()`, `notifyCC()`, `notifyClosed()`
- 包含 `await prisma.notification.createMany()`

**修改后：**
- 只生成通知数据，不执行数据库操作
- 方法名：`generateHandlerNotifications()`, `generateCCNotifications()`, `generateClosedNotification()`
- 返回 `NotificationData[]` 类型
- 移除所有 Prisma 导入和数据库操作

**新增类型：**
```typescript
export interface NotificationData {
  userId: string;
  type: string;
  title: string;
  content: string;
  relatedType: string;
  relatedId: string;
  isRead: boolean;
}
```

---

### 2. 更新派发引擎（hazardDispatchEngine.ts）

**修改要点：**

1. **更新导入：**
   ```typescript
   import { HazardNotificationService, NotificationData } from './hazardNotification.service';
   ```

2. **修改 DispatchResult 接口：**
   ```typescript
   export interface DispatchResult {
     // ... 其他字段
     notifications: NotificationData[]; // 新增：需要创建的通知数据
   }
   ```

3. **重构通知方法：**
   - 方法名：`sendNotifications()` → `generateNotifications()`
   - 返回类型：`Promise<void>` → `NotificationData[]`
   - 不再执行异步数据库操作，只生成数据

4. **调用方式改变：**
   ```typescript
   // 修改前
   await this.sendNotifications({ ... });
   
   // 修改后
   const notifications = this.generateNotifications({ ... });
   ```

---

### 3. 更新客户端 Hook（useHazardWorkflow.ts）

**新增通知创建逻辑：**

```typescript
// 更新隐患状态
await hazardService.updateHazard({ id: hazard.id, ...updates });

// 创建通知（通过 API）
if (result.notifications && result.notifications.length > 0) {
  try {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notifications: result.notifications }),
    });
    console.log(`✅ 已创建 ${result.notifications.length} 条通知`);
  } catch (notifyError) {
    console.error('❌ 创建通知失败（不影响主流程）:', notifyError);
    // 通知创建失败不应阻断主流程
  }
}
```

**关键点：**
- 派发引擎返回通知数据后，客户端通过 API 创建通知
- 通知创建失败不会影响主业务流程
- 使用 try-catch 确保错误处理

---

### 4. 增强 API 路由（/api/notifications/route.ts）

**新增批量创建支持：**

```typescript
// POST /api/notifications - 创建新通知（支持单个或批量）
export async function POST(request: NextRequest) {
  // 支持批量创建
  if (body.notifications && Array.isArray(body.notifications)) {
    const result = await prisma.notification.createMany({
      data: notifications.map((n: any) => ({
        userId: n.userId,
        type: n.type,
        title: n.title,
        content: n.content,
        relatedType: n.relatedType || 'hazard',
        relatedId: n.relatedId,
        isRead: false,
      })),
    });
    return NextResponse.json({ success: true, count: result.count });
  }
  
  // 支持单个创建（向后兼容）
  // ...
}
```

**改进点：**
- 支持批量创建（`notifications` 数组）
- 向后兼容单个创建
- 数据验证
- 错误处理

---

## 架构优势

### 修复前的问题：
```
客户端组件
  ↓
useHazardWorkflow (客户端)
  ↓
HazardDispatchEngine (通用)
  ↓
HazardNotificationService (服务端代码)
  ↓
❌ Prisma Client (只能在服务端运行)
```

### 修复后的架构：
```
客户端组件
  ↓
useHazardWorkflow (客户端)
  ↓
HazardDispatchEngine (通用 - 生成数据)
  ↓
HazardNotificationService (通用 - 生成数据)
  ↓
返回 NotificationData[]
  ↓
useHazardWorkflow 调用 API
  ↓
/api/notifications (服务端)
  ↓
✅ Prisma Client (在服务端运行)
```

---

## 关键改进

### 1. **职责分离**
- **服务层**：只负责业务逻辑和数据生成
- **API 层**：负责数据库操作
- **客户端**：协调服务层和 API 层

### 2. **环境兼容**
- 服务可以在客户端和服务端使用
- Prisma 操作严格限制在 API 路由中

### 3. **错误隔离**
- 通知创建失败不影响主业务流程
- 每层都有独立的错误处理

### 4. **可测试性**
- 服务层纯函数，易于测试
- 数据库操作集中在 API，便于 Mock

---

## 测试要点

1. **功能测试：**
   - ✅ 隐患上报后能否正确创建通知
   - ✅ 处理人和抄送人是否收到通知
   - ✅ 通知内容是否正确

2. **错误处理：**
   - ✅ 通知 API 失败时主流程是否继续
   - ✅ 无效通知数据是否被正确拒绝

3. **性能测试：**
   - ✅ 批量通知创建性能
   - ✅ 大量用户同时操作时的表现

---

## 修改文件清单

1. ✅ `src/services/hazardNotification.service.ts` - 移除 Prisma，改为生成数据
2. ✅ `src/services/hazardDispatchEngine.ts` - 返回通知数据而非直接创建
3. ✅ `src/app/hidden-danger/_hooks/useHazardWorkflow.ts` - 通过 API 创建通知
4. ✅ `src/app/api/notifications/route.ts` - 支持批量创建

---

## 通知面板集成

### 现有通知面板（NotificationPanel.tsx）

系统已有完整的通知面板组件，位于主页铃铛图标处：

**功能特性：**
1. ✅ 实时显示未读通知数量（红色角标）
2. ✅ 自动每30秒刷新通知列表
3. ✅ 支持标记单个/全部已读
4. ✅ 点击通知自动跳转到隐患详情页
5. ✅ 完整支持所有隐患通知类型的图标显示

**通知类型图标映射：**
- `hazard_assigned` → ⚠️ 黄色警告图标（隐患被指派）
- `hazard_cc` → 🔔 蓝色铃铛图标（隐患抄送）
- `hazard_submitted` → 📄 蓝色文件图标（隐患已提交）
- `hazard_rectified` → ✓✓ 绿色勾选图标（隐患已整改）
- `hazard_verified` → ✓✓ 深绿色勾选图标（隐患已验收）
- `hazard_rejected` → ✗ 红色叉号图标（隐患被驳回）
- `hazard_extension` → 📝 橙色签名图标（延期申请）
- `hazard_closed` → ✓✓ 翠绿色勾选图标（隐患已闭环）

**完整流程：**
```
隐患操作（上报/指派/整改/验收等）
  ↓
HazardDispatchEngine 生成通知数据
  ↓
API 批量创建通知到数据库
  ↓
NotificationPanel 自动刷新（30秒间隔）
  ↓
铃铛图标显示未读数量
  ↓
用户点击查看通知
  ↓
标记已读 + 跳转到隐患详情页
```

### 通知类型完整对应关系

**HazardNotificationService 生成的类型** ↔ **NotificationPanel 支持的显示**

| 服务生成类型 | 枚举值 | 面板图标 | 触发场景 |
|------------|--------|---------|---------|
| SUBMITTED | `hazard_submitted` | 📄 蓝色 | 提交上报 |
| ASSIGNED | `hazard_assigned` | ⚠️ 黄色 | 指派整改 |
| RECTIFIED | `hazard_rectified` | ✓✓ 绿色 | 提交整改 |
| VERIFIED | `hazard_verified` | ✓✓ 深绿 | 验收通过 |
| REJECTED | `hazard_rejected` | ✗ 红色 | 驳回 |
| EXTENSION_REQUESTED | `hazard_extension` | 📝 橙色 | 延期申请 |
| CLOSED | `hazard_closed` | ✓✓ 翠绿 | 隐患闭环 |
| CC | `hazard_cc` | 🔔 蓝色 | 抄送通知 |

**验证结果：** ✅ 所有通知类型完全匹配，无遗漏！

---

## 总结

此次修复彻底解决了 Prisma Client 在浏览器环境运行的问题，通过清晰的架构分层确保：
- ✅ 数据库操作只在服务端执行
- ✅ 服务层保持环境无关性
- ✅ 客户端和服务端职责明确
- ✅ 错误不会影响主业务流程
- ✅ 通知系统完整集成，用户可在主页铃铛图标查看所有通知

**用户体验：**
1. 隐患操作后自动生成通知
2. 通知实时显示在主页铃铛图标
3. 未读通知有醒目的红色角标提示
4. 点击通知可直接跳转到相关隐患详情
5. 支持一键全部已读，操作便捷

这是一次重要的架构改进，不仅修复了技术问题，还完善了用户通知体验，为后续功能扩展奠定了良好基础。
