# 消息栏系统 - 快速测试指南

## 当前进度
✅ 已完成：
1. 数据库 Notification 模型创建
2. API 接口实现（GET/POST/PATCH）
3. NotificationPanel 前端组件
4. Dashboard 集成通知按钮
5. 审批流程自动通知
6. Git 提交和推送 (commit: 3670289)

## 如何测试

### 方法一：通过审批流程触发（推荐）
1. 登录系统
2. 创建一个作业票并提交审批
3. 第一步审批人审批通过
4. 第二步审批人登录后，在Dashboard右上角应该能看到通知铃铛有红色徽章
5. 点击铃铛查看通知详情

### 方法二：使用测试脚本
1. 修改 `scripts/create-test-notifications.js`
2. 将 `userId: 'admin-id'` 改为你的实际用户ID
3. 运行命令：
```bash
node scripts/create-test-notifications.js
```
4. 刷新Dashboard页面
5. 应该能看到3条测试通知（2未读，1已读）

### 方法三：手动插入数据库
```sql
INSERT INTO Notification (id, userId, type, title, content, relatedType, relatedId, isRead, createdAt, updatedAt)
VALUES (
  'test-notif-' || hex(randomblob(8)),
  '你的用户ID',
  'approval_pending',
  '测试通知',
  '这是一条测试通知消息',
  'permit',
  'test-id',
  0,
  datetime('now'),
  datetime('now')
);
```

## 查看效果

### 在Dashboard页面
- 位置：右上角日期旁边
- 图标：铃铛 + 红色未读数量徽章
- 点击打开：弹出通知面板

### 通知面板功能
- 显示最近50条通知
- 未读消息用蓝色背景高亮
- 显示相对时间（刚刚/几分钟前）
- 点击通知跳转到相关页面
- "全部已读" 按钮

## 调试技巧

### 查看通知API
浏览器访问：
```
http://localhost:3000/api/notifications?userId=你的用户ID
```

### 查看数据库
```bash
npx prisma studio
```
然后打开 Notification 表查看数据

### 查看控制台日志
在审批通过时，后端会输出：
```
✅ 已为 X 位下一步审批人创建通知
```

## 注意事项

1. **用户ID**: 确保使用正确的用户ID，否则看不到通知
2. **审批流程**: 必须配置了多步审批流程，才能看到自动通知
3. **TypeScript错误**: 如果IDE报错 `prisma.notification` 不存在，运行：
   ```bash
   npx prisma generate
   ```
   然后重启VS Code的TypeScript服务器

4. **数据库迁移**: 如果遇到表不存在错误，运行：
   ```bash
   npx prisma migrate deploy
   ```

## 下一步优化

可以考虑添加：
- [ ] WebSocket实时推送
- [ ] 专门的通知页面 `/notifications`
- [ ] 通知删除功能
- [ ] 邮件/短信通知
- [ ] 桌面通知（浏览器Notification API）
- [ ] 消息已读/未读筛选
- [ ] 消息搜索功能

## 问题排查

### 问题1：看不到通知铃铛
- 检查是否登录
- 检查 `src/app/dashboard/page.tsx` 是否正确导入了 `NotificationPanel`

### 问题2：点击铃铛没反应
- 打开浏览器控制台查看是否有API错误
- 检查 `/api/notifications` 接口是否正常

### 问题3：审批后没有创建通知
- 检查审批API日志：`src/app/api/permits/approve/route.ts`
- 确保下一步有配置审批人
- 检查 `approvers` 字段是否有 `id` 或 `userId`

### 问题4：通知数量不对
- 数据库中查询：
  ```sql
  SELECT * FROM Notification WHERE userId='你的ID' AND isRead=0;
  ```
- 对比前端显示的数量

## 联系方式
如有问题，请查看：
- 详细文档: `NOTIFICATION_SYSTEM_GUIDE.md`
- 代码注释: `src/components/common/NotificationPanel.tsx`
- API实现: `src/app/api/notifications/route.ts`
