# 通知模块使用指南

## 快速开始

### 1. 生成 Prisma 客户端

首先需要生成包含 NotificationTemplate 模型的 Prisma 客户端：

```powershell
# 在 PowerShell 中以管理员身份运行
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
npx prisma generate
```

或者在项目根目录下运行：
```bash
npm run db:generate  # 如果 package.json 中有此脚本
```

### 2. 初始化通知模板

有两种方式初始化通知模板：

#### 方式一：通过管理页面（推荐）

1. 启动应用
2. 使用管理员账号登录
3. 访问 `/admin/notifications` 页面
4. 点击"通知模板"标签页
5. 点击"新建模板"按钮
6. 按照《通知模块对接说明.md》中的模板配置创建

#### 方式二：使用 Prisma Studio

```powershell
npx prisma studio
```

在 Prisma Studio 中打开 NotificationTemplate 表，手动添加记录。

### 3. 测试功能

#### 测试培训通知
1. 访问培训模块
2. 创建新的培训任务并分配给用户
3. 检查用户的通知面板是否收到消息

#### 测试作业票通知
1. 访问作业票模块
2. 提交新的作业票申请
3. 审批人应收到待审批通知
4. 完成审批后，申请人应收到审批结果通知

#### 查看消息记录
1. 访问 `/admin/notifications` 页面
2. 切换到"消息记录"标签页
3. 查看统计数据和消息列表
4. 使用筛选器测试搜索功能

## 常见问题

### Q1: 提示 "notificationTemplate is undefined"

**原因**: Prisma 客户端未包含 NotificationTemplate 模型

**解决方案**:
```powershell
# 确保 schema.prisma 中有 NotificationTemplate 模型定义
# 重新生成 Prisma 客户端
npx prisma generate

# 如果仍有问题，尝试清理并重新生成
Remove-Item -Path node_modules\.prisma -Recurse -Force
npx prisma generate
```

### Q2: 创建通知时没有发送

**可能原因**:
1. 没有创建对应的通知模板
2. 模板状态为"已禁用"
3. 触发事件名称不匹配
4. 触发条件不满足

**排查步骤**:
1. 检查控制台日志，查看是否有 "未找到模板" 的提示
2. 在 `/admin/notifications` 页面检查模板配置
3. 确认触发事件名称正确
4. 如果有触发条件，检查条件 JSON 格式是否正确

### Q3: 变量占位符没有替换

**原因**: 上下文数据中缺少对应的变量

**解决方案**:
检查调用 `createNotification` 函数时传入的 context 对象，确保包含模板中使用的所有变量。

例如，如果模板中使用 `{{user.name}}`，context 必须包含：
```typescript
{
  user: {
    name: '张三'
  }
}
```

## 开发指南

### 添加新的通知类型

1. 在 `/admin/notifications` 创建新模板
2. 在相应模块调用通知服务

示例：
```typescript
import { createNotificationsFromTemplate } from '@/lib/notificationService';

await createNotificationsFromTemplate({
  triggerEvent: 'your_custom_event',
  recipientIds: ['user1', 'user2'],
  context: {
    user: { name: '操作人' },
    // 其他自定义数据
  },
  relatedType: 'custom',
  relatedId: 'record-id',
});
```

### 自定义变量

在模板内容中使用 `{{变量路径}}` 格式，例如：
- `{{user.name}}` - 用户名
- `{{data.customField}}` - 自定义字段
- `{{object.nested.value}}` - 嵌套对象值

### 条件触发

在模板的"触发条件"字段中配置 JSON：

```json
{
  "hazard.riskLevel": "high",
  "hazard.status": ["pending", "assigned"]
}
```

- 字符串值：精确匹配
- 数组值：包含其中任一值即可

## 架构说明

```
┌─────────────────────────────────────────┐
│   业务模块 (培训/作业票/隐患)           │
│   ↓ 调用通知服务                        │
├─────────────────────────────────────────┤
│   notificationService.ts                │
│   - 查找匹配的模板                      │
│   - 替换变量占位符                      │
│   - 创建通知记录                        │
│   ↓                                     │
├─────────────────────────────────────────┤
│   Notification 表                       │
│   - 存储用户消息                        │
├─────────────────────────────────────────┤
│   /admin/notifications 页面             │
│   - 模板管理                            │
│   - 消息记录查看                        │
└─────────────────────────────────────────┘
```

## 文件清单

- `src/lib/notificationService.ts` - 通知服务核心逻辑
- `src/app/admin/notifications/page.tsx` - 管理页面
- `src/app/api/admin/notifications/route.ts` - 消息记录 API
- `src/app/api/admin/notification-templates/route.ts` - 模板管理 API
- `通知模块对接说明.md` - 详细的模板配置说明

## 技术栈

- Next.js 14 (App Router)
- Prisma ORM
- SQLite 数据库
- TypeScript
- Tailwind CSS
